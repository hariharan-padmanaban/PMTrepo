import { PMTDocumentUploadService } from '../generated/services/PMTDocumentUploadService';
import { PMTDocumentFetchService } from '../generated/services/PMTDocumentFetchService';

export interface AttachmentFile {
  id: string;
  name: string;
  url: string;
  modified?: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export async function uploadAttachments(
  attachmentId: string,
  files: File[],
): Promise<{ uploaded: string[]; errors: string[] }> {
  const uploaded: string[] = [];
  const errors: string[] = [];

  for (const file of files) {
    try {
      const contentBytes = await fileToBase64(file);
      const response = await PMTDocumentUploadService.Run({
        text_1: attachmentId,
        file: {
          name: file.name,
          contentBytes,
        },
      });

      if (response?.success) {
        uploaded.push(file.name);
      } else {
        const errorMsg = response?.error?.message || 'Upload failed';
        errors.push(`${file.name}: ${errorMsg}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(`${file.name}: ${errorMsg}`);
    }
  }

  return { uploaded, errors };
}

export async function fetchAttachments(attachmentId: string): Promise<AttachmentFile[]> {
  try {
    const response = await PMTDocumentFetchService.Run({
      text_1: attachmentId,
    });

    if (!response?.success) {
      return [];
    }

    // Get files array from response
    let filesArray: Array<Record<string, unknown>> | null = null;
    if (Array.isArray(response?.data?.body?.value)) {
      filesArray = response.data.body.value;
    } else if (Array.isArray((response as any)?.body?.value)) {
      filesArray = (response as any).body.value;
    } else if (Array.isArray(response?.data)) {
      filesArray = response.data as Array<Record<string, unknown>>;
    } else if (Array.isArray((response as any)?.body)) {
      filesArray = (response as any).body;
    }

    if (!filesArray || filesArray.length === 0) {
      return [];
    }

    // Filter files by Attachment ID
    const filteredFiles = filesArray.filter((file) => {
      const fileAttachmentId =
        String(file.crcf8_attachmentid ?? file.AttachmentID ?? file.attachment_id ?? file['Attachment ID'] ?? '').trim();
      return fileAttachmentId === attachmentId;
    });

    // Map SharePoint properties to our AttachmentFile interface
    return filteredFiles.map((file) => ({
      id: String(file.ID ?? file.ItemInternalId ?? ''),
      name: String(file['{FilenameWithExtension}'] ?? file.Name ?? 'Unknown'),
      url: String(file['{Link}'] ?? ''),
      modified: String(file.Modified ?? file.Created ?? ''),
    }));
  } catch (error) {
    console.error('Error fetching attachments:', error);
    return [];
  }
}

export async function downloadFile(file: AttachmentFile): Promise<void> {
  try {
    if (!file.url) {
      throw new Error('No download URL available');
    }

    const link = document.createElement('a');
    link.href = file.url;
    link.download = file.name;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Error downloading file:', error);
    throw error;
  }
}
