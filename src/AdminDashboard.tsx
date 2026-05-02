import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Activity, ChevronDown, ClipboardList, FileSpreadsheet, HelpCircle, Inbox, LayoutGrid, LogOut, UserCircle } from 'lucide-react';
import { enj } from './ui/enjForm';
import { NewUsersService, type NewUserRow } from './services/NewUsersService';
import { SponsorsService } from './services/SponsorsService';
import ManageDataScreen from './ManageDataScreen';
import { type OnboardingForm, roleLabel } from './ManageUsersScreen';
import { ScreenLoader } from './ScreenLoader';
import { ActivityHistoryModal } from './ActivityHistoryModal';
import { UserProfileModal } from './UserProfileModal';
import { getSessionUserEmail } from './sessionUser';
import { ThemeModeToggle } from './themeMode';
import { LogoMark } from './LogoMark';
type AuditLogEntry = {
  id: string;
  timestamp: string;
  user: string;
  role: string;
  action: 'Login' | 'Logout' | 'Record Created' | 'Record Updated' | 'Record Deleted' | 'Role Assigned' | 'Role Revoked' | 'Settings Changed';
  details: string;
  status: 'Success' | 'Failed';
};

const AUDIT_SAMPLE: AuditLogEntry[] = [
  { id: '1',  timestamp: '2026-04-29 09:02:11', user: 'admin@enjaz.sa',       role: 'Admin',    action: 'Login',           details: 'Admin portal login',                             status: 'Success' },
  { id: '2',  timestamp: '2026-04-29 09:05:33', user: 'admin@enjaz.sa',       role: 'Admin',    action: 'Role Assigned',   details: 'Assigned Program Manager role to sara@enjaz.sa', status: 'Success' },
  { id: '3',  timestamp: '2026-04-29 09:12:47', user: 'sara@enjaz.sa',        role: 'Program',  action: 'Login',           details: 'Program Manager portal login',                   status: 'Success' },
  { id: '4',  timestamp: '2026-04-29 09:18:02', user: 'sara@enjaz.sa',        role: 'Program',  action: 'Record Created',  details: 'Created project: CRM Phase 2',                   status: 'Success' },
  { id: '5',  timestamp: '2026-04-29 10:00:00', user: 'khalid@enjaz.sa',      role: 'Project',  action: 'Login',           details: 'Project Manager portal login',                   status: 'Success' },
  { id: '6',  timestamp: '2026-04-29 10:04:15', user: 'khalid@enjaz.sa',      role: 'Project',  action: 'Record Created',  details: 'Created task: API Integration — Sprint 3',       status: 'Success' },
  { id: '7',  timestamp: '2026-04-29 10:22:38', user: 'khalid@enjaz.sa',      role: 'Project',  action: 'Record Updated',  details: 'Updated issue status: ISS-045 → In Progress',    status: 'Success' },
  { id: '8',  timestamp: '2026-04-29 11:00:09', user: 'reem@enjaz.sa',        role: 'Team',     action: 'Login',           details: 'Team Member portal login',                       status: 'Success' },
  { id: '9',  timestamp: '2026-04-29 11:07:55', user: 'reem@enjaz.sa',        role: 'Team',     action: 'Record Updated',  details: 'Updated task: UI Design — status → Done',        status: 'Success' },
  { id: '10', timestamp: '2026-04-29 11:30:00', user: 'unknown@external.com', role: '—',        action: 'Login',           details: 'Unrecognised user login attempt',                 status: 'Failed'  },
  { id: '11', timestamp: '2026-04-29 12:05:21', user: 'admin@enjaz.sa',       role: 'Admin',    action: 'Role Revoked',    details: 'Revoked Business role from omar@enjaz.sa',       status: 'Success' },
  { id: '12', timestamp: '2026-04-29 12:15:00', user: 'admin@enjaz.sa',       role: 'Admin',    action: 'Settings Changed','details': 'Dark mode preference updated for system',     status: 'Success' },
  { id: '13', timestamp: '2026-04-29 13:00:44', user: 'nora@enjaz.sa',        role: 'Business', action: 'Login',           details: 'Business portal login',                          status: 'Success' },
  { id: '14', timestamp: '2026-04-29 13:18:30', user: 'nora@enjaz.sa',        role: 'Business', action: 'Record Created',  details: 'Created feedback record for client: Aramco',     status: 'Success' },
  { id: '15', timestamp: '2026-04-29 14:02:11', user: 'khalid@enjaz.sa',      role: 'Project',  action: 'Record Deleted',  details: 'Deleted draft task: Duplicate — Sprint 2',       status: 'Success' },
];

