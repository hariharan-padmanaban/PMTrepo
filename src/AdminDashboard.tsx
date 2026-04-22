import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronDown, ClipboardList, LayoutDashboard, MoreHorizontal, Search, ShieldCheck, Users, X } from 'lucide-react';
import { NewUsersService, type NewUserRow } from './services/NewUsersService';
import ManageMasterDataScreen from './ManageMasterDataScreen';
import { NotificationToast, type ToastType } from './NotificationToast';

type AdminDashboardProps = {
  onLogout: () => void;
};

type OnboardingForm = {
  fullName: string;
  userId: string;
  employeeId: string;
  gender: 'Male' | 'Female' | 'Other';
  department: '100000000' | '100000001' | '100000002' | '100000003' | '100000004';
  resume: File | null;
};

const EMPTY_FORM: OnboardingForm = {
  fullName: '',
  userId: '',
  employeeId: '',
  gender: 'Male',
  department: '100000001',
  resume: null,
};

const roleLabel: Record<OnboardingForm['department'], string> = {
  '100000000': 'Admin',
  '100000001': 'Business',
  '100000002': 'Program',
  '100000003': 'Project',
  '100000004': 'Team',
};

function statusName(code?: string | number): 'Active' | 'InActive' {
  return String(code) === '100000001' ? 'InActive' : 'Active';
}

function fallbackGuid() {
  const template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  return template.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function validateUserForm(form: OnboardingForm): Partial<Record<keyof OnboardingForm, string>> {
  const next: Partial<Record<keyof OnboardingForm, string>> = {};
  if (!form.fullName.trim()) next.fullName = 'Full name is required';
  if (!form.userId.trim()) next.userId = 'User ID is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.userId.trim())) next.userId = 'User ID must be a valid email';
  if (!form.employeeId.trim()) next.employeeId = 'Employee ID is required';
  return next;
}

function NotificationBell() {
  return (
    <button type="button" className="relative w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700" aria-label="Notifications">
      <Users size={16} />
    </button>
  );
}

function ProfileDropdown({
  onLogout,
  displayName,
  departments,
}: {
  onLogout: () => void;
  displayName: string;
  departments: string[];
}) {
  const [open, setOpen] = useState(false);
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || 'U';
  return (
    <div className="relative">
      <button type="button" className="flex items-center gap-1.5" onClick={() => setOpen((v) => !v)}>
        <div className="w-8 h-8 rounded-full bg-[#b28a44] text-white text-[10px] font-semibold flex items-center justify-center">{initials}</div>
        <ChevronDown size={13} className="text-gray-400" />
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-52 rounded-lg border border-gray-200 bg-white shadow-lg p-1">
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-sm font-semibold text-[#2d356b] truncate">{displayName}</p>
            <p className="text-[10px] text-gray-400 truncate">
              {departments.length > 0 ? departments.join(', ') : 'No Department'}
            </p>
          </div>
          <button type="button" onClick={onLogout} className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded-md">
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

function StatCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: `${color}66` }}>
      <p className="text-4xl font-semibold" style={{ color }}>{value}</p>
      <p className="mt-1 text-gray-700">{label}</p>
    </div>
  );
}

function UsersByRoleChart({ rows }: { rows: NewUserRow[] }) {
  const categories = ['Business', 'Program', 'Project', 'Team'] as const;
  const activeCounts = categories.map((cat) =>
    rows.filter((r) => (r.new_rolename ?? roleLabel[String(r.new_role) as OnboardingForm['department']] ?? '-') === cat && String(r.new_status) === '100000000').length,
  );
  const inactiveCounts = categories.map((cat) =>
    rows.filter((r) => (r.new_rolename ?? roleLabel[String(r.new_role) as OnboardingForm['department']] ?? '-') === cat && String(r.new_status) === '100000001').length,
  );
  const max = Math.max(2, ...activeCounts, ...inactiveCounts);
  const scale = 170 / max;

  return (
    <svg viewBox="0 0 520 260" className="w-full h-72">
      {[0, 2, 4, 6, 8, 10, 12].map((v) => (
        <g key={v}>
          <line x1="46" x2="500" y1={210 - v * (170 / 12)} y2={210 - v * (170 / 12)} stroke="#edf2f7" />
          <text x="30" y={214 - v * (170 / 12)} fontSize="9" fill="#94a3b8">{v}</text>
        </g>
      ))}
      <polyline
        fill="none"
        stroke="#1f9d55"
        strokeWidth="2"
        points={activeCounts.map((v, i) => `${70 + i * 120},${210 - v * scale}`).join(' ')}
      />
      <polyline
        fill="none"
        stroke="#e11d48"
        strokeWidth="2"
        points={inactiveCounts.map((v, i) => `${70 + i * 120},${210 - v * scale}`).join(' ')}
      />
      {categories.map((c, i) => (
        <text key={c} x={70 + i * 120} y="230" textAnchor="middle" fontSize="9" fill="#64748b">
          {c}
        </text>
      ))}
      <circle cx="188" cy="246" r="5" fill="#1f9d55" /><text x="197" y="250" fontSize="9" fill="#64748b">Active Users</text>
      <circle cx="286" cy="246" r="5" fill="#e11d48" /><text x="295" y="250" fontSize="9" fill="#64748b">Inactive Users</text>
    </svg>
  );
}

