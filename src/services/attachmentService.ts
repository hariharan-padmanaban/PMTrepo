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
    console.log('📥 Fetching attachments for ID:', attachmentId);

    const response = await PMTDocumentFetchService.Run({
      text_1: attachmentId,
    });

    console.log('📨 Full Response:', response);
    console.log('📊 Response Success:', response?.success);

    if (!response?.success) {
      console.warn('❌ Response not successful:', response?.error);
      return [];
    }

    // Try multiple paths to find the files array
    let filesArray: Array<Record<string, unknown>> | null = null;

    // Path 1: response.data.body.value
    if (Array.isArray(response?.data?.body?.value)) {
      filesArray = response.data.body.value;
      console.log('✅ Found files in data.body.value');
    }
    // Path 2: response.body.value
    else if (Array.isArray((response as any)?.body?.value)) {
      filesArray = (response as any).body.value;
      console.log('✅ Found files in body.value');
    }
    // Path 3: response.data directly
    else if (Array.isArray(response?.data)) {
      filesArray = response.data as Array<Record<string, unknown>>;
      console.log('✅ Found files in data');
    }
    // Path 4: Check if body is an array
    else if (Array.isArray((response as any)?.body)) {
      filesArray = (response as any).body;
      console.log('✅ Found files in body');
    }

    if (!filesArray || filesArray.length === 0) {
      console.warn('⚠️ No files found in response');
      return [];
    }

    console.log('📦 Total files in response:', filesArray.length);
    console.log('🔍 Filtering files by Attachment ID:', attachmentId);

    // Filter files by Attachment ID - look for matching files
    const filteredFiles = filesArray.filter((file) => {
      // Check various possible property names for Attachment ID
      const fileAttachmentId =
        String(file.crcf8_attachmentid ?? file.AttachmentID ?? file.attachment_id ?? file['Attachment ID'] ?? '').trim();

      console.log(`  📄 File: "${file.Name ?? file.FileLeafRef ?? 'Unknown'}" | AttachmentID: "${fileAttachmentId}"`);

      // Return true if this file's attachment ID matches the one we're looking for
      return fileAttachmentId === attachmentId;
    });

    console.log(`✅ Filtered files: ${filteredFiles.length} matching out of ${filesArray.length} total`);

    const mappedFiles = filteredFiles.map((file) => {
      // SharePoint returns file properties with curly braces like {FilenameWithExtension}, {Link}, etc.
      const filename = String(file['{FilenameWithExtension}'] ?? file.Name ?? file.FileLeafRef ?? 'Unknown');
      const downloadUrl = String(file['{Link}'] ?? file.ServerRelativeUrl ?? file.Url ?? '');
      const modified = String(file.Modified ?? file.Created ?? '');

      console.log(`  ✅ Mapped: "${filename}" | URL: "${downloadUrl}"`);

      return {
        id: String(file.ID ?? file.ItemInternalId ?? ''),
        name: filename,
        url: downloadUrl,
        modified: modified,
      };
    });

    console.log('✅ Ready to display:', mappedFiles);
    return mappedFiles;
  } catch (error) {
    console.error('❌ Error fetching attachments:', error);
    return [];
  }
}

export async function downloadFile(file: AttachmentFile): Promise<void> {
  try {
    console.log('⬇️ Starting download for:', file.name);

    if (!file.url) {
      throw new Error('No download URL available');
    }

    // Open the SharePoint link directly - SharePoint will handle the download
    // This is the simplest and most reliable method
    const link = document.createElement('a');
    link.href = file.url;
    link.download = file.name;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log('✅ Download started for:', file.name);
  } catch (error) {
    console.error('❌ Error downloading file:', error);
    throw error;
  }
}