const ACTION_FILTER_OPTIONS = ['All', 'Login', 'Logout', 'Record Created', 'Record Updated', 'Record Deleted', 'Role Assigned', 'Role Revoked', 'Settings Changed'] as const;

function actionBadgeClass(action: AuditLogEntry['action']): string {
  if (action === 'Login' || action === 'Logout') return 'bg-sky-100 text-sky-700';
  if (action === 'Record Created') return 'bg-emerald-100 text-emerald-700';
  if (action === 'Record Updated') return 'bg-amber-100 text-amber-800';
  if (action === 'Record Deleted') return 'bg-rose-100 text-rose-700';
  if (action === 'Role Assigned' || action === 'Role Revoked') return 'bg-purple-100 text-purple-700';
  return 'bg-gray-100 text-gray-600';
}

function AuditLogsPanel() {
  const [filter, setFilter] = useState<string>('All');
  const [search, setSearch] = useState('');

  const filtered = AUDIT_SAMPLE.filter((e) => {
    const matchAction = filter === 'All' || e.action === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || e.user.toLowerCase().includes(q) || e.details.toLowerCase().includes(q) || e.action.toLowerCase().includes(q);
    return matchAction && matchSearch;
  });

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className={enj.pageTitle}>Audit Logs</h2>
          <p className="text-xs text-gray-500 mt-0.5">System activity trail — logins, record changes, and role assignments.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="Search user or action…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${enj.control} max-w-xs`}
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className={`${enj.control} max-w-[200px]`}
        >
          {ACTION_FILTER_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <span className="text-[11px] text-gray-400 ml-auto">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <table className={`${enj.tableBrand} text-xs`}>
          <thead>
            <tr>
              <th className="px-3 py-2 text-left">Timestamp</th>
              <th className="px-3 py-2 text-left">User</th>
              <th className="px-3 py-2 text-left">Role</th>
              <th className="px-3 py-2 text-left">Action</th>
              <th className="px-3 py-2 text-left">Details</th>
              <th className="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-500">No audit records match the selected filters.</td>
              </tr>
            ) : (
              filtered.map((e) => (
                <tr key={e.id} className="transition-colors">
                  <td className="px-3 py-2 font-mono text-[10px] text-[#6B7280] whitespace-nowrap">{e.timestamp}</td>
                  <td className="px-3 py-2 font-medium max-w-[160px] truncate text-[#2563EB]" title={e.user}>{e.user}</td>
                  <td className="px-3 py-2 text-gray-600">{e.role}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${actionBadgeClass(e.action)}`}>{e.action}</span>
                  </td>
                  <td className="px-3 py-2 max-w-[300px] truncate text-gray-600" title={e.details}>{e.details}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${e.status === 'Success' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{e.status}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type AdminDashboardProps = {
  onLogout: () => void;
};

function ProfileDropdown({
  onLogout,
  displayName,
  roleLabel,
}: {
  onLogout: () => void;
  displayName: string;
  roleLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [activityHistoryOpen, setActivityHistoryOpen] = useState(false);
  const [userProfileOpen, setUserProfileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || 'U';

  const items = [
    { label: 'User Profile', icon: <UserCircle size={14} className="text-[#c7a56a]" /> },
    { label: 'Inbox', icon: <Inbox size={14} className="text-[#c7a56a]" /> },
    { label: 'Activity History', icon: <Activity size={14} className="text-[#c7a56a]" /> },
    { label: 'Help', icon: <HelpCircle size={14} className="text-[#c7a56a]" /> },
  ];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((v) => (v + 1) % (items.length + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((v) => (v - 1 + items.length + 1) % (items.length + 1));
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (activeIndex === items.length) {
        onLogout();
      }
      setOpen(false);
    }
  };

  return (
    <>
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          className="flex items-center gap-1.5 hover:opacity-90 transition-opacity"
          aria-label="Profile menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <div className="w-8 h-8 rounded-full bg-[#b28a44] text-white text-[10px] font-semibold flex items-center justify-center">{initials}</div>
          <ChevronDown size={13} className="text-gray-400" />
        </button>
        {open && (
          <div
            ref={menuRef}
            tabIndex={0}
            onKeyDown={onMenuKeyDown}
            className="absolute right-0 top-10 z-50 w-52 rounded-xl border border-gray-200 bg-white shadow-xl outline-none"
          >
            <div className="px-3 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-primary truncate">{displayName}</p>
              <p className="text-[10px] text-gray-400 truncate">{roleLabel}</p>
            </div>
            <div className="py-1">
              {items.map((item, index) => (
                <button
                  key={item.label}
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => {
                    if (item.label === 'User Profile') {
                      setUserProfileOpen(true);
                      setOpen(false);
                      return;
                    }
                    if (item.label === 'Activity History') {
                      setActivityHistoryOpen(true);
                      setOpen(false);
                      return;
                    }
                    if (item.label === 'Inbox') {
                      window.open('https://outlook.office.com/mail/', '_blank', 'noopener,noreferrer');
                      setOpen(false);
                    }
                  }}
                  className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 ${
                    activeIndex === index ? 'bg-gray-50 text-[#2d356b]' : 'text-gray-500'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
            <div className="border-t border-gray-100 p-1">
              <button
                type="button"
                onClick={onLogout}
                onMouseEnter={() => setActiveIndex(items.length)}
                className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 rounded-lg ${
                  activeIndex === items.length ? 'bg-red-50 text-red-600' : 'text-gray-500'
                }`}
              >
                <LogOut size={14} className={activeIndex === items.length ? 'text-red-500' : 'text-[#c7a56a]'} />
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
      <UserProfileModal open={userProfileOpen} onClose={() => setUserProfileOpen(false)} />
      <ActivityHistoryModal open={activityHistoryOpen} onClose={() => setActivityHistoryOpen(false)} />
    </>
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
  const [selected, setSelected] = useState<string | null>(null);
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
    <svg viewBox="0 0 520 270" className={enj.chartSvgLg} role="img" aria-label="Users by role chart">
      {[0, 2, 4, 6, 8, 10, 12].map((v) => (
        <g key={v}>
          <line x1="46" x2="500" y1={210 - v * (170 / 12)} y2={210 - v * (170 / 12)} stroke="#edf2f7" />
          <text x="30" y={214 - v * (170 / 12)} fontSize="9" fill="#94a3b8">{v}</text>
        </g>
      ))}
      <polyline fill="none" stroke="#1f9d55" strokeWidth="2"
        points={activeCounts.map((v, i) => `${70 + i * 120},${210 - v * scale}`).join(' ')} />
      <polyline fill="none" stroke="#e11d48" strokeWidth="2"
        points={inactiveCounts.map((v, i) => `${70 + i * 120},${210 - v * scale}`).join(' ')} />
      {categories.map((c, i) => {
        const isSel = selected === c;
        const ax = 70 + i * 120; const ay = 210 - activeCounts[i] * scale;
        const ix = 70 + i * 120; const iy = 210 - inactiveCounts[i] * scale;
        return (
          <g key={c} style={{ cursor: 'pointer' }} onClick={() => setSelected(isSel ? null : c)}>
            {isSel && <rect x={ax - 20} y="30" width="40" height="185" rx="4" fill={`${c === selected ? '#6366f1' : '#1f9d55'}08`} />}
            <circle cx={ax} cy={ay} r={isSel ? 6 : 4} fill="#1f9d55" stroke="white" strokeWidth="1.5" style={{ transition: 'r 200ms' }}>
              <title>{c} — Active: {activeCounts[i]}</title>
            </circle>
            <circle cx={ix} cy={iy} r={isSel ? 6 : 4} fill="#e11d48" stroke="white" strokeWidth="1.5" style={{ transition: 'r 200ms' }}>
              <title>{c} — Inactive: {inactiveCounts[i]}</title>
            </circle>
            {isSel && (
              <g>
                <rect x={ax - 28} y={Math.min(ay, iy) - 28} width="56" height="24" rx="4" fill="#1e293b" opacity="0.88" />
                <text x={ax} y={Math.min(ay, iy) - 12} textAnchor="middle" fontSize="8" fill="white">
                  A:{activeCounts[i]} / I:{inactiveCounts[i]}
                </text>
              </g>
            )}
            <text x={ax} y="230" textAnchor="middle" fontSize="9" fill={isSel ? '#4f46e5' : '#64748b'} fontWeight={isSel ? 'bold' : 'normal'}>{c}</text>
          </g>
        );
      })}
      <circle cx="188" cy="252" r="5" fill="#1f9d55" /><text x="197" y="256" fontSize="9" fill="#64748b">Active</text>
      <circle cx="248" cy="252" r="5" fill="#e11d48" /><text x="257" y="256" fontSize="9" fill="#64748b">Inactive</text>
      {selected && <text x="380" y="256" fontSize="8" fill="#6366f1">Showing: {selected} — click again to reset</text>}
    </svg>
  );
}

function OnboardingByMonthChart({ rows }: { rows: NewUserRow[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const months = ['Feb 2026', 'Mar 2026', 'Apr 2026'];
  const colors = ['#22c55e', '#f59e0b', '#38bdf8'];
  const monthly = months.map((_, idx) => rows.filter((r) => {
    const d = r.new_onboardeddate ? new Date(r.new_onboardeddate) : null;
    return d ? d.getMonth() === idx + 1 : false;
  }).length);

  return (
    <svg viewBox="0 0 420 270" className={enj.chartSvgLg} role="img" aria-label="Monthly onboarding chart">
      {[0, 1, 2, 3, 4].map((v) => (
        <g key={v}>
          <line x1="46" x2="392" y1={210 - v * 40} y2={210 - v * 40} stroke="#edf2f7" />
          <text x="30" y={214 - v * 40} fontSize="9" fill="#94a3b8">{v}</text>
        </g>
      ))}
      {monthly.map((v, i) => {
        const isSel = selected === i;
        const h = Math.max(v * 35, v > 0 ? 4 : 0);
        return (
          <g key={i} style={{ cursor: 'pointer' }} onClick={() => setSelected(isSel ? null : i)}>
            <rect
              x={88 + i * 100} y={210 - h} width="26" height={h} rx="4"
              fill={colors[i]}
              opacity={selected !== null && !isSel ? 0.35 : 1}
              style={{ transition: 'opacity 250ms, filter 250ms' }}
              filter={isSel ? 'brightness(1.15)' : undefined}
            >
              <title>{months[i]}: {v} users</title>
            </rect>
            {isSel && (
              <g>
                <rect x={88 + i * 100 - 10} y={210 - h - 26} width="46" height="20" rx="3" fill="#1e293b" opacity="0.9" />
                <text x={101 + i * 100} y={210 - h - 12} textAnchor="middle" fontSize="9" fill="white">{v} users</text>
              </g>
            )}
            <text x={101 + i * 100} y="232" textAnchor="middle" fontSize="9" fill={isSel ? colors[i] : '#64748b'} fontWeight={isSel ? 'bold' : 'normal'}>{months[i]}</text>
          </g>
        );
      })}
      <circle cx="126" cy="252" r="5" fill="#22c55e" /><text x="136" y="256" fontSize="9" fill="#64748b">Feb</text>
      <circle cx="196" cy="252" r="5" fill="#f59e0b" /><text x="206" y="256" fontSize="9" fill="#64748b">Mar</text>
      <circle cx="266" cy="252" r="5" fill="#38bdf8" /><text x="276" y="256" fontSize="9" fill="#64748b">Apr</text>
    </svg>
  );
}

type AdminNavId = 'Dashboard' | 'mm-reference' | 'audit-logs';

const REFERENCE_DATA_SUB: { id: AdminNavId; label: string; icon: ReactNode }[] = [
  { id: 'mm-reference', label: 'Manage Data', icon: <FileSpreadsheet size={16} /> },
  { id: 'audit-logs', label: 'Audit Logs', icon: <ClipboardList size={16} /> },
];

export default function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [activeNav, setActiveNav] = useState<AdminNavId>('Dashboard');
  const [rows, setRows] = useState<NewUserRow[]>([]);
  const [sponsorTableCount, setSponsorTableCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const [userRes, sponsorRes] = await Promise.all([
        NewUsersService.getAll({ top: 200, orderBy: ['createdon desc'] }),
        SponsorsService.getAll({ top: 5000 }),
      ]);
      if (userRes.success) setRows(userRes.data ?? []);
      if (sponsorRes.success) setSponsorTableCount((sponsorRes.data ?? []).length);
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
    return { users, clients, vendors };
  }, [rows]);

  const sessionMatchedUser = useMemo(() => {
    const sessionEmail = getSessionUserEmail()?.toLowerCase();
    if (!sessionEmail) return null;
    return (
      rows.find((r) => {
        const emailId = String(r.new_newcolumn ?? '').trim().toLowerCase();
        const userIdField = String(r.new_userid ?? '').trim().toLowerCase();
        return emailId === sessionEmail || userIdField === sessionEmail;
      }) ?? null
    );
  }, [rows]);

  const currentUser = useMemo(() => {
    const matched = sessionMatchedUser ?? rows[0];
    if (!matched) {
      return { name: 'Admin User', departments: ['Admin'] };
    }
    const dept = matched.new_rolename ?? roleLabel[String(matched.new_role) as OnboardingForm['department']] ?? 'Admin';
    return { name: matched.new_name ?? 'Admin User', departments: [dept] };
  }, [rows, sessionMatchedUser]);

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f6fb] text-gray-800">
      <aside className="z-[60] w-56 bg-[#f3f4f8] border-r border-gray-100 flex min-h-0 flex-col flex-shrink-0 pb-8">
        <div className="px-5 py-5 border-b border-gray-100">
          <LogoMark />
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <button
            type="button"
            onClick={() => setActiveNav('Dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeNav === 'Dashboard' ? 'bg-white text-[#151d5d]' : 'text-[#344054] hover:bg-white hover:text-[#344054]'
            }`}
          >
            <LayoutGrid size={16} />
            Dashboard
          </button>
          {REFERENCE_DATA_SUB.map(({ id, label, icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveNav(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeNav === id ? 'bg-white text-[#151d5d]' : 'text-[#344054] hover:bg-white hover:text-[#344054]'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </nav>
        <div className="shrink-0 border-t border-gray-100 px-3 py-4">
          <ThemeModeToggle />
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-100 px-6 h-14 flex items-center">
          <div className="ml-auto flex items-center gap-4">
            <ProfileDropdown onLogout={onLogout} displayName={currentUser.name} roleLabel="Admin" />
          </div>
        </header>

        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden p-5">
          {loading && <ScreenLoader overlay />}
          {activeNav === 'audit-logs' ? (
            <AuditLogsPanel />
          ) : activeNav === 'mm-reference' ? (
            <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <ManageDataScreen
                userRows={rows}
                userLoading={loading}
                onRefreshUsers={fetchUsers}
                ownUserRecordId={sessionMatchedUser?.new_usersid ? String(sessionMatchedUser.new_usersid) : null}
              />
            </div>
          ) : (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
              <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard value={totals.users} label="Total Users" color="#c7763f" />
                <StatCard value={totals.clients} label="Total Clients" color="#6aa3c5" />
                <StatCard value={totals.vendors} label="Total Vendors" color="#c9a64a" />
                <StatCard value={sponsorTableCount} label="Total Sponsors" color="#4b3f8a" />
              </section>

              <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className={`${enj.card} ${enj.cardPad} chart-card`}>
                  <h3 className={`${enj.subhead} text-center mb-2`}>Active / Inactive Users per Department</h3>
                  <UsersByRoleChart rows={rows} />
                </div>
                <div className={`${enj.card} ${enj.cardPad} chart-card`}>
                  <h3 className={`${enj.subhead} text-center mb-2`}>Monthwise Onboarding Count</h3>
                  <OnboardingByMonthChart rows={rows} />
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
