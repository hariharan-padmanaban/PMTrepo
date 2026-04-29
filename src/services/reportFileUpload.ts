import { SharePointService } from '../generated/services/SharePointService';

function normalizeSiteUrl(url: string): string {
  const marker = '/SitePages/';
  const index = url.indexOf(marker);
  return index > -1 ? url.slice(0, index) : url;
}

/** Site root used for `SharePointService.CreateFile` (same pattern as Vite `import.meta.env`). */
export function getReportAttachmentSiteUrl(): string | undefined {
  const env = (import.meta as { env?: Record<string, string> }).env?.VITE_REPORT_ATTACHMENTS_SITE_URL?.trim();
  if (env) return normalizeSiteUrl(env);
  return undefined;
}

export function getReportAttachmentLibraryName(): string {
  return (import.meta as { env?: Record<string, string> }).env?.VITE_REPORT_ATTACHMENTS_LIBRARY?.trim() || 'Shared Documents';
}

function fileToBase64(file: File): Promise<string> {
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

/**
 * Uploads files under `/Library/ReportAttachments/{reportId}/` in SharePoint.
 * Requires `VITE_REPORT_ATTACHMENTS_SITE_URL` (e.g. https://tenant.sharepoint.com/sites/SiteName).
 * Dataverse `new_report` has no file column in the generated app schema; notes/annotations are not
 * a registered data source, so this connector path is the supported way to get working binaries.
 */
export async function uploadFilesForReport(
  reportId: string,
  files: File[],
  options?: { siteUrl?: string; libraryName?: string },
): Promise<{ uploaded: string[]; errors: string[] }> {
  const site = options?.siteUrl ?? getReportAttachmentSiteUrl();
  const uploaded: string[] = [];
  const errors: string[] = [];
  if (files.length === 0) return { uploaded, errors };
  if (!site) {
    for (const f of files) errors.push(`${f.name}: set VITE_REPORT_ATTACHMENTS_SITE_URL in .env to enable upload`);
    return { uploaded, errors };
  }
  const lib = (options?.libraryName ?? getReportAttachmentLibraryName()).replace(/^\/+/, '');
  const folder = `/${lib}/ReportAttachments/${reportId}`.replace(/\/\/+/g, '/');

  for (const f of files) {
    try {
      const body = await fileToBase64(f);
      const r = await SharePointService.CreateFile(site, folder, f.name, body);
      if (r.success) uploaded.push(f.name);
      else errors.push(`${f.name}: ${r.error?.message ?? 'upload failed'}`);
    } catch (e) {
      errors.push(`${f.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { uploaded, errors };
}