function OnboardingByMonthChart({ rows }: { rows: NewUserRow[] }) {
  const months = ['Feb 2026', 'Mar 2026', 'Apr 2026'];
  const monthly = months.map((_, idx) => rows.filter((r) => {
    const d = r.new_onboardeddate ? new Date(r.new_onboardeddate) : null;
    return d ? d.getMonth() === idx + 1 : false;
  }).length);

  return (
    <svg viewBox="0 0 420 260" className="w-full h-72">
      {[0, 1, 2, 3, 4].map((v) => (
        <g key={v}>
          <line x1="46" x2="392" y1={210 - v * 40} y2={210 - v * 40} stroke="#edf2f7" />
          <text x="30" y={214 - v * 40} fontSize="9" fill="#94a3b8">{v}</text>
        </g>
      ))}
      {monthly.map((v, i) => (
        <rect key={i} x={88 + i * 100} y={210 - v * 35} width="26" height={v * 35} rx="4" fill={['#22c55e', '#f59e0b', '#38bdf8'][i]} />
      ))}
      {months.map((m, i) => (
        <text key={m} x={101 + i * 100} y="232" textAnchor="middle" fontSize="9" fill="#64748b">{m}</text>
      ))}
      <circle cx="126" cy="246" r="5" fill="#22c55e" /><text x="136" y="250" fontSize="9" fill="#64748b">Clients</text>
      <circle cx="208" cy="246" r="5" fill="#f59e0b" /><text x="218" y="250" fontSize="9" fill="#64748b">Vendors</text>
      <circle cx="292" cy="246" r="5" fill="#38bdf8" /><text x="302" y="250" fontSize="9" fill="#64748b">Sponsors</text>
    </svg>
  );
}

function UserOnboardingScreen({ onCreated }: { onCreated: () => Promise<void> }) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<OnboardingForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof OnboardingForm, string>>>({});
  const [message, setMessage] = useState('');

  const validate = useCallback(() => {
    const next = validateUserForm(form);
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [form]);

  const onSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    if (!validate()) return;
    setSubmitting(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const payload = {
        new_usersid: globalThis.crypto?.randomUUID?.() ?? fallbackGuid(),
        new_name: form.fullName.trim(),
        new_userid: form.userId.trim(),
        new_role: Number(form.department),
        new_status: 100000000,
        new_onboardeddate: today,
        // Primary name column (EmailID) is required.
        new_newcolumn: form.employeeId.trim(),
      };
      const res = await NewUsersService.create(payload);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to create user');
      setMessage('User created successfully.');
      setForm(EMPTY_FORM);
      setErrors({});
      await onCreated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  }, [form, onCreated, validate]);

  const inputCls = 'mt-1 h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm';

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <h2 className="text-xl font-semibold text-[#2d356b]">User Onboarding</h2>
        <p className="text-xs text-gray-500 mt-1">Capture onboarding details for new users.</p>
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label>
            <span className="text-xs text-gray-600">Full Name *</span>
            <input className={inputCls} value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
            {errors.fullName && <p className="text-[11px] text-red-600 mt-1">{errors.fullName}</p>}
          </label>

          <label>
            <span className="text-xs text-gray-600">User ID (Email) *</span>
            <input className={inputCls} value={form.userId} onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))} />
            {errors.userId && <p className="text-[11px] text-red-600 mt-1">{errors.userId}</p>}
          </label>

          <label>
            <span className="text-xs text-gray-600">Employee ID *</span>
            <input className={inputCls} value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))} />
            {errors.employeeId && <p className="text-[11px] text-red-600 mt-1">{errors.employeeId}</p>}
          </label>

          <label>
            <span className="text-xs text-gray-600">Gender *</span>
            <select className={inputCls} value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value as OnboardingForm['gender'] }))}>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </label>

          <label>
            <span className="text-xs text-gray-600">Department *</span>
            <select className={inputCls} value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value as OnboardingForm['department'] }))}>
              {Object.entries(roleLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>

          <label>
            <span className="text-xs text-gray-600">Resume (File Upload)</span>
            <input type="file" accept=".pdf,.doc,.docx" className={`${inputCls} py-1.5`} onChange={(e) => setForm((f) => ({ ...f, resume: e.target.files?.[0] ?? null }))} />
          </label>

          <div className="text-xs text-gray-500 md:col-span-2">
            Onboarded Date and Status are set automatically on submit (Today, Active).
          </div>

          <div className="md:col-span-2 flex justify-end">
            <button type="submit" disabled={submitting} className="h-9 px-6 rounded-md bg-[#b28a44] text-white text-sm font-medium disabled:opacity-50">
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
        {message && <p className="text-sm text-gray-700 mt-3">{message}</p>}
      </section>
    </div>
  );
}

