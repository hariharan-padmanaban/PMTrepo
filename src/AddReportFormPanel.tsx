/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Paperclip, Trash2 } from 'lucide-react';
import { enj } from './ui/enjForm';
import { New_programsService } from './generated/services/New_programsService';
import { New_projectsService } from './generated/services/New_projectsService';
import { New_programsnew_status } from './generated/models/New_programsModel';
import { New_reportsService } from './generated/services/New_reportsService';
import { EnjazMasterDataService, type EnjazMasterDataRow } from './services/EnjazMasterDataService';
import { NewUsersService } from './services/NewUsersService';
import { sendEmailNotification, generateEmailTemplate } from './services/PMTMailNotificationService';
import { uploadFilesForReport } from './services/reportFileUpload';
import type { ToastType } from './NotificationToast';
import { buildProgramIdToNameMap, resolveProjectProgramName } from './programNameResolve';

/** Dataverse `new_role` = Business (Users). */
const USERS_BUSINESS_ROLE = 100000001;

function isUserBusinessRoleRow(u: Record<string, unknown>): boolean {
  return String(u.new_role ?? '') === String(USERS_BUSINESS_ROLE) || String(u.new_rolename ?? '').toLowerCase() === 'business';
}

function getProgramNameFromProgramRow(p: Record<string, unknown>): string {
  return String(p.new_name ?? '').trim();
}

function getProgramIdFromRow(p: Record<string, unknown> | undefined): string {
  if (!p) return '';
  return String(p.new_programid ?? '').trim();
}

