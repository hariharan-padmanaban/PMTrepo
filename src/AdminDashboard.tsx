import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { FileSpreadsheet, LayoutGrid } from 'lucide-react';
import { enj } from './ui/enjForm';
import { NewUsersService, type NewUserRow } from './services/NewUsersService';
import { SponsorsService } from './services/SponsorsService';
import ManageDataScreen from './ManageDataScreen';
import { type OnboardingForm, roleLabel } from './ManageUsersScreen';
import { ScreenLoader } from './ScreenLoader';
import { getSessionUserEmail } from './sessionUser';
import { RoleDashboardShell } from './RoleDashboardShell';

type AdminDashboardProps = {
  onLogout: () => void;
  currentUserData: Record<string, unknown> | null;
};

function darkenHex(hex: string, factor = 0.82): string {
  const h = hex.replace('#', '');
  const r = Math.round(parseInt(h.slice(0, 2), 16) * factor);
  const g = Math.round(parseInt(h.slice(2, 4), 16) * factor);
  const b = Math.round(parseInt(h.slice(4, 6), 16) * factor);
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

function StatCard({ value, label, color }: { value: number; label: string; color: string }) {
  const borderColor = darkenHex(color);
  return (
    <div className="overflow-hidden rounded-lg border-2 bg-white p-5 text-center sm:p-6" style={{ borderColor }}>
      <p className="text-[1.8rem] font-semibold leading-none" style={{ color }}>
        {value}
      </p>
      <p className="mt-1 text-[0.8rem] text-gray-700">{label}</p>
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

type AdminNavId = 'Dashboard' | 'mm-reference';

const ADMIN_NAV_ITEMS: { id: AdminNavId; label: string; icon: ReactNode }[] = [
  { id: 'Dashboard', label: 'Dashboard', icon: <LayoutGrid size={16} /> },
  { id: 'mm-reference', label: 'Manage Data', icon: <FileSpreadsheet size={16} /> },
];

export default function AdminDashboard({ onLogout, currentUserData }: AdminDashboardProps) {
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

  return (
    <RoleDashboardShell
      roleLabel="Admin"
      userData={currentUserData}
      onLogout={onLogout}
      notificationItems={[]}
      mainClassName={`relative flex min-h-0 min-w-0 flex-1 flex-col p-5 [scrollbar-gutter:stable] ${
        activeNav === 'mm-reference' ? 'overflow-hidden' : 'overflow-y-auto'
      }`}
      sidebarNav={
        <>
          {ADMIN_NAV_ITEMS.map(({ id, label, icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveNav(id)}
              className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                activeNav === id
                  ? 'font-semibold text-[#A08149]'
                  : 'text-[#344054] hover:bg-gray-50 hover:text-[#344054]'
              }`}
            >
              {activeNav === id && (
                <span className="absolute bottom-1 left-0 top-1 w-[3px] rounded-r-full bg-[#A08149]" />
              )}
              {icon}
              {label}
            </button>
          ))}
        </>
      }
    >
      {loading && <ScreenLoader overlay />}
      {activeNav === 'mm-reference' ? (
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <ManageDataScreen
            userRows={rows}
            userLoading={loading}
            onRefreshUsers={fetchUsers}
            ownUserRecordId={sessionMatchedUser?.new_usersid ? String(sessionMatchedUser.new_usersid) : null}
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col space-y-4">
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard value={totals.users} label="Total Users" color="#c7763f" />
            <StatCard value={totals.clients} label="Total Clients" color="#6aa3c5" />
            <StatCard value={totals.vendors} label="Total Vendors" color="#c9a64a" />
            <StatCard value={sponsorTableCount} label="Total Sponsors" color="#4b3f8a" />
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className={`${enj.card} ${enj.cardPad} chart-card`}>
              <h3 className={`${enj.subhead} mb-2 text-center`}>Active / Inactive Users per Department</h3>
              <UsersByRoleChart rows={rows} />
            </div>
            <div className={`${enj.card} ${enj.cardPad} chart-card`}>
              <h3 className={`${enj.subhead} mb-2 text-center`}>Monthwise Onboarding Count</h3>
              <OnboardingByMonthChart rows={rows} />
            </div>
          </section>
        </div>
      )}
    </RoleDashboardShell>
  );
}