function ManageUsersScreen({
  rows,
  loading,
  onRefresh,
}: {
  rows: NewUserRow[];
  loading: boolean;
  onRefresh: () => Promise<void>;
}) {
  const [searchText, setSearchText] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<'All' | OnboardingForm['department']>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'InActive'>('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [menuRowId, setMenuRowId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<OnboardingForm>(EMPTY_FORM);
  const [editErrors, setEditErrors] = useState<Partial<Record<keyof OnboardingForm, string>>>({});
  const [editBusy, setEditBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(null);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const name = (r.new_name ?? '').toLowerCase();
      const userId = (r.new_userid ?? '').toLowerCase();
      const deptCode = String(r.new_role) as OnboardingForm['department'];
      const deptName = (r.new_rolename ?? roleLabel[deptCode] ?? '').toLowerCase();
      const status = statusName(r.new_status);
      const onboarded = r.new_onboardeddate ? r.new_onboardeddate.slice(0, 10) : '';

      if (searchText.trim()) {
        const q = searchText.trim().toLowerCase();
        if (!name.includes(q) && !userId.includes(q) && !deptName.includes(q)) return false;
      }
      if (departmentFilter !== 'All' && deptCode !== departmentFilter) return false;
      if (statusFilter !== 'All' && status !== statusFilter) return false;
      if (fromDate && onboarded && onboarded < fromDate) return false;
      if (toDate && onboarded && onboarded > toDate) return false;
      return true;
    });
  }, [rows, searchText, departmentFilter, statusFilter, fromDate, toDate]);

  const openEdit = (row: NewUserRow) => {
    setEditingId(row.new_usersid ?? null);
    setEditForm({
      fullName: row.new_name ?? '',
      userId: row.new_userid ?? '',
      employeeId: (row.new_newcolumn as string | undefined) ?? '',
      gender: 'Male',
      department: (String(row.new_role) as OnboardingForm['department']) || '100000001',
      resume: null,
    });
    setEditErrors({});
    setEditOpen(true);
    setMenuRowId(null);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    const next = validateUserForm(editForm);
    setEditErrors(next);
    if (Object.keys(next).length > 0) return;
    setEditBusy(true);
    setMessage('');
    try {
      const payload = {
        new_name: editForm.fullName.trim(),
        new_userid: editForm.userId.trim(),
        new_role: Number(editForm.department),
        new_newcolumn: editForm.employeeId.trim(),
      };
      const res = await NewUsersService.update(editingId, payload);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to update user');
      setMessage('User updated successfully.');
      setToast({ type: 'success', message: 'User updated successfully.' });
      setEditOpen(false);
      await onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update user');
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Failed to update user' });
    } finally {
      setEditBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      {toast && <NotificationToast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
      <h2 className="text-xl font-semibold text-[#2d356b]">Manage</h2>
      <p className="text-xs text-gray-500 mt-1 mb-3">Onboarded users list.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 mb-3">
        <input
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search name, user ID, department"
          className="h-9 rounded-md border border-gray-200 px-3 text-sm xl:col-span-2"
        />
        <select className="h-9 rounded-md border border-gray-200 px-3 text-sm" value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value as 'All' | OnboardingForm['department'])}>
          <option value="All">All Departments</option>
          {Object.entries(roleLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="h-9 rounded-md border border-gray-200 px-3 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'All' | 'Active' | 'InActive')}>
          <option value="All">All Status</option>
          <option value="Active">Active</option>
          <option value="InActive">InActive</option>
        </select>
        <div className="flex gap-2">
          <input type="date" className="h-9 rounded-md border border-gray-200 px-2 text-sm w-full" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <input type="date" className="h-9 rounded-md border border-gray-200 px-2 text-sm w-full" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
      </div>
      {message && <p className="text-sm text-gray-700 mb-2">{message}</p>}

      <div className="overflow-auto">
        <table className="w-full min-w-[860px]">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr className="text-left text-[11px] uppercase text-gray-500">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">User ID</th>
              <th className="px-3 py-2">Department</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Onboarded</th>
              <th className="px-3 py-2 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-3 py-3 text-sm text-gray-500" colSpan={6}>Loading users...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td className="px-3 py-3 text-sm text-gray-500" colSpan={6}>No users found.</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.new_usersid} className="border-b border-gray-100 text-sm text-gray-700">
                <td className="px-3 py-2">{r.new_name ?? '-'}</td>
                <td className="px-3 py-2">{r.new_userid ?? '-'}</td>
                <td className="px-3 py-2">{r.new_rolename ?? roleLabel[String(r.new_role) as OnboardingForm['department']] ?? '-'}</td>
                <td className="px-3 py-2">{r.new_statusname ?? statusName(r.new_status)}</td>
                <td className="px-3 py-2">{r.new_onboardeddate ? r.new_onboardeddate.slice(0, 10) : '-'}</td>
                <td className="px-3 py-2 text-center">
                  <div className="relative inline-block text-left">
                    <button type="button" onClick={() => setMenuRowId((v) => (v === (r.new_usersid ?? null) ? null : (r.new_usersid ?? null)))} className="h-8 w-8 rounded-md border border-gray-200 inline-flex items-center justify-center hover:bg-gray-50">
                      <MoreHorizontal size={16} />
                    </button>
                    {menuRowId === r.new_usersid && (
                      <div className="absolute right-0 mt-1 w-24 rounded-md border border-gray-200 bg-white shadow-lg z-20">
                        <button type="button" onClick={() => openEdit(r)} className="w-full px-3 py-2 text-left text-xs hover:bg-gray-50">
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editOpen && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/40 p-4" role="presentation" onClick={() => setEditOpen(false)}>
          <div className="w-full max-w-3xl rounded-xl border border-gray-100 bg-white p-5 shadow-xl" role="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-[#2d356b]">Edit User</h3>
              <button type="button" onClick={() => setEditOpen(false)} className="h-8 w-8 rounded-md hover:bg-gray-100 inline-flex items-center justify-center">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={saveEdit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label><span className="text-xs text-gray-600">Full Name *</span><input className="mt-1 h-9 w-full rounded-md border border-gray-200 px-3 text-sm" value={editForm.fullName} onChange={(e) => setEditForm((f) => ({ ...f, fullName: e.target.value }))} />{editErrors.fullName && <p className="text-[11px] text-red-600 mt-1">{editErrors.fullName}</p>}</label>
              <label><span className="text-xs text-gray-600">User ID (Email) *</span><input className="mt-1 h-9 w-full rounded-md border border-gray-200 px-3 text-sm" value={editForm.userId} onChange={(e) => setEditForm((f) => ({ ...f, userId: e.target.value }))} />{editErrors.userId && <p className="text-[11px] text-red-600 mt-1">{editErrors.userId}</p>}</label>
              <label><span className="text-xs text-gray-600">Employee ID *</span><input className="mt-1 h-9 w-full rounded-md border border-gray-200 px-3 text-sm" value={editForm.employeeId} onChange={(e) => setEditForm((f) => ({ ...f, employeeId: e.target.value }))} />{editErrors.employeeId && <p className="text-[11px] text-red-600 mt-1">{editErrors.employeeId}</p>}</label>
              <label><span className="text-xs text-gray-600">Gender *</span><select className="mt-1 h-9 w-full rounded-md border border-gray-200 px-3 text-sm" value={editForm.gender} onChange={(e) => setEditForm((f) => ({ ...f, gender: e.target.value as OnboardingForm['gender'] }))}><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select></label>
              <label><span className="text-xs text-gray-600">Department *</span><select className="mt-1 h-9 w-full rounded-md border border-gray-200 px-3 text-sm" value={editForm.department} onChange={(e) => setEditForm((f) => ({ ...f, department: e.target.value as OnboardingForm['department'] }))}>{Object.entries(roleLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label><span className="text-xs text-gray-600">Resume (File Upload)</span><input type="file" accept=".pdf,.doc,.docx" className="mt-1 h-9 w-full rounded-md border border-gray-200 px-2 text-sm" onChange={(e) => setEditForm((f) => ({ ...f, resume: e.target.files?.[0] ?? null }))} /></label>
              <div className="md:col-span-2 flex justify-end gap-2 mt-1">
                <button type="button" onClick={() => setEditOpen(false)} className="h-9 px-5 rounded-md border border-[#b28a44] text-[#b28a44] text-sm">Cancel</button>
                <button type="submit" disabled={editBusy} className="h-9 px-5 rounded-md bg-[#b28a44] text-white text-sm disabled:opacity-50">{editBusy ? 'Updating...' : 'Update User'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

export default function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [activeNav, setActiveNav] = useState('Dashboard');
  const [rows, setRows] = useState<NewUserRow[]>([]);
  const [loading, setLoading] = useState(false);

  const navItems = [
    { name: 'Dashboard', icon: <LayoutDashboard size={16} /> },
    { name: 'Onboarding', icon: <Users size={16} /> },
    { name: 'Manage', icon: <ClipboardList size={16} /> },
    { name: 'Manage Master', icon: <ShieldCheck size={16} /> },
    { name: 'View Audit', icon: <Calendar size={16} /> },
  ];

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await NewUsersService.getAll({ top: 200, orderBy: ['createdon desc'] });
      if (res.success) setRows(res.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers, activeNav]);

  const totals = useMemo(() => {
    const users = rows.length;
    const clients = rows.filter((r) => String(r.new_role) === '100000001').length;
    const vendors = rows.filter((r) => String(r.new_role) === '100000002').length;
    const sponsors = rows.filter((r) => String(r.new_role) === '100000003' || String(r.new_role) === '100000004').length;
    return { users, clients, vendors, sponsors };
  }, [rows]);

  const currentUser = useMemo(() => {
    const first = rows[0];
    if (!first) {
      return { name: 'Admin User', departments: ['Admin'] };
    }
    const dept = first.new_rolename ?? roleLabel[String(first.new_role) as OnboardingForm['department']] ?? 'Admin';
    // departments as array for future multi-department support.
    return { name: first.new_name ?? 'Admin User', departments: [dept] };
  }, [rows]);

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f6fb] text-gray-800">
      <aside className="w-52 bg-[#f3f4f8] border-r border-gray-100 flex flex-col flex-shrink-0">
        <div className="px-5 py-5 border-b border-gray-100">
          <div className="text-xl font-bold text-[#151d5d]">ENJAZ</div>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map(({ name, icon }) => (
            <button
              key={name}
              type="button"
              onClick={() => setActiveNav(name)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeNav === name ? 'bg-white text-[#151d5d]' : 'text-gray-500 hover:bg-white hover:text-gray-700'
              }`}
            >
              {icon}
              {name}
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-100 px-6 h-14 flex items-center">
          <div className="ml-auto flex items-center gap-4">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-lg px-4 h-10 w-[420px] max-w-[52vw]">
              <input className="bg-transparent text-sm text-gray-500 outline-none w-full" placeholder="Search anything..." />
              <Search size={18} className="text-gray-400" />
            </div>
            <NotificationBell />
            <ProfileDropdown onLogout={onLogout} displayName={currentUser.name} departments={currentUser.departments} />
          </div>
        </header>

        <main className="flex-1 overflow-auto p-5 space-y-4">
          {activeNav === 'Onboarding' ? (
            <UserOnboardingScreen onCreated={fetchUsers} />
          ) : activeNav === 'Manage' ? (
            <ManageUsersScreen rows={rows} loading={loading} onRefresh={fetchUsers} />
          ) : activeNav === 'Manage Master' ? (
            <ManageMasterDataScreen />
          ) : activeNav === 'Dashboard' ? (
            <>
              <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard value={totals.users} label="Total Users" color="#c7763f" />
                <StatCard value={totals.clients} label="Total Clients" color="#6aa3c5" />
                <StatCard value={totals.vendors} label="Total Vendors" color="#c9a64a" />
                <StatCard value={totals.sponsors} label="Total Sponsors" color="#4b3f8a" />
              </section>

              <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-[#2d356b] text-center mb-2">Active / Inactive Users per Department</h3>
                  <UsersByRoleChart rows={rows} />
                </div>
                <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-[#2d356b] text-center mb-2">Monthwise Onboarding Count</h3>
                  <OnboardingByMonthChart rows={rows} />
                </div>
              </section>
            </>
          ) : (
            <section className="rounded-xl border border-gray-100 bg-white p-5 text-sm text-gray-600 shadow-sm">
              {activeNav} screen placeholder.
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
