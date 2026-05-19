import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { enj } from './ui/enjForm';
import { New_teammembersService } from './generated/services/New_teammembersService';
import { type New_teammembers, New_teammembersnew_specialize } from './generated/models/New_teammembersModel';
import { NewUsersService, type NewUserRow } from './services/NewUsersService';
import { EnjazMasterDataService, type EnjazMasterDataRow } from './services/EnjazMasterDataService';
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

function userEmailKey(u: NewUserRow): string {
  return String(u.new_newcolumn ?? '').trim().toLowerCase();
}

/** First word of Users.new_name, or fallback to email prefix. */
function userFirstName(u: NewUserRow): string {
  const raw = String(u.new_name ?? '').trim();
  if (raw) {
    const parts = raw.split(/\s+/).filter(Boolean);
    return parts[0] ?? raw;
  }
  // Fallback to email prefix if name is not available
  const email = String(u.new_newcolumn ?? '').trim();
  if (email) {
    const prefix = email.split('@')[0] ?? '';
    return prefix.split('.').pop() ?? prefix;
  }
  return '';
}

export function AllocateTeamMemberModal({ open, onClose, projectName, projectId, onNotify, onSaved }: Props) {
  const [dataLoading, setDataLoading] = useState(true);
  const [users, setUsers] = useState<NewUserRow[]>([]);
  const [emailsOnProject, setEmailsOnProject] = useState<Set<string>>(new Set());
  const [allocatedMembers, setAllocatedMembers] = useState<New_teammembers[]>([]);
  const [kpiOptions, setKpiOptions] = useState<EnjazMasterDataRow[]>([]);
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
        const [usersRes, tmRes, kpiRes] = await Promise.all([
          NewUsersService.getAll({
            top: 2000,
            orderBy: ['new_name asc'],
            select: ['new_userid', 'new_name', 'new_newcolumn', 'new_rolename', 'new_role'],
            filter: 'new_role eq 100000004'
          }),
          filterTm
            ? New_teammembersService.getAll({
                top: 5000,
                filter: filterTm,
                select: ['new_teamemail', 'new_projectname', 'new_fullname', 'new_specialize', 'new_kpi', 'new_score', 'createdon'],
              })
            : Promise.resolve({ success: true as const, data: [] as New_teammembers[] }),
          EnjazMasterDataService.getAll({
            top: 500,
            filter: "new_categorytype eq 'KPI'",
            orderBy: ['new_enjazmasterdata1 asc'],
          }),
        ]);
        if (cancelled) return;
        if (usersRes.success && usersRes.data) {
          setUsers(usersRes.data);
        } else {
          setUsers([]);
        }
        const taken = new Set<string>();
        const members: New_teammembers[] = [];
        if (tmRes.success && tmRes.data) {
          for (const row of tmRes.data) {
            members.push(row);
            const cell = String(row.new_teamemail ?? '');
            for (const part of cell.split(/\s*,\s*/)) {
              const e = part.trim().toLowerCase();
              if (e) taken.add(e);
            }
          }
        }
        setAllocatedMembers(members);
        setEmailsOnProject(taken);
        if (kpiRes.success && kpiRes.data) {
          setKpiOptions(kpiRes.data);
        } else {
          setKpiOptions([]);
        }
      } catch {
        if (!cancelled) {
          setUsers([]);
          setEmailsOnProject(new Set());
          setKpiOptions([]);
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
    if (!kpi.trim()) err.kpi = 'Required';
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
        new_kpi: kpi.trim(),
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
      <div className="relative w-full max-w-5xl rounded-xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
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
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Allocated Members Section */}
            <div className="flex flex-col gap-3 min-h-0">
              <h3 className="text-sm font-semibold text-primary">Allocated Members</h3>
              {allocatedMembers.length === 0 ? (
                <div className="flex-1 flex items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
                  <p className="text-center text-sm text-gray-500">No team members allocated yet</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-2 rounded-lg border border-gray-200 bg-white p-3">
                  {allocatedMembers.map((member, idx) => {
                    const specializeLabel = SPECIALIZE_OPTIONS.find((o) => String(o.value) === String(member.new_specialize))?.label || '—';
                    return (
                      <div key={idx} className="rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-gray-900 text-sm truncate">{member.new_fullname || '—'}</p>
                            <p className="text-xs text-gray-600 truncate">{member.new_teamemail || '—'}</p>
                            <div className="mt-2 space-y-1 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-gray-600">Specialize:</span>
                                <span className="font-medium text-gray-900">{specializeLabel}</span>
                              </div>
                              {member.new_kpi && (
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-600">KPI:</span>
                                  <span className="font-medium text-gray-900 tabular-nums">{member.new_kpi}</span>
                                </div>
                              )}
                              {member.new_score && (
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-600">Score:</span>
                                  <span className="font-medium text-gray-900 tabular-nums">{Number(member.new_score).toFixed(2)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Allocate Form Section */}
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-primary">Allocate New Member</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-medium text-primary">Project Name</label>
                  <input className={inputCls} readOnly value={projectName} />
                </div>
                <div className="col-span-1">
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
                <div className="col-span-1">
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
                </div>
                <div className="col-span-1">
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
                <div className="col-span-1">
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
                <div className="col-span-1">
                  <label className="text-xs font-medium text-primary">
                    KPI <span className="text-rose-600">*</span>
                  </label>
              <select
                className={inputCls}
                value={kpi}
                onChange={(e) => {
                  setKpi(e.target.value);
                  setFieldErrors((f) => ({ ...f, kpi: '' }));
                }}
              >
                <option value="">Select KPI</option>
                {kpiOptions.map((option) => (
                  <option key={option.new_enjazmasterdataid} value={String(option.new_enjazmasterdata1 ?? '')}>
                    {option.new_enjazmasterdata1}
                  </option>
                ))}
              </select>
                  {fieldErrors.kpi && <p className="mt-0.5 text-[11px] text-rose-600">{fieldErrors.kpi}</p>}
                </div>
                {fieldErrors.project && <p className="text-[11px] text-rose-600">{fieldErrors.project}</p>}
              </div>
            </div>
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
