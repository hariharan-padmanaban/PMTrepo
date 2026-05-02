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

    if (!response?.success || !response?.data?.body?.value) {
      return [];
    }

    const files = response.data.body.value as Array<Record<string, unknown>>;
    return files.map((file) => ({
      id: String(file.UniqueId ?? file.ID ?? file.id ?? ''),
      name: String(file.Name ?? file.FileLeafRef ?? file.name ?? 'Unknown'),
      url: String(file.ServerRelativeUrl ?? file.Url ?? file.url ?? ''),
      modified: String(file.Modified ?? file.TimeCreated ?? file.modified ?? ''),
    }));
  } catch (error) {
    console.error('Error fetching attachments:', error);
    return [];
  }
}

export async function downloadFile(file: AttachmentFile): Promise<void> {
  try {
    const response = await fetch(file.url);
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.statusText}`);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading file:', error);
    throw error;
  }
}
