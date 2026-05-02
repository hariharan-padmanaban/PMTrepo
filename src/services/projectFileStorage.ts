import { SharePointService } from '../generated/services/SharePointService';

export type ProjectStoredFile = {
  id: string;
  name: string;
  url: string;
  modified?: string;
};

function normalizeSiteUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  try {
    const parsed = new URL(trimmed);
    const pieces = parsed.pathname.split('/').filter(Boolean);
    const siteRootIdx = pieces.findIndex((p) => p.toLowerCase() === 'sites' || p.toLowerCase() === 'teams');
    if (siteRootIdx > -1 && pieces.length > siteRootIdx + 1) {
      return `${parsed.origin}/${pieces.slice(0, siteRootIdx + 2).join('/')}`;
    }
    // Fallback: keep origin + first path segment.
    return `${parsed.origin}/${pieces.slice(0, 1).join('/')}`.replace(/\/+$/, '');
  } catch {
    const marker = '/SitePages/';
    const index = trimmed.indexOf(marker);
    return index > -1 ? trimmed.slice(0, index) : trimmed;
  }
}

function deriveLibraryFromUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url.trim());
    const pieces = parsed.pathname.split('/').filter(Boolean).map((p) => decodeURIComponent(p));
    const siteRootIdx = pieces.findIndex((p) => p.toLowerCase() === 'sites' || p.toLowerCase() === 'teams');
    if (siteRootIdx > -1 && pieces.length > siteRootIdx + 2) {
      const next = pieces[siteRootIdx + 2];
      if (next && next.toLowerCase() !== 'sitepages' && next.toLowerCase() !== 'forms') return next;
    }
  } catch {
    // Ignore parse issues; caller has explicit env fallback.
  }
  return undefined;
}

function sanitizeFolderSegment(value: string): string {
  return value.trim().replace(/[\\/:*?"<>|#%]+/g, '_');
}

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
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return '';
}

function encodePathSegments(path: string): string {
  const parts = path.split('/').filter(Boolean).map((segment) => encodeURIComponent(segment));
  return parts.join('/');
}

export function getProjectAttachmentSiteUrl(): string | undefined {
  const env = (import.meta as { env?: Record<string, string> }).env;
  const configured = env?.VITE_ATTACHMENTS_SITE_URL?.trim() || env?.VITE_REPORT_ATTACHMENTS_SITE_URL?.trim();
  if (!configured) return undefined;
  return normalizeSiteUrl(configured);
}

export function getProjectAttachmentLibraryName(): string {
  const env = (import.meta as { env?: Record<string, string> }).env;
  const explicit = env?.VITE_ATTACHMENTS_LIBRARY?.trim() || env?.VITE_REPORT_ATTACHMENTS_LIBRARY?.trim();
  if (explicit) return explicit;
  const fromSiteUrl = env?.VITE_ATTACHMENTS_SITE_URL?.trim() || env?.VITE_REPORT_ATTACHMENTS_SITE_URL?.trim();
  const derived = fromSiteUrl ? deriveLibraryFromUrl(fromSiteUrl) : undefined;
  return derived || 'Shared Documents';
}

function buildFolderPath(uniqueId: string, libraryName: string): string {
  const safeId = sanitizeFolderSegment(uniqueId);
  return `/${libraryName.replace(/^\/+/, '')}/ProjectAttachments/${safeId}`.replace(/\/\/+/g, '/');
}

function fileWebUrl(siteUrl: string, folderPath: string, fileName: string): string {
  const path = `${folderPath.replace(/^\/+/, '')}/${fileName}`.replace(/\/\/+/g, '/');
  return `${siteUrl.replace(/\/+$/, '')}/${encodePathSegments(path)}`;
}

export async function uploadProjectFiles(
  uniqueId: string,
  files: File[],
): Promise<{ uploaded: string[]; errors: string[] }> {
  const siteUrl = getProjectAttachmentSiteUrl();
  const library = getProjectAttachmentLibraryName();
  const uploaded: string[] = [];
  const errors: string[] = [];

  console.log('📤 uploadProjectFiles started', { uniqueId, fileCount: files.length, siteUrl, library });

  if (!files.length) return { uploaded, errors };
  if (!siteUrl) {
    const msg = 'set VITE_ATTACHMENTS_SITE_URL in environment';
    console.error('❌ Missing SharePoint URL:', msg);
    for (const file of files) errors.push(`${file.name}: ${msg}`);
    return { uploaded, errors };
  }

  const folderPath = buildFolderPath(uniqueId, library);
  console.log('📁 Folder path:', folderPath);

  for (const file of files) {
    try {
      console.log(`📦 Uploading file: ${file.name}`);
      const body = await toBase64(file);
      const res = await SharePointService.CreateFile(siteUrl, folderPath, file.name, body);
      console.log(`Response for ${file.name}:`, res);

      if (!res.success) {
        const errMsg = res.error?.message ?? 'upload failed';
        console.error(`❌ Upload failed for ${file.name}: ${errMsg}`);
        errors.push(`${file.name}: ${errMsg}`);
      } else {
        console.log(`✅ Uploaded: ${file.name}`);
        uploaded.push(file.name);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ Exception for ${file.name}:`, errMsg);
      errors.push(`${file.name}: ${errMsg}`);
    }
  }
  console.log('📤 Upload complete:', { uploaded, errors });
  return { uploaded, errors };
}

export async function listProjectFiles(uniqueId: string): Promise<ProjectStoredFile[]> {
  const siteUrl = getProjectAttachmentSiteUrl();
  if (!siteUrl) return [];

  const library = getProjectAttachmentLibraryName();
  const folderPath = buildFolderPath(uniqueId, library);
  const res = await SharePointService.ODataStyleGetFileItems(siteUrl, library, undefined, 'Modified desc', 200, folderPath);
  if (!res.success) throw new Error(res.error?.message ?? 'Failed to load files');

  const rows = (res.data?.value ?? []) as Array<Record<string, unknown>>;
  return rows.map((row) => {
    const name =
      pickString(row, ['{FilenameWithExtension}', 'FileNameWithExtension', '{Name}', 'Name', 'Title']) || 'Unnamed file';
    const id = pickString(row, ['{Identifier}', 'Identifier', 'Id', 'ID']) || `${uniqueId}-${name}`;
    const modified = pickString(row, ['Modified', 'LastModified']) || undefined;
    return {
      id,
      name,
      modified,
      url: fileWebUrl(siteUrl, folderPath, name),
    };
  });
}
