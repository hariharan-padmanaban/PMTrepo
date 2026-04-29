import { useEffect, useMemo, useState } from 'react';
import { New_issuesnew_issueseverity, New_issuesnew_issuestatus } from './generated/models/New_issuesModel';
import { New_issuesService } from './generated/services/New_issuesService';
import { New_projectsService } from './generated/services/New_projectsService';
import { NewUsersService } from './services/NewUsersService';
import type { ToastType } from './NotificationToast';
import { ScreenLoader } from './ScreenLoader';
import { enj } from './ui/enjForm';
import { getSessionUserEmail } from './sessionUser';

type Props = {
  onClose: () => void;
  onNotify?: (type: ToastType, message: string) => void;
  onSaved?: () => void;
  issueToEdit?: Record<string, unknown> | null;
};

type ProjectRow = Record<string, unknown>;
type UserRow = Record<string, unknown>;

const ISSUE_SEVERITIES = ['High', 'Medium', 'Low'] as const;
const ISSUE_STATUSES = ['Open', 'Solved'] as const;
const PROJECT_SPONSOR_OPTIONS = ['Sales', 'HR', 'Development', 'Marketing', 'Legal Affairs'] as const;
const ISSUE_SEVERITY_TO_CHOICE: Record<(typeof ISSUE_SEVERITIES)[number], number> = {
  High: 100000002,
  Medium: 100000001,
  Low: 100000000,
};
const ISSUE_STATUS_TO_CHOICE: Record<(typeof ISSUE_STATUSES)[number], number> = {
  Open: 100000000,
  Solved: 100000002, // Dataverse label is "Resolved"
};

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );
}

function readProjectName(row: ProjectRow): string {
  return String(row.new_projectname ?? row.new_name ?? '').trim();
}

function getProjectAssignToManagerEmail(p: ProjectRow): string {
  const m = p.new_projectmanager;
  if (m && typeof m === 'object') {
    const o = m as Record<string, unknown>;
    const a = o.internalemailaddress ?? o.emailaddress1 ?? o.primaryemail;
    if (typeof a === 'string' && a.includes('@')) return a.trim().toLowerCase();
  }
  const raw =
    p.new_assigntoprojectmanager ??
    p.crcf8_assigntoprojectmanager ??
    p.crcf8_projectmanager ??
    p.new_programmanager ??
    p.crcf8_projectmanagername ??
    p.new_programmanagername ??
    (typeof m === 'string' ? m : '') ??
    p.new_projectmanagername ??
    '';
  const s = String(raw ?? '').trim();
  return s.includes('@') ? s.toLowerCase() : s.toLowerCase();
}

function isUserTeamRole(u: UserRow): boolean {
  const roleName = String(u.new_rolename ?? '').trim().toLowerCase();
  if (roleName === 'team') return true;
  const roleRaw = String(u.new_role ?? '').trim();
  if (roleRaw.toLowerCase() === 'team') return true;
  const roleNum = Number(roleRaw);
  if (Number.isFinite(roleNum) && roleNum === 100000004) return true; // common Team choice value
  return false;
}

