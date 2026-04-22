import { useEffect, useMemo, useState } from 'react';
import { SharePointService } from './generated/services/SharePointService';

type SharePointRow = {
  id: string;
  name: string;
  modified?: string;
  size?: number;
};

type SharePointListRow = {
  id: string;
  title: string;
  modified?: string;
};

function normalizeSiteUrl(url: string): string {
  const marker = '/SitePages/';
  const index = url.indexOf(marker);
  return index > -1 ? url.slice(0, index) : url;
}

const PROVIDED_SITE_URL = 'https://fncdhabi.sharepoint.com/sites/PMS_Dev/SitePages/CollabHome.aspx';
const DEFAULT_SITE_URL = normalizeSiteUrl(PROVIDED_SITE_URL);
const DEFAULT_LIBRARY = 'Shared Documents';
const DEFAULT_LIST_NAME = 'IssueDetails';

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function pickString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number') return String(value);
  }
  return '';
}

function mapRow(raw: unknown): SharePointRow {
  const row = (raw ?? {}) as Record<string, unknown>;
  return {
    id: pickString(row, ['{Identifier}', 'Identifier', 'Id', 'ID']),
    name: pickString(row, ['{FilenameWithExtension}', 'FileNameWithExtension', '{Name}', 'Name', 'Title']) || 'Unnamed file',
    modified: pickString(row, ['Modified', 'LastModified']),
    size: typeof row['{Size}'] === 'number' ? row['{Size}'] : typeof row['Size'] === 'number' ? row['Size'] : undefined,
  };
}

export default function SharePointIntegration() {
  const [siteUrl, setSiteUrl] = useState(DEFAULT_SITE_URL);
  const [libraryName, setLibraryName] = useState(DEFAULT_LIBRARY);
  const [rows, setRows] = useState<SharePointRow[]>([]);
  const [listName, setListName] = useState(DEFAULT_LIST_NAME);
  const [listRows, setListRows] = useState<SharePointListRow[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const canConnect = useMemo(
    () => siteUrl.includes('sharepoint.com') && libraryName.trim().length > 0,
    [siteUrl, libraryName]
  );

  const fetchListItems = async () => {
    if (!siteUrl.includes('sharepoint.com') || !listName.trim()) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await SharePointService.ODataStyleGetItems(siteUrl.trim(), listName.trim(), undefined, 'Modified desc', 25);
      if (!result.success) throw new Error(result.error?.message ?? `Failed to load ${listName} list items`);
      const items = (result.data?.value ?? []).map((raw) => {
        const row = (raw ?? {}) as Record<string, unknown>;
        return {
          id: pickString(row, ['ID', 'Id', 'id']) || '-',
          title: pickString(row, ['Title', 'title']) || '(no title)',
          modified: pickString(row, ['Modified']),
        };
      });
      setListRows(items);
      setMessage(`Loaded ${items.length} item(s) from ${listName}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Failed to load ${listName}`);
    } finally {
      setBusy(false);
    }
  };

  const fetchFiles = async () => {
    if (!canConnect) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await SharePointService.ODataStyleGetFileItems(siteUrl.trim(), libraryName.trim());
      if (!result.success) throw new Error(result.error?.message ?? 'Failed to load files');
      const items = (result.data?.value ?? []).map(mapRow).filter((item) => item.id);
      setRows(items);
      setMessage(`Loaded ${items.length} file(s) from SharePoint.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load files');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!canConnect) return;
    void fetchFiles();
  }, []);

  const handleUpload = async () => {
    if (!selectedFile) {
      setMessage('Choose a file before uploading.');
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      const base64 = await toBase64(selectedFile);
      const result = await SharePointService.CreateFile(
        siteUrl.trim(),
        `/${libraryName.trim()}`,
        selectedFile.name,
        base64
      );

      if (!result.success) throw new Error(result.error?.message ?? 'Upload failed');

      setSelectedFile(null);
      await fetchFiles();
      setMessage(`Uploaded ${selectedFile.name}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async (row: SharePointRow) => {
    setBusy(true);
    setMessage('');
    try {
      const result = await SharePointService.GetFileContent(siteUrl.trim(), row.id);
      if (!result.success || !result.data) throw new Error(result.error?.message ?? 'Download failed');

      const bin = atob(result.data);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);

      const blob = new Blob([bytes]);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = row.name;
      link.click();
      URL.revokeObjectURL(url);
      setMessage(`Downloaded ${row.name}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Download failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (row: SharePointRow) => {
    const shouldDelete = window.confirm(`Delete "${row.name}" from SharePoint?`);
    if (!shouldDelete) return;

    setBusy(true);
    setMessage('');
    try {
      const result = await SharePointService.DeleteFile(siteUrl.trim(), row.id);
      if (!result.success) throw new Error(result.error?.message ?? 'Delete failed');
      await fetchFiles();
      setMessage(`Deleted ${row.name}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900">SharePoint Files</h3>
      <p className="mt-1 text-sm text-gray-500">Connect your frontend to a SharePoint library.</p>
      <p className="mt-1 text-xs text-gray-500">Configured site: {DEFAULT_SITE_URL}</p>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <input
          value={siteUrl}
          onChange={(e) => setSiteUrl(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="https://tenant.sharepoint.com/sites/site-name"
        />
        <input
          value={libraryName}
          onChange={(e) => setLibraryName(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="Shared Documents"
        />
        <input
          value={listName}
          onChange={(e) => setListName(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="IssueDetails"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input type="file" onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} />
        <button disabled={busy || !canConnect} onClick={fetchFiles} className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white disabled:opacity-50">
          Refresh Files
        </button>
        <button disabled={busy || !siteUrl || !listName} onClick={fetchListItems} className="rounded bg-violet-700 px-3 py-1.5 text-sm text-white disabled:opacity-50">
          Refresh IssueDetails
        </button>
        <button disabled={busy || !canConnect || !selectedFile} onClick={handleUpload} className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50">
          Upload
        </button>
      </div>

      {message && <p className="mt-3 text-sm text-gray-700">{message}</p>}

      <div className="mt-4 overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Modified</th>
              <th className="py-2 pr-4">Size</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-gray-100">
                <td className="py-2 pr-4">{row.name}</td>
                <td className="py-2 pr-4">{row.modified || '-'}</td>
                <td className="py-2 pr-4">{typeof row.size === 'number' ? row.size : '-'}</td>
                <td className="py-2">
                  <div className="flex gap-2">
                    <button onClick={() => handleDownload(row)} className="rounded bg-emerald-600 px-2 py-1 text-xs text-white">
                      Download
                    </button>
                    <button onClick={() => handleDelete(row)} className="rounded bg-red-600 px-2 py-1 text-xs text-white">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="py-3 text-gray-500" colSpan={4}>No files found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 overflow-auto">
        <h4 className="mb-2 text-sm font-semibold text-gray-900">IssueDetails List</h4>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="py-2 pr-4">ID</th>
              <th className="py-2 pr-4">Title</th>
              <th className="py-2 pr-4">Modified</th>
            </tr>
          </thead>
          <tbody>
            {listRows.map((row) => (
              <tr key={`${row.id}-${row.title}`} className="border-b border-gray-100">
                <td className="py-2 pr-4">{row.id}</td>
                <td className="py-2 pr-4">{row.title}</td>
                <td className="py-2 pr-4">{row.modified || '-'}</td>
              </tr>
            ))}
            {listRows.length === 0 && (
              <tr>
                <td className="py-3 text-gray-500" colSpan={3}>No list items loaded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
