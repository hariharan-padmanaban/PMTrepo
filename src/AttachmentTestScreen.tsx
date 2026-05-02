import { useState, useRef } from 'react';
import { PMTDocumentUploadService } from './generated/services/PMTDocumentUploadService';

export function AttachmentTestScreen() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [attachmentId, setAttachmentId] = useState<string>(() =>
    globalThis.crypto?.randomUUID?.() || `TEST-${Date.now()}`
  );
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setResult(`Selected: ${file.name}`);
    }
  };

  const convertToBase64 = (file: File): Promise<string> => {
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
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setResult('❌ Please select a file');
      return;
    }

    setUploading(true);
    setResult(`📤 Uploading: ${selectedFile.name}...`);

    try {
      console.log('🚀 Starting upload...', { attachmentId, fileName: selectedFile.name });

      // Convert file to base64
      const contentBytes = await convertToBase64(selectedFile);
      console.log('✅ File converted to base64', { size: contentBytes.length });

      // Call PMTDocumentUploadService
      console.log('📞 Calling PMTDocumentUploadService.Run()...', {
        text_1: attachmentId,
        fileName: selectedFile.name,
      });

      const response = await PMTDocumentUploadService.Run({
        text_1: attachmentId,
        file: {
          name: selectedFile.name,
          contentBytes,
        },
      });

      console.log('📨 Response received:', response);

      if (response?.success) {
        setResult(`✅ SUCCESS! File uploaded: ${selectedFile.name}\n\nAttachmentID: ${attachmentId}\n\nCheck SharePoint library for the file.`);
      } else {
        const errorMsg = response?.error?.message || 'Unknown error';
        setResult(`❌ FAILED: ${errorMsg}`);
        console.error('Error:', response?.error);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Exception:', error);
      setResult(`❌ EXCEPTION: ${errorMsg}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>📎 Attachment Upload Test</h1>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
          Attachment ID:
        </label>
        <input
          type="text"
          value={attachmentId}
          onChange={(e) => setAttachmentId(e.target.value)}
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '12px',
          }}
          placeholder="Attachment ID or leave for auto-generated"
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
          Select File:
        </label>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          style={{
            display: 'block',
            marginBottom: '10px',
          }}
        />
        {selectedFile && (
          <div style={{ padding: '10px', backgroundColor: '#e8f5e9', borderRadius: '4px' }}>
            📄 {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
          </div>
        )}
      </div>

      <button
        onClick={handleUpload}
        disabled={uploading || !selectedFile}
        style={{
          width: '100%',
          padding: '12px',
          backgroundColor: uploading || !selectedFile ? '#ccc' : '#2196F3',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: uploading || !selectedFile ? 'not-allowed' : 'pointer',
        }}
      >
        {uploading ? '⏳ Uploading...' : '🚀 Upload to Flow'}
      </button>

      {result && (
        <div
          style={{
            marginTop: '20px',
            padding: '15px',
            backgroundColor: result.includes('✅') ? '#e8f5e9' : result.includes('❌') ? '#ffebee' : '#e3f2fd',
            borderLeft: `4px solid ${result.includes('✅') ? '#4caf50' : result.includes('❌') ? '#f44336' : '#2196F3'}`,
            borderRadius: '4px',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {result}
        </div>
      )}

      <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
        <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#666' }}>
          <strong>How to test:</strong>
        </p>
        <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: '#666' }}>
          <li>Select a file (any type)</li>
          <li>Click "Upload to Flow"</li>
          <li>Check browser console (F12) for detailed logs</li>
          <li>Check SharePoint library for uploaded file with Attachment ID folder</li>
        </ol>
      </div>
    </div>
  );
}
