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
    console.log('📋 Response Data:', response?.data);

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

    console.log('📦 Total files found:', filesArray.length);

    const mappedFiles = filesArray.map((file, index) => {
      console.log(`  File ${index}:`, file);
      return {
        id: String(file.UniqueId ?? file.ID ?? file.id ?? file['@odata.id'] ?? `file-${index}`),
        name: String(file.Name ?? file.FileLeafRef ?? file.name ?? file.Title ?? 'Unknown'),
        url: String(file.ServerRelativeUrl ?? file.Url ?? file.url ?? file['@odata.id'] ?? ''),
        modified: String(file.Modified ?? file.TimeCreated ?? file.modified ?? file.Created ?? ''),
      };
    });

    console.log('✅ Mapped files:', mappedFiles);
    return mappedFiles;
  } catch (error) {
    console.error('❌ Error fetching attachments:', error);
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
