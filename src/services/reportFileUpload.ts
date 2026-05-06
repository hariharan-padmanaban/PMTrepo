import { PMTDocumentUploadService } from '../generated/services/PMTDocumentUploadService';
import { PMTDocumentFetchService } from '../generated/services/PMTDocumentFetchService';

export async function fetchFilesForReport(
  attachmentId: string
): Promise<{ fileName: string }[]> {
  try {
    console.log(`📥 Fetching files for AttachmentID: ${attachmentId}`);
    const response = await PMTDocumentFetchService.Run({
      attachmentId,
    });

    if (response?.success && response?.data?.body?.value) {
      const files = Array.isArray(response.data.body.value)
        ? response.data.body.value
        : [response.data.body.value];
      const fileNames = files
        .map((f) => String(f.name || f.fileName || '').trim())
        .filter(Boolean);
      console.log(`✅ Fetched ${fileNames.length} file(s) for ${attachmentId}`);
      return fileNames.map((fileName) => ({ fileName }));
    }

    console.log(`ℹ️ No files found for ${attachmentId}`);
    return [];
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`ℹ️ Fetch attempt for ${attachmentId}: ${errorMsg}`);
    return [];
  }
}

export async function uploadFileToReportFlow(
  attachmentId: string,
  file: File
): Promise<{ success: boolean; error?: string }> {
  try {
    // Convert file to base64
    const base64Content = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1] || result;
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

    console.log(`📤 Uploading: ${file.name} | AttachmentID: ${attachmentId}`);

    // Call PMTDocumentUpload flow via Power Automate
    const response = await PMTDocumentUploadService.Run({
      text_1: attachmentId,
      file: {
        name: file.name,
        contentBytes: base64Content,
      },
    });

    console.log(`✅ Response:`, response);

    if (response?.success) {
      console.log(`✅ Uploaded: ${file.name}`);
      return { success: true };
    } else {
      const errorMsg = response?.error?.message || 'Upload failed';
      console.error(`❌ Failed: ${file.name} - ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`❌ Exception:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Uploads files for a report using Power Automate flow (PMTDocumentUpload).
 * Files are stored with the attachment ID in the report.
 * The attachment ID is stored in the new_attachmentid column of the report.
 */
export async function uploadFilesForReport(
  attachmentId: string,
  files: File[]
): Promise<{ uploaded: string[]; errors: string[] }> {
  const uploaded: string[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const result = await uploadFileToReportFlow(attachmentId, file);
    if (result.success) {
      uploaded.push(file.name);
    } else {
      errors.push(`${file.name}: ${result.error || 'Unknown error'}`);
    }
  }

  return { uploaded, errors };
}
