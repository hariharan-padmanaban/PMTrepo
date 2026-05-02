import { PMTDocumentUploadService } from '../generated/services/PMTDocumentUploadService';

export async function uploadFileToFlow(
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

    // Call PMTDocumentUpload flow
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

export async function uploadMultipleFiles(
  attachmentId: string,
  files: File[]
): Promise<{ uploaded: string[]; errors: string[] }> {
  const uploaded: string[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const result = await uploadFileToFlow(attachmentId, file);
    if (result.success) {
      uploaded.push(file.name);
    } else {
      errors.push(`${file.name}: ${result.error || 'Unknown error'}`);
    }
  }

  return { uploaded, errors };
}