function getProgramStatusLabelFromRow(p: Record<string, unknown> | undefined): string {
  if (!p) return '';
  for (const k of [
    'new_programstatusname',
    'new_statusname',
    'new_programstatus@OData.Community.Display.V1.FormattedValue',
    'new_status@OData.Community.Display.V1.FormattedValue',
  ]) {
    const v = p[k as keyof typeof p];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  const raw = p.new_programstatus ?? p.new_status;
  if (raw === undefined || raw === null) return '';
  if (typeof raw === 'object') return String(raw).trim();
  const n = typeof raw === 'number' ? raw : /^\d+$/.test(String(raw)) ? Number(raw) : NaN;
  if (!Number.isNaN(n) && (n as keyof typeof New_programsnew_status) in New_programsnew_status) {
    return New_programsnew_status[n as keyof typeof New_programsnew_status];
  }
  return String(raw).trim();
}

function getProjectRowProjectNameField(p: Record<string, unknown>): string {
  return String(p.new_projectname ?? p.new_name ?? '').trim();
}

function getProjectRowSector(p: Record<string, unknown> | undefined): string {
  if (!p) return '';
  const formatted = (key: string) => {
    const v = p[key];
    return typeof v === 'string' && v.trim() ? v.trim() : '';
  };
  for (const key of [
    'new_sectorname',
    'new_sector@OData.Community.Display.V1.FormattedValue',
    'crcf8_sectorname',
    'crcf8_sector@OData.Community.Display.V1.FormattedValue',
  ]) {
    const s = formatted(key);
    if (s) return s;
  }
  const v = p.new_sector ?? p.crcf8_sector;
  if (v === undefined || v === null) return '';
  if (typeof v === 'object' && v !== null && 'name' in (v as object)) {
    return String((v as { name?: string }).name ?? '').trim();
  }
  return String(v).trim();
}

function getProjectAssignToManagerDisplay(p: Record<string, unknown> | undefined): string {
  if (!p) return '';
  return String(
    p.crcf8_projectmanager ?? p.new_programmanager ?? p.crcf8_projectmanagername ?? p.new_projectmanagername ?? '',
  )
    .trim();
}

type AddReportFormPanelProps = {
  onClose: () => void;
  sectionClassName?: string;
  onNotify?: (type: ToastType, message: string) => void;
};

/**
 * Add Report — report title & type first, then program / project, sector from project row(s) matching
 * project + program, assign (Business), remark/summary, attachments. Sector options = `new_project` sector
 * for the selected project name.
 */
export function AddReportFormPanel({
  onClose,
  sectionClassName = 'bg-white rounded-xl p-6 shadow-sm max-w-4xl mx-auto w-full',
  onNotify,
}: AddReportFormPanelProps) {
  const [programName, setProgramName] = useState('');
  const [reportType, setReportType] = useState('');
  const [projectName, setProjectName] = useState('');
  const [sector, setSector] = useState('');
  const [assignMember, setAssignMember] = useState('');
  const [reportTitle, setReportTitle] = useState('');
  const [remark, setRemark] = useState('');
  const [summary, setSummary] = useState('');
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [programOptions, setProgramOptions] = useState<string[]>([]);
  const [programTableRows, setProgramTableRows] = useState<Array<Record<string, unknown>>>([]);
  const [projectRows, setProjectRows] = useState<Array<Record<string, unknown>>>([]);
  const [reportTypeOptions, setReportTypeOptions] = useState<EnjazMasterDataRow[]>([]);
  const [businessEmails, setBusinessEmails] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const programIdToName = useMemo(() => buildProgramIdToNameMap(programTableRows), [programTableRows]);

  const clip = (s: string, max: number) => (s.length <= max ? s : s.slice(0, Math.max(0, max - 1)) + '…');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [programsRes, projectsRes, reportTypesRes, usersRes] = await Promise.all([
          New_programsService.getAll({ top: 500, orderBy: ['new_name asc'] }),
          New_projectsService.getAll({ top: 500, orderBy: ['createdon desc'] }),
          EnjazMasterDataService.getActiveReportTypeMasterRows(),
          NewUsersService.getAll({ top: 500, orderBy: ['createdon desc'] }),
        ]);
        if (cancelled) return;

        const pRows = (programsRes.success ? programsRes.data : []) as unknown as Array<Record<string, unknown>>;
        setProgramTableRows(pRows);
        const programNames = Array.from(
          new Set(pRows.map((p) => getProgramNameFromProgramRow(p)).filter(Boolean)),
        ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        setProgramOptions(programNames);
        setProjectRows((projectsRes.success ? projectsRes.data : []) as unknown as Array<Record<string, unknown>>);
        setReportTypeOptions(reportTypesRes.success ? (reportTypesRes.data ?? []) : []);
        if (!reportTypesRes.success) {
          setLoadError(
            (reportTypesRes as { error?: { message?: string } }).error?.message ?? 'Failed to load report types.',
          );
        }
        const userRows = (usersRes.success ? usersRes.data : []) as Array<Record<string, unknown>>;
        setBusinessEmails(
          Array.from(
            new Set(
              userRows
                .filter(isUserBusinessRoleRow)
                .map((u) => String(u.new_newcolumn ?? u.new_userid ?? '').trim())
                .filter(Boolean),
            ),
          ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
        );
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Failed to load form');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const programMeta = useMemo(() => {
    const key = programName.trim().toLowerCase();
    if (!key) return { id: '', statusForPayload: '' };
    const row = programTableRows.find((p) => getProgramNameFromProgramRow(p).toLowerCase() === key);
    if (!row) return { id: '', statusForPayload: '' };
    const id = getProgramIdFromRow(row);
    const statusLabel = getProgramStatusLabelFromRow(row);
    const statusForPayload = statusLabel || String(row.new_programstatus ?? row.new_status ?? '').trim();
    return { id, statusForPayload };
  }, [programTableRows, programName]);

  const projectRowsForSelectedName = useMemo(() => {
    const pn = programName.trim().toLowerCase();
    const jn = projectName.trim().toLowerCase();
    if (!pn || !jn) return [] as Array<Record<string, unknown>>;
    return projectRows.filter(
      (row) =>
        resolveProjectProgramName(row, programIdToName).toLowerCase() === pn &&
        getProjectRowProjectNameField(row).toLowerCase() === jn,
    );
  }, [projectRows, programName, projectName, programIdToName]);

  const sectorFromLookup = useMemo(() => {
    for (const row of projectRowsForSelectedName) {
      const s = getProjectRowSector(row);
      if (s) return s;
    }
    return '';
  }, [projectRowsForSelectedName]);

  const sectorOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of projectRowsForSelectedName) {
      const s = getProjectRowSector(row);
      if (s) set.add(s);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [projectRowsForSelectedName]);

  const sectorDropdownOptions = useMemo(() => {
    const s = new Set(sectorOptions);
    if (sector && !s.has(sector)) s.add(sector);
    if (sectorFromLookup && !s.has(sectorFromLookup)) s.add(sectorFromLookup);
    return Array.from(s).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [sectorOptions, sector, sectorFromLookup]);

  useEffect(() => {
    if (sectorFromLookup) setSector(sectorFromLookup);
    else setSector('');
  }, [sectorFromLookup]);

  const projectNameOptions = useMemo(() => {
    const pn = programName.trim().toLowerCase();
    if (!pn) return [];
    const set = new Set<string>();
    projectRows.forEach((row) => {
      if (resolveProjectProgramName(row, programIdToName).toLowerCase() !== pn) return;
      const n = getProjectRowProjectNameField(row);
      if (n) set.add(n);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [projectRows, programName, programIdToName]);

  const assignOptions = useMemo(() => {
    const emails = [...businessEmails];
    if (assignMember && !emails.includes(assignMember)) emails.unshift(assignMember);
    return emails;
  }, [businessEmails, assignMember]);

  useEffect(() => {
    setProjectName('');
    setAssignMember('');
  }, [programName]);

  useEffect(() => {
    if (!programName.trim() || !projectName.trim()) {
      if (!projectName.trim()) setAssignMember('');
      return;
    }
    const p = programName.trim().toLowerCase();
    const j = projectName.trim().toLowerCase();
    const row = projectRows.find(
      (r) =>
        resolveProjectProgramName(r, programIdToName).toLowerCase() === p && getProjectRowProjectNameField(r).toLowerCase() === j,
    );
    const def = getProjectAssignToManagerDisplay(row);
    if (def) setAssignMember(def);
    else setAssignMember('');
  }, [programName, projectName, projectRows, programIdToName]);

  const addFilesFromList = (list: FileList | File[]) => {
    const next = Array.from(list);
    if (next.length === 0) return;
    setAttachmentFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      const merged = [...prev];
      for (const f of next) {
        if (!names.has(f.name)) {
          names.add(f.name);
          merged.push(f);
        }
      }
      return merged;
    });
  };

  const runValidation = (forSubmit: boolean) => {
    const nextErrors: Record<string, string> = {};
    if (!reportTitle.trim()) nextErrors.reportTitle = 'Report title is required';
    if (!reportType.trim()) nextErrors.reportType = 'Report Type is required';
    if (!programName.trim()) nextErrors.programName = 'Program Name is required';
    if (!projectName.trim()) nextErrors.projectName = 'Project Name is required';
    if (forSubmit && !assignMember.trim()) nextErrors.assignMember = 'Assign to management member is required';
    if (forSubmit && !sector.trim()) nextErrors.sector = 'Sector is required';
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      onNotify?.('error', 'Please fill all required fields.');
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSendReport = async () => {
    if (!runValidation(true) || saving) return;
    setSaving(true);
    const newId = (globalThis.crypto?.randomUUID?.() ?? `RPT-${Date.now()}`).toLowerCase();
    const attachmentId = attachmentFiles.length > 0 ? `ATT-${Date.now()}` : undefined;
    const payload: Record<string, unknown> = {
      new_reportid: newId,
      new_report1: clip(reportTitle.trim(), 850),
      new_program: clip(programName.trim(), 100),
      new_projectname: clip(projectName.trim(), 100),
      new_reporttype: clip(reportType.trim(), 100),
      new_assigntomanagementmember: clip(assignMember.trim(), 100),
      new_remark: remark.trim() ? clip(remark.trim(), 100) : undefined,
      new_summary: summary.trim() ? clip(summary.trim(), 100) : undefined,
      new_sector: clip(sector.trim(), 100),
      statecode: 0,
    };
    if (programMeta.id) payload.new_programid = clip(programMeta.id, 100);
    if (programMeta.statusForPayload) payload.new_programstatus = clip(programMeta.statusForPayload, 100);
    if (attachmentId) payload.new_attachmentid = attachmentId;
    try {
      const res = await New_reportsService.create(
        payload as unknown as Parameters<typeof New_reportsService.create>[0],
      );
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to create report in Dataverse');

      // Send email notification for new report
      if (assignMember && assignMember.includes('@')) {
        const emailTemplate = generateEmailTemplate(
          'New Report Created',
          'Dear Team,',
          'A new report has been created in the system. Please review the details below.',
          [
            { label: 'Report Title', value: reportTitle },
            { label: 'Report Type', value: reportType },
            { label: 'Program', value: programName },
            { label: 'Project', value: projectName },
            { label: 'Summary', value: summary.substring(0, 100) || '-' },
            { label: 'Assigned To', value: assignMember },
          ],
        );

        sendEmailNotification({
          toEmail: assignMember,
          subject: `New Report Created: ${reportTitle}`,
          htmlBody: emailTemplate,
        }).catch((err) => {
          console.error('Failed to send report creation email:', err);
        });
      }

      if (attachmentId && attachmentFiles.length > 0) {
        void uploadFilesForReport(attachmentId, attachmentFiles);
      }

      onNotify?.('success', 'Report saved successfully.');
      onClose();
    } catch (e) {
      onNotify?.('error', e instanceof Error ? e.message : 'Failed to save report');
    } finally {
      setSaving(false);
    }
  };

  const inputSelectCls = 'mt-1 h-9 w-full rounded-md border border-gray-200 px-3 text-sm text-gray-800';
  const inputTextCls = 'mt-1 h-9 w-full rounded-md border border-gray-200 px-3 text-sm text-gray-800';

  return (
    <section className={sectionClassName}>
      <p className="text-[16px] font-bold text-primary mb-5">
        <button type="button" className="underline text-primary font-semibold" onClick={onClose}>
          Reports
        </button>
        {' > '}Create New Report
      </p>
      {loadError && <p className="text-sm text-rose-600 mb-2">{loadError}</p>}
      {loading && <p className="text-sm text-gray-500 mb-2">Loading…</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
        <label>
          <span className="text-[11px] text-gray-500">Report title <span className="text-rose-500">*</span></span>
          <input
            className={inputTextCls}
            placeholder="Enter report title"
            value={reportTitle}
            onChange={(e) => {
              setReportTitle(e.target.value);
              setErrors((prev) => ({ ...prev, reportTitle: '' }));
            }}
            disabled={loading}
          />
          {errors.reportTitle && <p className="mt-1 text-[11px] text-rose-600">{errors.reportTitle}</p>}
        </label>
        <label>
          <span className="text-[11px] text-gray-500">Report Type <span className="text-rose-500">*</span></span>
          <select
            className={inputSelectCls}
            value={reportType}
            onChange={(e) => {
              setReportType(e.target.value);
              setErrors((prev) => ({ ...prev, reportType: '' }));
            }}
            disabled={loading}
          >
            <option value="">Select report type</option>
            {reportTypeOptions
              .filter((row) => String(row.new_enjazmasterdata1 ?? '').trim())
              .map((row) => {
                const id = String(row.new_enjazmasterdataid ?? row.new_enjazmasterdata1);
                const lab = String(row.new_enjazmasterdata1 ?? '').trim();
                return (
                  <option key={id} value={lab}>
                    {lab}
                  </option>
                );
              })}
          </select>
          {errors.reportType && <p className="mt-1 text-[11px] text-rose-600">{errors.reportType}</p>}
        </label>
        <label>
          <span className="text-[11px] text-gray-500">Program Name <span className="text-rose-500">*</span></span>
          <select
            className={inputSelectCls}
            value={programName}
            onChange={(e) => {
              setProgramName(e.target.value);
              setErrors((prev) => ({ ...prev, programName: '' }));
            }}
            disabled={loading}
          >
            <option value="">Select program</option>
            {programOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          {errors.programName && <p className="mt-1 text-[11px] text-rose-600">{errors.programName}</p>}
        </label>
        <label>
          <span className="text-[11px] text-gray-500">Project Name <span className="text-rose-500">*</span></span>
          <select
            className={inputSelectCls}
            value={projectName}
            onChange={(e) => {
              setProjectName(e.target.value);
              setErrors((prev) => ({ ...prev, projectName: '' }));
            }}
            disabled={loading || !programName.trim()}
          >
            <option value="">
              {!programName.trim()
                ? 'Select program first'
                : projectNameOptions.length > 0
                  ? 'Select project'
                  : 'No projects for this program name'}
            </option>
            {projectNameOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          {errors.projectName && <p className="mt-1 text-[11px] text-rose-600">{errors.projectName}</p>}
        </label>
        <label>
          <span className="text-[11px] text-gray-500">Sector <span className="text-rose-500">*</span></span>
          <select
            className={inputSelectCls}
            value={sector}
            onChange={(e) => {
              setSector(e.target.value);
              setErrors((prev) => ({ ...prev, sector: '' }));
            }}
            disabled={loading || !programName.trim() || !projectName.trim()}
          >
            <option value="">
              {!projectName.trim()
                ? 'Select project first'
                : sectorDropdownOptions.length > 0
                  ? 'Select sector'
                  : 'No sector on project rows'}
            </option>
            {sectorDropdownOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {errors.sector && <p className="mt-1 text-[11px] text-rose-600">{errors.sector}</p>}
        </label>
        <label>
          <span className="text-[11px] text-gray-500">Assign to management member <span className="text-rose-500">*</span></span>
          <select
            className={inputSelectCls}
            value={assignMember}
            onChange={(e) => {
              setAssignMember(e.target.value);
              setErrors((prev) => ({ ...prev, assignMember: '' }));
            }}
            disabled={loading}
          >
            <option value="">Select member</option>
            {assignOptions.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          {errors.assignMember && <p className="mt-1 text-[11px] text-rose-600">{errors.assignMember}</p>}
        </label>
        <div className="md:col-span-2">
          <label>
            <span className="text-[11px] text-gray-500">Remark</span>
            <input
              className={inputTextCls}
              placeholder="Enter remarks"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              disabled={loading}
              maxLength={100}
            />
          </label>
        </div>
        <div className="md:col-span-2">
          <label>
            <span className="text-[11px] text-gray-500">Summary</span>
            <textarea
              className="mt-1 w-full h-16 rounded-md border border-gray-200 px-3 py-2 text-sm resize-none"
              placeholder="Enter summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              disabled={loading}
              maxLength={100}
            />
          </label>
        </div>
        <div className="md:col-span-2">
          <label className="text-[11px] font-medium text-secondary mb-1 block">Add attachments</label>
          <input
            ref={fileInputRef}
            type="file"
            className="sr-only"
            multiple
            disabled={saving}
            onChange={(e) => {
              if (e.target.files?.length) addFilesFromList(e.target.files);
              e.target.value = '';
            }}
          />
          <div className="rounded-lg border border-[#d6dbe8] bg-white p-4">
            {attachmentFiles.length === 0 ? (
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-3">There is nothing attached.</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={saving}
                  className="inline-flex items-center gap-2 text-sm font-semibold hover:opacity-80 disabled:opacity-50"
                  style={{ color: '#A08149' }}
                >
                  <Paperclip size={16} />
                  Attach file
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-2">Files to upload</p>
                  <ul className="space-y-1">
                    {attachmentFiles.map((file) => (
                      <li key={file.name} className="flex items-center justify-between gap-2 text-xs text-gray-700">
                        <span className="truncate">{file.name}</span>
                        <button
                          type="button"
                          className="text-rose-600 shrink-0 hover:opacity-80"
                          disabled={saving}
                          onClick={() => setAttachmentFiles((prev) => prev.filter((x) => x.name !== file.name))}
                          title="Remove"
                        >
                          <Trash2 size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="pt-2 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={saving}
                    className="inline-flex items-center gap-2 text-xs font-semibold hover:opacity-80 disabled:opacity-50"
                    style={{ color: '#A08149' }}
                  >
                    <Paperclip size={14} />
                    Attach more
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-end gap-3">
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 hover:border-rose-400 hover:text-rose-500 transition-colors"
          onClick={onClose}
          disabled={saving}
          title="Close"
        >
          <X size={15} />
        </button>
        <button
          type="button"
          className={enj.btnOutline}
          onClick={() => {
            if (runValidation(false)) onNotify?.('info', 'Required fields are set. Use Send Report to save to Dataverse.');
          }}
          disabled={saving}
        >
          Review
        </button>
        <button
          type="button"
          className={enj.btnPrimary}
          onClick={() => void handleSendReport()}
          disabled={saving || loading}
        >
          {saving ? 'Saving…' : 'Send Report'}
        </button>
      </div>
    </section>
  );
}
