import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { enj } from './ui/enjForm';
import { New_teammembersService } from './generated/services/New_teammembersService';
import { type New_teammembers, New_teammembersnew_specialize } from './generated/models/New_teammembersModel';
import { NewUsersService, type NewUserRow } from './services/NewUsersService';
import { type ToastType } from './NotificationToast';
import { ScreenLoader } from './ScreenLoader';

type Props = {
  open: boolean;
  onClose: () => void;
  projectName: string;
  /** Dataverse project row GUID (new_projectid) */
  projectId: string;
  onNotify: (p: { type: ToastType; message: string }) => void;
  onSaved?: () => void;
};

/** Maps UI labels to Dataverse optionset (Dev / QA / PM). */
const SPECIALIZE_OPTIONS: { label: string; value: keyof typeof New_teammembersnew_specialize }[] = [
  { label: 'Developer', value: 100000000 },
  { label: 'Tester', value: 100000001 },
  { label: 'UI/UX', value: 100000002 },
];

function odataEscapeString(s: string): string {
  return s.replace(/'/g, "''");
}

function isUserTeamRole(u: NewUserRow): boolean {
  const roleName = String(u.new_rolename ?? '').trim().toLowerCase();
  if (roleName === 'team') return true;
  const roleRaw = String(u.new_role ?? '').trim();
  if (roleRaw.toLowerCase() === 'team') return true;
  const roleNum = Number(roleRaw);
  if (Number.isFinite(roleNum) && roleNum === 100000004) return true;
  return false;
}

function userEmailKey(u: NewUserRow): string {
  return String(u.new_newcolumn ?? '').trim().toLowerCase();
}

/** First word of Users.new_name. */
function userFirstName(u: NewUserRow): string {
  const raw = String(u.new_name ?? '').trim();
  if (!raw) return '';
  const parts = raw.split(/\s+/).filter(Boolean);
  return parts[0] ?? raw;
}

export function AllocateTeamMemberModal({ open, onClose, projectName, projectId, onNotify, onSaved }: Props) {
  const [dataLoading, setDataLoading] = useState(true);
  const [users, setUsers] = useState<NewUserRow[]>([]);
  const [emailsOnProject, setEmailsOnProject] = useState<Set<string>>(new Set());
  const [specialize, setSpecialize] = useState('');
  const [teamEmail, setTeamEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [score, setScore] = useState('');
  const [kpi, setKpi] = useState('');
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setDataLoading(true);
      try {
        const name = projectName.trim();
        const filterTm =
          name.length > 0
            ? `new_projectname eq '${odataEscapeString(name)}'`
            : undefined;
        const [usersRes, tmRes] = await Promise.all([
          NewUsersService.getAll({ top: 2000, orderBy: ['new_name asc'] }),
          filterTm
            ? New_teammembersService.getAll({
                top: 5000,
                filter: filterTm,
                select: ['new_teamemail', 'new_projectname'],
              })
            : Promise.resolve({ success: true as const, data: [] as New_teammembers[] }),
        ]);
        if (cancelled) return;
        if (usersRes.success && usersRes.data) {
          setUsers(usersRes.data.filter(isUserTeamRole));
        } else {
          setUsers([]);
        }
        const taken = new Set<string>();
        if (tmRes.success && tmRes.data) {
          for (const row of tmRes.data) {
            const cell = String(row.new_teamemail ?? '');
            for (const part of cell.split(/\s*,\s*/)) {
              const e = part.trim().toLowerCase();
              if (e) taken.add(e);
            }
          }
        }
        setEmailsOnProject(taken);
      } catch {
        if (!cancelled) {
          setUsers([]);
          setEmailsOnProject(new Set());
        }
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, projectName]);

  useEffect(() => {
    if (!open) return;
    setSpecialize('');
    setTeamEmail('');
    setFirstName('');
    setScore('');
    setKpi('');
    setFieldErrors({});
  }, [open, projectId, projectName]);

  /** Team-role users, distinct by EmailID, excluding emails already on this project. */
  const teamEmailOptions = useMemo(() => {
    const byKey = new Map<string, NewUserRow>();
    for (const u of users) {
      const k = userEmailKey(u);
      if (!k) continue;
      if (emailsOnProject.has(k)) continue;
      if (!byKey.has(k)) byKey.set(k, u);
    }
    return Array.from(byKey.values())
      .map((u) => ({
        email: String(u.new_newcolumn ?? '').trim(),
        u,
      }))
      .filter((o) => o.email.length > 0)
      .sort((a, b) => a.email.localeCompare(b.email, undefined, { sensitivity: 'base' }));
  }, [users, emailsOnProject]);

  const onTeamEmailChange = (email: string) => {
    setTeamEmail(email);
    setFieldErrors((f) => ({ ...f, teamEmail: '' }));
    const k = email.trim().toLowerCase();
    const row = teamEmailOptions.find((o) => o.email.toLowerCase() === k);
    if (row) {
      setFirstName(userFirstName(row.u));
    } else {
      setFirstName('');
    }
  };

  const inputCls = `mt-1 ${enj.control}`;

  const save = async () => {
    const err: Record<string, string> = {};
    if (!specialize) err.specialize = 'Required';
    if (!teamEmail.trim()) err.teamEmail = 'Required';
    if (!firstName.trim()) err.firstName = 'Required (from selected user EmailID)';
    if (kpi.trim() === '') err.kpi = 'Required';
    const parsedKpi = Number(kpi.trim());
    if (kpi.trim() !== '' && Number.isNaN(parsedKpi)) err.kpi = 'KPI must be a number';
    if (!projectId.trim()) err.project = 'Project ID is missing; cannot save.';

    setFieldErrors(err);
    if (Object.keys(err).length) return;

    setSaving(true);
    try {
      const specN = Number(specialize) as keyof typeof New_teammembersnew_specialize;
      const res = await New_teammembersService.create({
        new_fullname: firstName.trim(),
        new_projectname: projectName.trim(),
        new_projectid: projectId.trim(),
        new_teamemail: teamEmail.trim(),
        new_specialize: specN,
        new_kpi: parsedKpi,
        new_score: score.trim() === '' || Number.isNaN(Number(score)) ? undefined : Number(score),
        statecode: 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to save');
      onNotify({ type: 'success', message: 'Team member allocated successfully.' });
      onSaved?.();
      onClose();
    } catch (e) {
      onNotify({ type: 'error', message: e instanceof Error ? e.message : 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="alloc-team-title">
      <div className="relative w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id="alloc-team-title" className="text-lg font-semibold text-primary">
            Allocate Team Member
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {dataLoading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <ScreenLoader />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-1">
              <label className="text-xs font-medium text-primary">Project Name</label>
              <input className={inputCls} readOnly value={projectName} />
            </div>
            <div className="sm:col-span-1">
              <label className="text-xs font-medium text-primary">
                Specialize <span className="text-rose-600">*</span>
              </label>
              <select
                className={inputCls}
                value={specialize}
                onChange={(e) => {
                  setSpecialize(e.target.value);
                  setFieldErrors((f) => ({ ...f, specialize: '' }));
                }}
              >
                <option value="">Select</option>
                {SPECIALIZE_OPTIONS.map((o) => (
                  <option key={o.value} value={String(o.value)}>
                    {o.label}
                  </option>
                ))}
              </select>
              {fieldErrors.specialize && <p className="mt-0.5 text-[11px] text-rose-600">{fieldErrors.specialize}</p>}
            </div>
            <div className="sm:col-span-1">
              <label className="text-xs font-medium text-primary">
                Team Email <span className="text-rose-600">*</span>
              </label>
              <select
                className={inputCls}
                value={teamEmail}
                onChange={(e) => onTeamEmailChange(e.target.value)}
              >
                <option value="">{projectName.trim() ? 'Select team email' : 'Project name required'}</option>
                {teamEmailOptions.map((o) => (
                  <option key={o.email} value={o.email}>
                    {o.email}
                  </option>
                ))}
              </select>
              {fieldErrors.teamEmail && <p className="mt-0.5 text-[11px] text-rose-600">{fieldErrors.teamEmail}</p>}
              {projectName.trim() && teamEmailOptions.length === 0 && !fieldErrors.teamEmail && (
                <p className="mt-0.5 text-[11px] text-amber-700">All team users are already allocated to this project.</p>
              )}
            </div>
            <div className="sm:col-span-1">
              <label className="text-xs font-medium text-primary">First Name</label>
              <input
                className={`${inputCls} read-only:bg-gray-50`}
                readOnly
                value={firstName}
                placeholder="—"
                title="From selected user (EmailID)"
              />
              {fieldErrors.firstName && <p className="mt-0.5 text-[11px] text-rose-600">{fieldErrors.firstName}</p>}
            </div>
            <div className="sm:col-span-1">
              <label className="text-xs font-medium text-primary">Score</label>
              <input
                className={inputCls}
                type="number"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                min={0}
                step="any"
              />
            </div>
            <div className="sm:col-span-1">
              <label className="text-xs font-medium text-primary">
                KPI <span className="text-rose-600">*</span>
              </label>
              <input
                className={inputCls}
                type="number"
                value={kpi}
                onChange={(e) => {
                  setKpi(e.target.value);
                  setFieldErrors((f) => ({ ...f, kpi: '' }));
                }}
                placeholder="Enter KPI"
              />
              {fieldErrors.kpi && <p className="mt-0.5 text-[11px] text-rose-600">{fieldErrors.kpi}</p>}
            </div>
            {fieldErrors.project && <p className="sm:col-span-2 text-[11px] text-rose-600">{fieldErrors.project}</p>}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className={`${enj.btnOutline} min-w-[5rem]`}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            className={`${enj.btnPrimary} min-w-[5rem]`}
            disabled={saving || dataLoading}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
