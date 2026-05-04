import { SharePointService } from '../generated/services/SharePointService';

function normalizeSiteUrl(url: string): string {
  const marker = '/SitePages/';
  const index = url.indexOf(marker);
  return index > -1 ? url.slice(0, index) : url;
}

/** Site root used for `SharePointService.CreateFile` (same pattern as Vite `import.meta.env`). */
export function getIssueAttachmentSiteUrl(): string | undefined {
  const env = (import.meta as { env?: Record<string, string> }).env?.VITE_ISSUE_ATTACHMENTS_SITE_URL?.trim();
  if (env) return normalizeSiteUrl(env);
  // Fall back to report attachments site if issue-specific one is not set
  const reportEnv = (import.meta as { env?: Record<string, string> }).env?.VITE_REPORT_ATTACHMENTS_SITE_URL?.trim();
  if (reportEnv) return normalizeSiteUrl(reportEnv);
  return undefined;
}

export function getIssueAttachmentLibraryName(): string {
  return (import.meta as { env?: Record<string, string> }).env?.VITE_ISSUE_ATTACHMENTS_LIBRARY?.trim() || 'Shared Documents';
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
 * Uploads files under `/Library/IssueAttachments/{issueId}/` in SharePoint.
 * Requires `VITE_ISSUE_ATTACHMENTS_SITE_URL` or falls back to `VITE_REPORT_ATTACHMENTS_SITE_URL`.
 */
export async function uploadFilesForIssue(
  issueId: string,
  files: File[],
  options?: { siteUrl?: string; libraryName?: string },
): Promise<{ uploaded: string[]; errors: string[] }> {
  const site = options?.siteUrl ?? getIssueAttachmentSiteUrl();
  const uploaded: string[] = [];
  const errors: string[] = [];
  if (files.length === 0) return { uploaded, errors };
  if (!site) {
    for (const f of files) errors.push(`${f.name}: set VITE_ISSUE_ATTACHMENTS_SITE_URL in .env to enable upload`);
    return { uploaded, errors };
  }
  const lib = (options?.libraryName ?? getIssueAttachmentLibraryName()).replace(/^\/+/, '');
  const folder = `/${lib}/IssueAttachments/${issueId}`.replace(/\/\/+/g, '/');

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
