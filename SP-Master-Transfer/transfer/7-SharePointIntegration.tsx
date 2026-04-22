/**
 * SharePoint Integration Component
 *
 * Complete solution for SharePoint file management (upload, download, list, delete)
 * with static configuration.
 *
 * SETUP:
 * 1. Update SP_SITE_URL and SP_LIBRARY_NAME below
 * 2. Ensure SDK patch is applied (see SHAREPOINT-INTEGRATION-COMPLETE.md)
 * 3. Add file operations to dataSourcesInfo.ts (see guide)
 * 4. Deploy: npm run build && pac code push
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { DocumentsService } from './generated/services/DocumentsService'
import { getClient } from '@microsoft/power-apps/data'
import { dataSourcesInfo } from '../../.power/schemas/appschemas/dataSourcesInfo'
import type { DocumentsRead } from './generated/models/DocumentsModel'

// ============================================================================
// CONFIGURATION — UPDATE THESE FOR YOUR SHAREPOINT
// ============================================================================

const SP_SITE_URL = 'https://184vv.sharepoint.com/sites/sharepoint-upload-poc'
const SP_LIBRARY_NAME = 'Shared Documents'

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

interface FileInfo {
  id: string
  name: string
  displayName: string
  modified: string
  size: number
  identifier: string
}

// ============================================================================
// INITIALIZATION
// ============================================================================

const client = getClient(dataSourcesInfo)
let toastId = 0

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SharePointIntegration() {
  const [files, setFiles] = useState<FileInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ========================================================================
  // NOTIFICATIONS
  // ========================================================================

  const notify = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 30000)
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // ========================================================================
  // FILE OPERATIONS
  // ========================================================================

  /**
   * Convert File to base64 string (without data URI prefix)
   */
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        // Strip "data:<mime>;base64," prefix — send only the base64 payload
        resolve(result.split(',')[1])
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  /**
   * Transform DocumentsService response to simpler format
   */
  const transformDocument = (doc: DocumentsRead): FileInfo => {
    const name = doc['{Name}'] || doc['Title'] || 'Unknown'
    const ext = name.includes('.') ? name.split('.').pop()?.toUpperCase() || '-' : '-'

    return {
      id: String(doc.ID || ''),
      name,
      displayName: doc['{FilenameWithExtension}'] || name,
      modified: doc['Modified'] ? new Date(doc['Modified']).toLocaleString() : '-',
      size: 0,
      identifier: doc['{Identifier}'] || doc['{FullPath}'] || doc['{Path}']
    }
  }

  /**
   * Format file size for display
   */
  const formatFileSize = (bytes: number | undefined | null): string => {
    if (bytes == null || bytes === 0) return '-'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  // ========================================================================
  // FETCH FILES (LIST)
  // ========================================================================

  const fetchFiles = useCallback(async () => {
    try {
      setLoading(true)
      console.log('=== FETCHING DOCUMENTS ===')

      const result = await DocumentsService.getAll()

      console.log('=== FETCH RESULT ===', result)

      if (result.data) {
        const transformed = (result.data as DocumentsRead[]).map(transformDocument)
        setFiles(transformed)
      } else {
        setFiles([])
      }
    } catch (error) {
      console.error('Error fetching files:', error)
      notify('Failed to load documents', 'error')
      setFiles([])
    } finally {
      setLoading(false)
    }
  }, [notify])

  // ========================================================================
  // UPLOAD FILE
  // ========================================================================

  const handleUpload = async () => {
    if (!selectedFile) {
      notify('Please select a file', 'error')
      return
    }

    try {
      setUploading(true)
      console.log('=== UPLOADING FILE ===', { name: selectedFile.name, size: selectedFile.size })

      const base64Content = await readFileAsBase64(selectedFile)

      const result = await client.executeAsync<unknown, unknown>({
        connectorOperation: {
          tableName: 'documents',
          operationName: 'CreateFile',
          parameters: {
            'Content-Type': 'application/octet-stream',  // CRITICAL: triggers SDK patch
            dataset: SP_SITE_URL,                         // SharePoint site URL
            folderPath: '/' + SP_LIBRARY_NAME,
            name: selectedFile.name,
            body: base64Content
          }
        }
      })

      console.log('=== UPLOAD RESULT ===', result)

      if (result.success && result.data) {
        notify(`"${selectedFile.name}" uploaded successfully`, 'success')
        setSelectedFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
        await fetchFiles()
      } else {
        const errorMsg = (result as any)?.error?.message || 'Unknown error'
        notify(`Upload failed: ${errorMsg}`, 'error')
      }
    } catch (error: unknown) {
      console.error('Upload error:', error)
      notify('Upload failed: ' + (error instanceof Error ? error.message : String(error)), 'error')
    } finally {
      setUploading(false)
    }
  }

  // ========================================================================
  // DOWNLOAD FILE
  // ========================================================================

  const handleDownload = async (file: FileInfo) => {
    const fileId = file.identifier || file.id

    if (!fileId) {
      notify('Cannot determine file ID', 'error')
      return
    }

    try {
      console.log('=== DOWNLOADING FILE ===', { id: fileId, name: file.displayName })

      const result = await client.executeAsync<unknown, unknown>({
        connectorOperation: {
          tableName: 'documents',
          operationName: 'GetFileContent',
          parameters: { id: fileId }
        }
      })

      if (result.success && result.data) {
        const base64Data = result.data as string

        // Decode base64 to binary
        let bytes: Uint8Array
        try {
          let decoded = atob(base64Data)

          // Handle legacy double-encoded files
          if (decoded.startsWith('"') && decoded.endsWith('"')) {
            decoded = decoded.slice(1, -1)
          }

          try {
            // Try second decode (legacy double-encoded)
            const binaryString = atob(decoded)
            bytes = new Uint8Array(binaryString.length)
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i)
            }
          } catch {
            // Single-encoded — first decode is the binary
            bytes = new Uint8Array(decoded.length)
            for (let i = 0; i < decoded.length; i++) {
              bytes[i] = decoded.charCodeAt(i)
            }
          }
        } catch {
          // Plain text
          bytes = new TextEncoder().encode(
            typeof base64Data === 'string' ? base64Data : JSON.stringify(base64Data)
          )
        }

        // Trigger download
        const blob = new Blob([bytes as unknown as BlobPart])
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = file.displayName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        notify(`"${file.displayName}" downloaded`, 'success')
      } else {
        notify('Download failed', 'error')
      }
    } catch (error) {
      console.error('Download error:', error)
      notify('Download failed: ' + (error instanceof Error ? error.message : String(error)), 'error')
    }
  }

  // ========================================================================
  // DELETE FILE
  // ========================================================================

  const handleDelete = async (file: FileInfo) => {
    if (!confirm(`Delete "${file.displayName}"?`)) return

    try {
      console.log('=== DELETING FILE ===', { id: file.id, name: file.displayName })

      await DocumentsService.delete(file.id)
      notify(`"${file.displayName}" deleted`, 'success')
      await fetchFiles()
    } catch (error) {
      console.error('Delete error:', error)
      notify('Delete failed: ' + (error instanceof Error ? error.message : String(error)), 'error')
    }
  }

  // ========================================================================
  // LIFECYCLE
  // ========================================================================

  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1>SharePoint Document Manager</h1>

      {/* Upload Section */}
      <section style={{ marginBottom: '30px', padding: '15px', border: '1px solid #ddd', borderRadius: '4px' }}>
        <h2>Upload File</h2>

        <input
          ref={fileInputRef}
          type="file"
          disabled={uploading}
          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
          style={{ marginRight: '10px' }}
        />

        {selectedFile && (
          <span style={{ marginRight: '10px' }}>
            Selected: <strong>{selectedFile.name}</strong> ({(selectedFile.size / 1024).toFixed(1)} KB)
          </span>
        )}

        <button
          onClick={handleUpload}
          disabled={uploading || !selectedFile}
          style={{
            padding: '8px 16px',
            backgroundColor: uploading ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: uploading ? 'not-allowed' : 'pointer'
          }}
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </section>

      {/* Documents List Section */}
      <section style={{ marginBottom: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2>Documents</h2>
          <button
            onClick={fetchFiles}
            disabled={loading}
            style={{
              padding: '8px 16px',
              backgroundColor: loading ? '#ccc' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {loading && files.length === 0 ? (
          <p style={{ color: '#666' }}>Loading documents...</p>
        ) : files.length === 0 ? (
          <p style={{ color: '#666' }}>No documents found.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                <th style={{ padding: '10px', textAlign: 'left' }}>Name</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Modified</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr key={file.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px' }}>{file.displayName}</td>
                  <td style={{ padding: '10px' }}>{file.modified}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    <button
                      onClick={() => handleDownload(file)}
                      style={{
                        padding: '6px 12px',
                        marginRight: '8px',
                        backgroundColor: '#17a2b8',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer'
                      }}
                    >
                      Download
                    </button>
                    <button
                      onClick={() => handleDelete(file)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer'
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Toasts */}
      {toasts.length > 0 && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999 }}>
          {toasts.map(toast => (
            <div
              key={toast.id}
              style={{
                padding: '12px 16px',
                marginBottom: '8px',
                borderRadius: '4px',
                backgroundColor:
                  toast.type === 'success' ? '#d4edda' :
                  toast.type === 'error' ? '#f8d7da' :
                  '#d1ecf1',
                color:
                  toast.type === 'success' ? '#155724' :
                  toast.type === 'error' ? '#721c24' :
                  '#0c5460',
                border:
                  toast.type === 'success' ? '1px solid #c3e6cb' :
                  toast.type === 'error' ? '1px solid #f5c6cb' :
                  '1px solid #bee5eb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                minWidth: '300px'
              }}
            >
              <span>{toast.message}</span>
              <button
                onClick={() => dismissToast(toast.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  fontSize: '18px',
                  marginLeft: '10px'
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