export function AddIssueFormPanel({ onClose, onNotify, onSaved, issueToEdit }: Props) {
  const [projectName, setProjectName] = useState('');
  const [issueTitle, setIssueTitle] = useState('');
  const [issueOwner, setIssueOwner] = useState('');
  const [issueSeverity, setIssueSeverity] = useState('');
  const [assignTeamMember, setAssignTeamMember] = useState('');
  const [issueStatus, setIssueStatus] = useState('');
  const [projectSponsor, setProjectSponsor] = useState('');
  const [progress, setProgress] = useState('');
  const [raisedIssue, setRaisedIssue] = useState('');
  const [issueResponse, setIssueResponse] = useState('');
  const [issueImpactedArea, setIssueImpactedArea] = useState('');
  const [issueDescription, setIssueDescription] = useState('');

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [projectsRes, usersRes] = await Promise.all([
          New_projectsService.getAll({ top: 1000, orderBy: ['createdon desc'] }),
          NewUsersService.getAll({ top: 1000, orderBy: ['createdon desc'] }),
        ]);
        if (cancelled) return;
        setProjects((projectsRes.success ? projectsRes.data : []) as unknown as ProjectRow[]);
        setUsers((usersRes.success ? usersRes.data : []) as unknown as UserRow[]);
      } catch {
        if (!cancelled) onNotify?.('error', 'Failed to load issue form options.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onNotify]);

  const projectNameOptions = useMemo(() => {
    const sessionEmail = getSessionUserEmail()?.toLowerCase();
    if (!sessionEmail) return uniqueSorted(projects.map(readProjectName));
    const mine = projects.filter((p) => getProjectAssignToManagerEmail(p) === sessionEmail);
    const base = mine.length > 0 ? mine : projects;
    return uniqueSorted(base.map(readProjectName));
  }, [projects]);

  const teamDepartmentEmails = useMemo(() => {
    return uniqueSorted(
      users
        .filter(isUserTeamRole)
        .map((u) => String(u.new_newcolumn ?? u.new_userid ?? '').trim())
        .filter((v) => v.includes('@')),
    );
  }, [users]);
  const teamMemberOptions = teamDepartmentEmails;
  const ownerOptions = teamDepartmentEmails;

  useEffect(() => {
    if (!issueToEdit) {
      setProjectName('');
      setIssueTitle('');
      setIssueOwner('');
      setIssueSeverity('');
      setAssignTeamMember('');
      setIssueStatus('');
      setProjectSponsor('');
      setProgress('');
      setRaisedIssue('');
      setIssueResponse('');
      setIssueImpactedArea('');
      setIssueDescription('');
      return;
    }
    setProjectName(String(issueToEdit.new_projectname ?? ''));
    setIssueTitle(String(issueToEdit.new_issuetitle ?? ''));
    setIssueOwner(String(issueToEdit.new_issueowner ?? ''));
    const sevRaw = Number(issueToEdit.new_issueseverity ?? NaN);
    setIssueSeverity(sevRaw === 100000002 ? 'High' : sevRaw === 100000001 ? 'Medium' : 'Low');
    setAssignTeamMember(String(issueToEdit.new_assigntoteammember ?? ''));
    const stRaw = Number(issueToEdit.new_issuestatus ?? NaN);
    setIssueStatus(stRaw === 100000002 ? 'Solved' : 'Open');
    setProjectSponsor(String(issueToEdit.new_projectsponsor ?? ''));
    setProgress(String(issueToEdit.new_progress ?? ''));
    setRaisedIssue(String(issueToEdit.new_raisedissue ?? ''));
    setIssueResponse(String(issueToEdit.new_issueresponse ?? ''));
    setIssueImpactedArea(String(issueToEdit.new_issueimpactedarea ?? ''));
    setIssueDescription(String(issueToEdit.new_description ?? ''));
  }, [issueToEdit]);

  const save = async () => {
    const nextErrors: Record<string, string> = {};
    if (!projectName) nextErrors.projectName = 'Project Name is required';
    if (!issueTitle.trim()) nextErrors.issueTitle = 'Issue Title is required';
    if (!issueOwner) nextErrors.issueOwner = 'Issue Owner is required';
    if (!issueSeverity) nextErrors.issueSeverity = 'Issue Severity is required';
    if (!assignTeamMember) nextErrors.assignTeamMember = 'Assign To TeamMember is required';
    if (!issueStatus) nextErrors.issueStatus = 'Issue Status is required';
    if (!issueResponse.trim()) nextErrors.issueResponse = 'Issue Response is required';
    if (!issueImpactedArea.trim()) nextErrors.issueImpactedArea = 'Issue Impacted Area is required';
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      onNotify?.('error', 'Please fill all required fields.');
      return;
    }
    setErrors({});
    const sev = ISSUE_SEVERITY_TO_CHOICE[issueSeverity as (typeof ISSUE_SEVERITIES)[number]];
    const st = ISSUE_STATUS_TO_CHOICE[issueStatus as (typeof ISSUE_STATUSES)[number]];
    if (sev === undefined || st === undefined) {
      onNotify?.('error', 'Invalid issue severity or status.');
      return;
    }
    const progressTrim = progress.trim();
    if (progressTrim) {
      if (!/^\d{1,3}$/.test(progressTrim)) {
        onNotify?.('error', 'Progress must contain only digits (max 3).');
        return;
      }
      const progressNumCheck = Number(progressTrim);
      if (!Number.isFinite(progressNumCheck) || progressNumCheck > 100) {
        onNotify?.('error', 'Progress must be less than or equal to 100.');
        return;
      }
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        new_projectname: projectName.trim(),
        new_issuetitle: issueTitle.trim(),
        new_issueowner: issueOwner.trim(),
        new_issueseverity: sev as keyof typeof New_issuesnew_issueseverity,
        new_assigntoteammember: assignTeamMember.trim(),
        new_issuestatus: st as keyof typeof New_issuesnew_issuestatus,
        new_projectsponsor: projectSponsor.trim() || undefined,
        new_raisedissue: raisedIssue.trim() || undefined,
        new_issueresponse: issueResponse.trim(),
        new_issueimpactedarea: issueImpactedArea.trim(),
        new_description: issueDescription.trim() || undefined,
        statecode: st === 100000002 ? 1 : 0,
      };
      const progressNum = Number(progressTrim);
      if (progressTrim) payload.new_progress = progressNum;

      if (issueToEdit?.new_issueid) {
        const res = await New_issuesService.update(
          String(issueToEdit.new_issueid),
          payload as unknown as Parameters<typeof New_issuesService.update>[1],
        );
        if (!res.success) throw new Error(res.error?.message ?? 'Failed to update issue');
        onNotify?.('success', 'Issue updated successfully.');
      } else {
        // Raised date is set only when the issue is first created.
        payload.new_issuedate = new Date().toISOString();
        const res = await New_issuesService.create(
          payload as unknown as Parameters<typeof New_issuesService.create>[0],
        );
        if (!res.success) throw new Error(res.error?.message ?? 'Failed to save issue');
        onNotify?.('success', 'Issue saved successfully.');
      }
      onSaved?.();
      onClose();
    } catch (e) {
      onNotify?.('error', e instanceof Error ? e.message : 'Failed to save issue');
    } finally {
      setSaving(false);
    }
  };

  const req = (label: string) => (
    <span className="text-[11px] text-gray-600 mb-1 block">
      {label} <span className="text-rose-500">*</span>
    </span>
  );

  const opt = (label: string) => <span className="text-[11px] text-gray-600 mb-1 block">{label}</span>;
  const controlCls = enj.control;
  const inputCls = enj.control;
  const areaCls = `${enj.textarea} h-20 min-h-[4.5rem] resize-none`;

  return (
    <section className="relative bg-white rounded-xl p-5 shadow-sm max-w-6xl mx-auto">
      {loading && <ScreenLoader overlay />}
      <p className="text-sm font-semibold text-primary mb-4">
        <button className="underline text-primary font-semibold" onClick={onClose} type="button">
          Issue
        </button>
        {' > '}{issueToEdit ? 'Edit Issue' : 'Add New Issue'}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
        <label>
          {req('Project Name')}
          <select
            className={controlCls}
            value={projectName}
            onChange={(e) => {
              setProjectName(e.target.value);
              setAssignTeamMember('');
              setErrors((prev) => ({ ...prev, projectName: '' }));
            }}
            disabled={loading || saving}
          >
            <option value="">Select project</option>
            {projectNameOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          {errors.projectName && <p className="mt-1 text-[11px] text-rose-600">{errors.projectName}</p>}
        </label>
        <label>
          {req('Issue Title')}
          <input className={inputCls} value={issueTitle} onChange={(e) => { setIssueTitle(e.target.value); setErrors((prev) => ({ ...prev, issueTitle: '' })); }} disabled={saving} />
          {errors.issueTitle && <p className="mt-1 text-[11px] text-rose-600">{errors.issueTitle}</p>}
        </label>
        <label>
          {req('Issue Owner')}
          <select className={controlCls} value={issueOwner} onChange={(e) => { setIssueOwner(e.target.value); setErrors((prev) => ({ ...prev, issueOwner: '' })); }} disabled={loading || saving}>
            <option value="">Select owner</option>
            {ownerOptions.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          {errors.issueOwner && <p className="mt-1 text-[11px] text-rose-600">{errors.issueOwner}</p>}
        </label>

        <label>
          {req('Issue Severity')}
          <select className={controlCls} value={issueSeverity} onChange={(e) => { setIssueSeverity(e.target.value); setErrors((prev) => ({ ...prev, issueSeverity: '' })); }} disabled={saving}>
            <option value="">Select severity</option>
            {ISSUE_SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {errors.issueSeverity && <p className="mt-1 text-[11px] text-rose-600">{errors.issueSeverity}</p>}
        </label>
        <label>
          {req('Assign To TeamMember')}
          <select className={controlCls} value={assignTeamMember} onChange={(e) => { setAssignTeamMember(e.target.value); setErrors((prev) => ({ ...prev, assignTeamMember: '' })); }} disabled={loading || saving}>
            <option value="">Select team member</option>
            {teamMemberOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          {errors.assignTeamMember && <p className="mt-1 text-[11px] text-rose-600">{errors.assignTeamMember}</p>}
        </label>
        <label>
          {req('Issue Status')}
          <select className={controlCls} value={issueStatus} onChange={(e) => { setIssueStatus(e.target.value); setErrors((prev) => ({ ...prev, issueStatus: '' })); }} disabled={saving}>
            <option value="">Select status</option>
            {ISSUE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {errors.issueStatus && <p className="mt-1 text-[11px] text-rose-600">{errors.issueStatus}</p>}
        </label>

        <label>
          {opt('Project sponsor')}
          <select className={controlCls} value={projectSponsor} onChange={(e) => setProjectSponsor(e.target.value)} disabled={saving}>
            <option value="">Select sponsor</option>
            {PROJECT_SPONSOR_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          {opt('Progress')}
          <input
            className={inputCls}
            inputMode="numeric"
            maxLength={3}
            value={progress}
            onChange={(e) => {
              const next = e.target.value;
              if (/^\d{0,3}$/.test(next)) setProgress(next);
            }}
            disabled={saving}
          />
        </label>
        <label>
          {opt('RaisedIssue')}
          <input className={inputCls} value={raisedIssue} onChange={(e) => setRaisedIssue(e.target.value)} disabled={saving} />
        </label>

        <label className="md:col-span-2">
          {req('Issue Response')}
          <textarea className={areaCls} value={issueResponse} onChange={(e) => { setIssueResponse(e.target.value); setErrors((prev) => ({ ...prev, issueResponse: '' })); }} disabled={saving} />
          {errors.issueResponse && <p className="mt-1 text-[11px] text-rose-600">{errors.issueResponse}</p>}
        </label>
        <label>
          {req('Issue Impacted Area')}
          <textarea className={areaCls} value={issueImpactedArea} onChange={(e) => { setIssueImpactedArea(e.target.value); setErrors((prev) => ({ ...prev, issueImpactedArea: '' })); }} disabled={saving} />
          {errors.issueImpactedArea && <p className="mt-1 text-[11px] text-rose-600">{errors.issueImpactedArea}</p>}
        </label>

        <label className="md:col-span-3">
          {opt('Issue Description')}
          <textarea className={areaCls} value={issueDescription} onChange={(e) => setIssueDescription(e.target.value)} disabled={saving} />
        </label>
      </div>

      <div className="mt-4 flex justify-end gap-3">
        <button type="button" onClick={onClose} className={`${enj.btnOutline} min-w-[6.5rem] px-8 font-semibold`} disabled={saving}>
          Cancel
        </button>
        <button type="button" onClick={() => void save()} className={`${enj.btnPrimary} min-w-[6.5rem] px-8 font-semibold`} disabled={saving || loading}>
          {saving ? 'Saving...' : issueToEdit ? 'Update' : 'Save'}
        </button>
      </div>
    </section>
  );
}

