/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Activity, AlertCircle, ArrowRight, Bell, Briefcase, Calendar, Check, CheckSquare,
  ChevronDown, Clock, Eye, EyeOff, FileText, FolderOpen, HelpCircle, Inbox, LayoutDashboard, Pencil,
  LogOut, MessageSquare, Moon, Search, Settings, ShieldCheck, TrendingUp, UserCircle, Users,
} from 'lucide-react';
import BusinessFeedbackList from './BusinessFeedbackList';
import AdminDashboard from './AdminDashboard';
import { ActivityHistoryModal } from './ActivityHistoryModal';
import { UserProfileModal } from './UserProfileModal';
import { DonutChart } from './DonutChart';
import { New_programsService } from './generated/services/New_programsService';
import { New_projectsService } from './generated/services/New_projectsService';
import {
  New_projectsnew_projectpriority,
  New_projectsnew_projecttype,
  New_projectsnew_strategicgoal,
  New_projectsnew_projectstatus,
} from './generated/models/New_projectsModel';
import { New_vendorsService } from './generated/services/New_vendorsService';
import { EnjazMasterDataService, type EnjazMasterDataRow } from './services/EnjazMasterDataService';
import { NewUsersService } from './services/NewUsersService';
import { NotificationToast, type ToastType } from './NotificationToast';

/** Application roles — pick at sign-in to route the correct workspace. */
export type AppRole = 'admin' | 'business' | 'program' | 'project' | 'team';

const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Admin',
  business: 'Business',
  program: 'Program',
  project: 'Project',
  team: 'Team',
};

const ENJAZ_LOGO_SRC = 'file:///C:/Users/hariharanp/.cursor/projects/c-Users-hariharanp-Downloads-ENJAX-1-ENJAX/assets/c__Users_hariharanp_AppData_Roaming_Cursor_User_workspaceStorage_769430d61f3c186f8dffc100eaf41079_images_image-89a2b325-bcb0-4c0b-a221-9957bd7128e0.png';

function yyyymmFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function parseYyyymmStart(ym: string): Date {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1);
}

function formatTimelineMonthHeading(ym: string): string {
  return parseYyyymmStart(ym).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function sixMonthNamesStarting(ym: string): string[] {
  const d = parseYyyymmStart(ym);
  return Array.from({ length: 6 }, (_, i) =>
    new Date(d.getFullYear(), d.getMonth() + i, 1).toLocaleDateString(undefined, { month: 'long' }),
  );
}

/** ISO week number (approximation sufficient for timeline labels). */
function isoWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function weekLabelsFromMonthStart(ym: string, count: number): string[] {
  const start = isoWeekNumber(parseYyyymmStart(ym));
  return Array.from({ length: count }, (_, i) => `W ${start + i}`);
}

function LogoMark({ sizeClass = 'w-10 h-10' }: { sizeClass?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className={`${sizeClass} rounded-md bg-[#151d5d] flex items-center justify-center`}>
        <span className="text-white text-[9px] font-extrabold tracking-widest">ENJAZ</span>
      </div>
    );
  }
  return (
    <img
      src={ENJAZ_LOGO_SRC}
      alt="Enjaz logo"
      className={`${sizeClass} rounded-md object-cover`}
      onError={() => setFailed(true)}
    />
  );
}

// ─── SVG Chart: Assigned Tasks / Projects ───────────────────────────────────
function AssignedTasksChart() {
  const bars = [
    { label: 'Flow',     value: 15, color: '#94a3b8' },
    { label: 'Pinnacle', value: 38, color: '#fbbf24' },
    { label: 'Primus',   value: 28, color: '#a3a36a' },
    { label: 'PS.Sys',   value: 22, color: '#f87171' },
    { label: 'Star',     value: 34, color: '#60a5fa' },
    { label: '',         value: 10, color: '#c4b5fd' },
  ];
  const MAX = 50;
  const H = 110;
  const W = 220;
  const PL = 28;
  const barW = 22;
  const gap = 10;

  return (
    <svg viewBox={`0 0 ${W} ${H + 44}`} className="w-full h-44">
      {[0, 10, 20, 30, 40, 50].map((v) => {
        const y = H - (v / MAX) * H;
        return (
          <g key={v}>
            <line x1={PL} x2={W - 4} y1={y} y2={y} stroke="#f1f5f9" strokeWidth="1" />
            <text x={PL - 4} y={y + 3} textAnchor="end" fontSize="7" fill="#94a3b8">{v}</text>
          </g>
        );
      })}
      {bars.map((d, i) => {
        const x = PL + i * (barW + gap);
        const h = (d.value / MAX) * H;
        return (
          <g key={i}>
            <rect x={x} y={H - h} width={barW} height={h} fill={d.color} rx="3" />
            <text x={x + barW / 2} y={H + 10} textAnchor="middle" fontSize="6" fill="#6b7280">{d.label}</text>
          </g>
        );
      })}
      <text x={W / 2} y={H + 28} textAnchor="middle" fontSize="7" fill="#9ca3af" fontStyle="italic">Projects</text>
    </svg>
  );
}

// ─── SVG Chart: Tasks ────────────────────────────────────────────────────────
function TasksChart() {
  const bars = [
    { label: ['TO DO'],       value: 23, color: '#60a5fa' },
    { label: ['DONE'],        value: 16, color: '#34d399' },
    { label: ['DELAYED'],     value: 6,  color: '#fb923c' },
    { label: ['ON HOLD'],     value: 1,  color: '#f87171' },
    { label: ['IN','PROGRESS'], value: 8, color: '#a3e635' },
  ];
  const MAX = 26;
  const H = 110;
  const barW = 26;
  const gap = 8;
  const PL = 6;
  const W = PL + bars.length * (barW + gap) + 4;

  return (
    <svg viewBox={`0 0 ${W} ${H + 36}`} className="w-full h-44">
      {bars.map((d, i) => {
        const x = PL + i * (barW + gap);
        const h = (d.value / MAX) * H;
        return (
          <g key={i}>
            <text x={x + barW / 2} y={H - h - 3} textAnchor="middle" fontSize="8" fontWeight="700" fill="#374151">{d.value}</text>
            <rect x={x} y={H - h} width={barW} height={h} fill={d.color} rx="4" />
            {d.label.map((word, wi) => (
              <text key={wi} x={x + barW / 2} y={H + 10 + wi * 9} textAnchor="middle" fontSize="5.5" fill="#6b7280">{word}</text>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

// ─── SVG Chart: Issues Donut ─────────────────────────────────────────────────
function IssuesDonut() {
  return (
    <div className="flex items-center gap-2">
      <DonutChart
        className="w-36 h-36 flex-shrink-0"
        ringWidth={38}
        showOuterLabels={false}
        centerText="360"
        centerSubtext="issues"
        slices={[
          { label: 'Open', value: 80, color: '#d3525a' },
          { label: 'Solved', value: 470, color: '#1667de' },
          { label: 'Total', value: 620, color: '#3b3a80' },
        ]}
      />
      <div className="space-y-2 text-xs min-w-[100px]">
        {[
          { label: 'Open', val: 80, color: '#d3525a' },
          { label: 'Solved', val: 470, color: '#1667de' },
          { label: 'Total', val: 620, color: '#3b3a80' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
            <span className="text-gray-500 w-10">{item.label}</span>
            <span className="font-semibold text-gray-700">{item.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Badge helper ─────────────────────────────────────────────────────────────
function Badge({ label }: { label: string }) {
  const map: Record<string, string> = {
    HIGH:        'bg-red-100 text-red-700',
    LOW:         'bg-blue-100 text-blue-700',
    MEDIUM:      'bg-teal-100 text-teal-700',
    BUG:         'bg-red-100 text-red-700',
    'IN PROGRESS': 'bg-yellow-100 text-yellow-700',
    DONE:        'bg-green-100 text-green-700',
    UAT:         'bg-indigo-100 text-indigo-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${map[label] ?? 'bg-gray-100 text-gray-600'}`}>
      {label}
    </span>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-[#151d5d] rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 whitespace-nowrap">{pct}%</span>
    </div>
  );
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const items = [
    { user: 'John. S', text: 'Issue#5801 closed on Business analysis', date: '04/07/2023', time: '09.00 am', priority: 'LOW', color: 'bg-indigo-100 text-indigo-700' },
    { user: 'Fady', text: 'Issue#5801 opened on Business analysis', date: '04/07/2023', time: '09.00 am', priority: 'MEDIUM', color: 'bg-amber-100 text-amber-700' },
    { user: 'Samy Ali', text: 'Issue#4403 re-opened on Business analysis', date: '04/07/2023', time: '09.00 am', priority: 'MEDIUM', color: 'bg-amber-100 text-amber-700' },
    { user: 'Reda.W S', text: 'Issue#7709 closed on Business analysis', date: '04/07/2023', time: '09.00 am', priority: 'HIGH', color: 'bg-rose-100 text-rose-700' },
  ];

  return (
    <div className="relative flex items-center">
      <button type="button" className="relative w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700" aria-label="Notifications" onClick={() => setOpen((v) => !v)}>
        <Bell size={18} />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-50 w-[320px] rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">Notification</h3>
            <button className="text-xs text-gray-500">All Read</button>
          </div>
          <div className="px-3 pt-2 flex items-center gap-4 text-xs border-b border-gray-100">
            <span className="text-amber-700 border-b-2 border-amber-700 pb-2">Issues</span>
            <span className="text-gray-400 pb-2">Sent Tasks</span>
            <span className="text-gray-400 pb-2">Pinned</span>
          </div>
          <div className="max-h-[350px] overflow-auto">
            {items.map((item) => (
              <div key={item.user + item.text} className="px-3 py-2 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-orange-200 text-[10px] flex items-center justify-center text-orange-800">
                      {item.user.charAt(0)}
                    </div>
                    <p className="text-sm font-medium text-gray-700">{item.user}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${item.color}`}>{item.priority}</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">{item.text} Group Request access to CS Server</p>
                <div className="mt-1 flex items-center gap-4 text-[11px] text-gray-400">
                  <span>{item.date}</span>
                  <span>{item.time}</span>
                  <button className="text-indigo-500">Add Comment</button>
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 flex items-center justify-between text-sm">
            <button className="text-gray-500">Clear All</button>
            <button className="text-[#b28a44]">View All</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileDropdown({ onLogout }: { onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const [activityHistoryOpen, setActivityHistoryOpen] = useState(false);
  const [userProfileOpen, setUserProfileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

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
          <div className="w-8 h-8 rounded-full bg-orange-300 flex items-center justify-center">
            <UserCircle size={16} className="text-white" />
          </div>
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
              <p className="text-sm font-semibold text-[#2d356b]">pms</p>
              <p className="text-[10px] text-gray-400">Admin</p>
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

// ─── Team Dashboard ───────────────────────────────────────────────────────────
function TeamDashboard({ onLogout }: { onLogout: () => void }) {
  const [activeNav, setActiveNav] = useState('Dashboard');
  const [showCalendarMom, setShowCalendarMom] = useState(false);
  const [showAddCalendarMeetingForm, setShowAddCalendarMeetingForm] = useState(false);
  const [showTaskDetails, setShowTaskDetails] = useState(false);
  const [showIssueDetails, setShowIssueDetails] = useState(false);

  const navItems = [
    { name: 'Dashboard', icon: <LayoutDashboard size={16} /> },
    { name: 'Projects',  icon: <FolderOpen size={16} /> },
    { name: 'Timeline',  icon: <Clock size={16} /> },
    { name: 'Tasks',     icon: <CheckSquare size={16} /> },
    { name: 'Issues',    icon: <AlertCircle size={16} /> },
    { name: 'Calendar',  icon: <Calendar size={16} /> },
  ];

  const overviewCards = [
    { label: 'Projects',       value: '5',  border: 'border-blue-500' },
    { label: 'Delayed Tasks',  value: '14', border: 'border-yellow-400' },
    { label: 'Bugs',           value: '18', border: 'border-red-400' },
    { label: 'Issues',         value: '3',  border: 'border-[#b28a44]' },
    { label: 'Assigned Tasks', value: '52', border: 'border-green-400' },
    { label: 'User Stories',   value: '38', border: 'border-slate-400' },
  ];

  const tasks = [
    {
      project: 'Pinnacle', task: 'Color change',
      priority: 'HIGH', status: 'IN PROGRESS',
      pm: 'Ahmed Ali', sponsor: 'HR', milestone: 'Design',
      start: 'Feb 09, 2024', end: 'May 24, 2024', pct: 40,
    },
    {
      project: 'Pinnacle', task: 'UI Test',
      priority: 'HIGH', status: 'BUG',
      pm: 'Ahmed Ali', sponsor: 'Sales', milestone: 'UAT',
      start: 'Feb 09, 2024', end: 'May 24, 2024', pct: 40,
    },
    {
      project: 'PS.System', task: 'UI Test',
      priority: 'MEDIUM', status: 'DONE',
      pm: 'Ahmed Ali', sponsor: 'Legal', milestone: 'Sprint 1',
      start: 'Feb 09, 2024', end: 'May 24, 2024', pct: 100,
    },
  ];
  const teamProjectColumns = [
    {
      name: 'Delayed',
      cards: [
        { badge: 'Operation Pro', badgeColor: 'bg-rose-100 text-rose-700', title: 'auditing information architecture', date: 'Aug 20, 2021' },
        { badge: 'Code tech', badgeColor: 'bg-red-100 text-red-700', title: 'Update support documentation', date: 'Aug 18, 2023' },
        { badge: 'Operation Pro', badgeColor: 'bg-rose-100 text-rose-700', title: 'Qualitative research planning', date: 'Aug 20, 2021' },
      ],
    },
    {
      name: 'On Track',
      cards: [
        { badge: 'Demo_UI', badgeColor: 'bg-emerald-100 text-emerald-700', title: 'Listing deliverables checklist', date: 'Sep 20, 2021' },
        { badge: 'Operation Pro', badgeColor: 'bg-emerald-100 text-emerald-700', title: 'Qualitative research planning', date: 'Aug 20, 2021' },
        { badge: 'UI Prose', badgeColor: 'bg-green-100 text-green-700', title: 'High fidelity UI Desktop', date: 'Aug 20, 2021' },
      ],
    },
    {
      name: 'Completed',
      cards: [
        { badge: 'Code tech', badgeColor: 'bg-blue-100 text-blue-700', title: 'Design System', date: 'Aug 19, 2021' },
        { badge: 'UI Prose', badgeColor: 'bg-indigo-100 text-indigo-700', title: 'High fidelity UI Desktop', date: 'Aug 20, 2021' },
        { badge: 'Code tech', badgeColor: 'bg-blue-100 text-blue-700', title: 'Listing deliverables checklist', date: 'Sep 20, 2021' },
      ],
    },
  ];
  const teamTaskColumns = [
    { name: 'To do', color: '#22c55e' },
    { name: 'In Progress', color: '#f59e0b' },
    { name: 'Delayed', color: '#ef4444' },
    { name: 'Done', color: '#2563eb' },
  ];

  const thCls = 'text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide py-2 px-3 whitespace-nowrap';
  const tdCls = 'py-3 px-3 text-sm text-gray-700 whitespace-nowrap';

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f6fb] text-gray-800">
      {/* ── Sidebar ── */}
      <aside className="w-52 bg-white border-r border-gray-100 flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-100">
          <LogoMark />
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-4 px-3 space-y-0.5">
          {navItems.map(({ name, icon }) => (
            <button
              key={name}
              onClick={() => {
                setActiveNav(name);
                if (name !== 'Calendar') {
                  setShowCalendarMom(false);
                  setShowAddCalendarMeetingForm(false);
                }
                if (name !== 'Tasks') setShowTaskDetails(false);
                if (name !== 'Issues') setShowIssueDetails(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeNav === name
                  ? 'bg-indigo-50 text-[#151d5d]'
                  : 'text-gray-400 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              {icon}
              {name}
            </button>
          ))}
        </nav>

        {/* Bottom icons */}
        <div className="px-5 py-4 border-t border-gray-100 flex items-center gap-4">
          <button className="text-gray-400 hover:text-gray-600"><Settings size={16} /></button>
          <button className="text-gray-400 hover:text-gray-600"><Moon size={16} /></button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-100 px-6 h-14 flex items-center">
          <div className="ml-auto flex items-center gap-4">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-lg px-4 h-10 w-[420px] max-w-[52vw]">
              <input
                className="bg-transparent text-sm text-gray-500 outline-none w-full placeholder-gray-400"
                placeholder="Search anything..."
              />
              <Search size={18} className="text-gray-400" />
            </div>
            <NotificationBell />
            <ProfileDropdown onLogout={onLogout} />
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-auto px-6 pt-6 pb-0 min-w-0">
          <div className="min-h-full flex flex-col gap-5">
          {activeNav === 'Projects' ? (
            <section className="bg-[#eef0f6] rounded-xl p-4 min-w-0">
              <h2 className="text-xl font-bold text-[#2f3150] mb-4">Projects participated in</h2>
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_220px] gap-4 min-w-0">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 min-w-0">
                  {teamProjectColumns.map((column) => (
                    <div key={column.name} className="space-y-3 min-w-0">
                      <div className="bg-white rounded-xl border border-gray-100 px-3 py-2 flex items-center justify-between">
                        <p className="text-sm font-semibold text-[#2f3150]">{column.name}</p>
                        <button className="text-[10px] text-[#b28a44]">View All</button>
                      </div>
                      {column.cards.map((card, idx) => (
                        <div key={`${column.name}-${idx}`} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                          <span className={`inline-block px-2 py-0.5 rounded text-[8px] font-semibold ${card.badgeColor}`}>{card.badge}</span>
                          <p className="text-[11px] text-[#2f3150] font-medium mt-2">{card.title}</p>
                          <p className="text-[10px] text-gray-400">Create content for pieceland App</p>
                          <div className="mt-2 flex items-center justify-between text-[10px] text-gray-400">
                            <span>{card.date}</span>
                            <span>11 file</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  <div className="bg-white rounded-xl border border-gray-100 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <DonutChart
                        className="w-20 h-20"
                        ringWidth={24}
                        showOuterLabels={false}
                        centerText="85%"
                        slices={[
                          { label: 'On Track', value: 85, color: '#1667de' },
                          { label: 'Remaining', value: 15, color: '#e5e7eb' },
                        ]}
                      />
                      <div>
                        <p className="text-xs font-semibold text-[#2f3150]">On Track Projects</p>
                        <p className="text-[10px] text-gray-400">103 hrs / this year</p>
                      </div>
                    </div>
                    <div className="space-y-2 text-[10px]">
                      {[
                        ['Media', '56 GB', '#b28a44'],
                        ['Documents', '30 GB', '#22c55e'],
                        ['Reports', '10 GB', '#f6be00'],
                        ['Other File', '15 GB', '#2563eb'],
                      ].map(([label, value, color]) => (
                        <div key={String(label)}>
                          <div className="flex items-center justify-between text-gray-500 mb-1">
                            <span>{label}</span>
                            <span>{value}</span>
                          </div>
                          <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: '70%', backgroundColor: String(color) }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 p-3">
                    <h3 className="text-sm font-semibold text-[#2f3150] mb-2">Insights</h3>
                    <svg viewBox="0 0 200 130" className="w-full h-28 chart-svg">
                      {[0, 10, 20, 30, 40, 50].map((v) => (
                        <g key={v}>
                          <line x1="24" x2="190" y1={104 - v * 1.6} y2={104 - v * 1.6} stroke="#eef2f7" />
                          <text x="6" y={108 - v * 1.6} fontSize="7" fill="#9ca3af">{v}</text>
                        </g>
                      ))}
                      {[
                        ['Initiated', 16, '#21c784'],
                        ['Pending', 38, '#f6be00'],
                        ['Completed', 46, '#2563eb'],
                      ].map(([name, value, color], i) => (
                        <g key={String(name)}>
                          <rect x={36 + i * 48} y={104 - Number(value) * 1.6} width="18" height={Number(value) * 1.6} rx="3" className="chart-bar" fill={String(color)} />
                          <text x={45 + i * 48} y="120" textAnchor="middle" fontSize="7" fill="#9ca3af">{name}</text>
                        </g>
                      ))}
                    </svg>
                  </div>
                </div>
              </div>
            </section>
          ) : activeNav === 'Timeline' ? (
            <section className="bg-[#eef0f6] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold text-[#2f3150]">Timeline</h2>
                <div className="flex items-center gap-3 text-xs">
                  {[
                    ['Type', 'All'],
                    ['Project Name', 'All'],
                  ].map(([label, value]) => (
                    <label key={label} className="flex items-center gap-2 text-gray-500">
                      <span>{label}</span>
                      <select className="h-8 rounded-md border border-gray-200 bg-white px-2 text-[11px] text-gray-500">
                        <option>{value}</option>
                      </select>
                    </label>
                  ))}
                  <button className="h-8 px-3 rounded-md border border-gray-200 bg-white text-[11px] text-gray-500">Critical Path</button>
                  <button className="h-8 px-3 rounded-md border border-[#d8c9ad] bg-white text-[11px] text-[#b28a44]">Today</button>
                  <button className="h-8 px-3 rounded-md border border-gray-200 bg-white text-[11px] text-gray-500">January 2024</button>
                </div>
              </div>

              <section className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="grid grid-cols-[220px_1fr]">
                  <aside className="border-r border-gray-100">
                    <div className="h-9 px-3 flex items-center justify-between text-[11px] font-semibold text-[#2f3150] bg-gray-50 border-b border-gray-100">
                      <span>Assigned Tasks</span>
                      <ChevronDown size={11} />
                    </div>
                    <div className="p-2 space-y-2 h-[470px] overflow-auto">
                      {['Pinnacle Project', 'Financial Project', 'Growth Project'].map((group) => (
                        <div key={group} className="border border-gray-100 rounded-md">
                          <div className="px-2 py-1.5 text-[10px] font-semibold text-[#2f3150] bg-gray-50 flex items-center justify-between">
                            <span>{group}</span>
                            <ChevronDown size={10} />
                          </div>
                          <div className="px-2 py-1 space-y-1">
                            {['CodeTech', 'Inno.Sales', 'Serv.in'].map((item, idx) => (
                              <p key={item + idx} className="text-[9px] text-gray-400 pl-2">{item}</p>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </aside>

                  <div className="overflow-auto">
                    <div className="min-w-[980px]">
                      <div className="h-9 border-b border-gray-100 bg-gray-50 flex items-center">
                        <div className="w-full text-center text-[9px] text-gray-400 font-semibold">JANUARY</div>
                      </div>
                      <div className="h-8 border-b border-gray-100 flex">
                        {Array.from({ length: 20 }).map((_, i) => (
                          <div key={i} className="w-12 border-r border-gray-100 text-[9px] text-gray-400 flex items-center justify-center">D {String(i + 1).padStart(2, '0')}</div>
                        ))}
                      </div>
                      <div className="relative h-[430px] bg-[repeating-linear-gradient(to_right,#f6f7fb_0,#f6f7fb_1px,transparent_1px,transparent_48px)]">
                        {[
                          { title: 'Task Name1', top: 40, left: 22, width: 88, color: '#94a3b8', pct: 60 },
                          { title: 'Task Name 2', top: 84, left: 82, width: 92, color: '#f4b58d', pct: 45 },
                          { title: 'Task Name 3', top: 122, left: 198, width: 92, color: '#7fb4e6', pct: 50 },
                          { title: 'Task Name 4', top: 154, left: 292, width: 105, color: '#5aa3f1', pct: 40 },
                          { title: 'Task Name 5', top: 190, left: 402, width: 110, color: '#6dd6a4', pct: 45 },
                          { title: 'Task Name 6', top: 226, left: 520, width: 92, color: '#7fa2da', pct: 55 },
                        ].map((task) => (
                          <div key={task.title} className="absolute h-8 rounded-full px-3 text-[9px] font-semibold text-[#2f3150] flex items-center justify-between gap-2" style={{ top: task.top, left: task.left, width: task.width, backgroundColor: task.color }}>
                            <span>{task.title}</span>
                            <span className="text-[8px]">{task.pct}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </section>
          ) : activeNav === 'Tasks' ? (
            <section className="bg-[#eef0f6] rounded-xl p-4 min-w-0">
              {showTaskDetails ? (
                <section className="grid grid-cols-1 xl:grid-cols-[1fr_170px] gap-4">
                  <div className="bg-white rounded-xl p-4 shadow-sm">
                    <p className="text-[11px] text-gray-400 mb-3">
                      <button className="underline text-gray-500" onClick={() => setShowTaskDetails(false)}>Tasks</button>
                      {' > '}Task Detail
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
                      {[
                        ['Task Title', 'Demo, code and valid'],
                        ['Project Name', 'Code.Tech'],
                        ['Project Manager', 'Ahmed Ali'],
                        ['Start Date', '03/09/2024'],
                        ['End Date', '03/10/2024'],
                        ['Sub Task', 'code'],
                        ['Task Name', 'Task name'],
                        ['Milestone', 'Milestone 4'],
                        ['Assig To', 'Ahmed Sami, Hossam Farag, Mahmoud Bacher'],
                      ].map(([label, value]) => (
                        <div key={label} className="col-span-1">
                          <p className="text-[10px] text-gray-400 mb-1">{label}</p>
                          <div className="h-8 rounded border border-gray-200 bg-white px-2 text-[10px] text-gray-600 flex items-center">{value}</div>
                        </div>
                      ))}
                    </div>
                    <label className="block mb-3">
                      <span className="text-[10px] text-gray-400 mb-1 block">Task Status</span>
                      <div className="flex items-center gap-3">
                        <select className="w-36 h-8 rounded border border-gray-200 px-2 text-[10px] text-gray-600">
                          <option>Done</option>
                        </select>
                        <input className="w-24 h-8 rounded border border-gray-200 px-2 text-[10px] text-gray-600" defaultValue="2 hrs" />
                        <button className="h-8 px-3 rounded border border-[#d8c9ad] text-[10px] text-[#b28a44]">+ Add subtask</button>
                      </div>
                    </label>
                    <label className="block mb-3">
                      <span className="text-[10px] text-gray-400 mb-1 block">Description</span>
                      <textarea className="w-full h-14 rounded border border-gray-200 px-2 py-1 text-[10px] text-gray-600 resize-none" />
                    </label>
                    <label className="block">
                      <span className="text-[10px] text-gray-400 mb-1 block">Attachment</span>
                      <button className="w-full h-16 rounded border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-400">
                        <span className="font-semibold text-gray-600">Choose a file</span> or drag it here
                      </button>
                    </label>
                    <div className="mt-4 flex justify-end gap-3">
                      <button className="h-8 px-6 rounded-md border border-[#b28a44] text-[#b28a44] text-xs" onClick={() => setShowTaskDetails(false)}>Cancel</button>
                      <button className="h-8 px-6 rounded-md bg-[#b28a44] text-white text-xs">Save & Submit</button>
                    </div>
                  </div>
                  <aside className="bg-white rounded-xl p-3 border border-gray-100">
                    <h3 className="text-xs font-semibold text-[#2f3150] mb-2">Task Logs</h3>
                    <div className="space-y-2 text-[10px] text-gray-500">
                      <div className="p-2 rounded bg-gray-50 border border-gray-100">Fri<br />09/09/2024</div>
                      <div className="p-2 rounded bg-gray-50 border border-gray-100">Mon<br />10/09/2024</div>
                    </div>
                  </aside>
                </section>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-[#2f3150] mb-4">Tasks List</h2>
                  <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 min-w-0">
                    {teamTaskColumns.map((column) => (
                      <div key={column.name} className="space-y-3 min-w-0">
                        <div className="bg-white rounded-xl border border-gray-100 px-3 py-2 flex items-center justify-between">
                          <p className="text-sm font-semibold text-[#2f3150]">{column.name}</p>
                          <button className="text-[10px] text-[#b28a44]">View All</button>
                        </div>
                        {[0, 1, 2].map((idx) => (
                          <div key={`${column.name}-${idx}`} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                            <div className="flex items-center justify-between">
                              <button type="button" onClick={() => setShowTaskDetails(true)} className="text-sm font-semibold" style={{ color: column.color }}>Task Name</button>
                              <span className="px-2 py-0.5 rounded border border-gray-200 text-[9px] text-gray-500">Project Name</span>
                            </div>
                            <p className="text-[11px] text-[#4b5574] mt-1">auditing information architecture</p>
                            <p className="text-[10px] text-gray-400">Create content for pieceland App</p>
                            <p className="text-[10px] mt-2" style={{ color: column.color }}>Sub.Task title</p>
                            <div className="mt-1 flex items-center justify-between text-[10px] text-gray-400">
                              <span className="flex items-center gap-1"><Calendar size={10} /> Due Date</span>
                              <span className="flex items-center gap-1"><Clock size={10} /> {column.name === 'Delayed' ? '5 hrs' : '5 days'}</span>
                            </div>
                            <div className="mt-1 flex items-center justify-between text-[10px] text-gray-400">
                              <span>Aug 20, 2021</span>
                              <button className="w-5 h-5 rounded border border-[#d8c9ad] text-[#b28a44] text-[10px]">↗</button>
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                              <div className="w-4 h-4 rounded-full bg-orange-200 text-[8px] text-orange-700 flex items-center justify-center">E</div>
                              <p className="text-[9px] text-gray-400">11 file</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          ) : activeNav === 'Issues' ? (
            <section className="bg-[#eef0f6] rounded-xl p-4">
              {showIssueDetails ? (
                <section className="grid grid-cols-1 xl:grid-cols-[1fr_170px] gap-4">
                  <div className="bg-white rounded-xl p-4 shadow-sm">
                    <p className="text-[11px] text-gray-400 mb-3">
                      <button className="underline text-gray-500" onClick={() => setShowIssueDetails(false)}>Issue</button>
                      {' > '}Issue Detail
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
                      {[
                        ['Task Title', 'Demo, code and valid'],
                        ['Project Name', 'Code.Tech'],
                        ['Project Manager', 'Ahmed Ali'],
                        ['Start Date', '03/09/2024'],
                        ['End Date', '03/10/2024'],
                        ['Sub Task', 'code'],
                        ['Task name', 'Task name'],
                        ['Milestone', 'Milestone 4'],
                        ['Assign To', 'Ahmed Sami, Hossam Farag, Mahmoud Bacher'],
                      ].map(([label, value]) => (
                        <div key={label} className="col-span-1">
                          <p className="text-[10px] text-gray-400 mb-1">{label}</p>
                          <div className="h-8 rounded border border-gray-200 bg-white px-2 text-[10px] text-gray-600 flex items-center">{value}</div>
                        </div>
                      ))}
                    </div>
                    <label className="block mb-3">
                      <span className="text-[10px] text-gray-400 mb-1 block">Issue Status</span>
                      <div className="flex items-center gap-3">
                        <select className="w-36 h-8 rounded border border-gray-200 px-2 text-[10px] text-gray-600">
                          <option>Open</option>
                          <option>Solved</option>
                        </select>
                        <input className="w-24 h-8 rounded border border-gray-200 px-2 text-[10px] text-gray-600" defaultValue="2 hrs" />
                        <button className="h-8 px-3 rounded border border-[#d8c9ad] text-[10px] text-[#b28a44]">+ Add subtask</button>
                      </div>
                    </label>
                    <label className="block mb-3">
                      <span className="text-[10px] text-gray-400 mb-1 block">Description</span>
                      <textarea className="w-full h-14 rounded border border-gray-200 px-2 py-1 text-[10px] text-gray-600 resize-none" />
                    </label>
                    <label className="block">
                      <span className="text-[10px] text-gray-400 mb-1 block">Attachment</span>
                      <button className="w-full h-16 rounded border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-400">
                        <span className="font-semibold text-gray-600">Choose a file</span> or drag it here
                      </button>
                    </label>
                    <div className="mt-4 flex justify-end gap-3">
                      <button className="h-8 px-6 rounded-md border border-[#b28a44] text-[#b28a44] text-xs" onClick={() => setShowIssueDetails(false)}>Cancel</button>
                      <button className="h-8 px-6 rounded-md bg-[#b28a44] text-white text-xs">Save & Submit</button>
                    </div>
                  </div>
                  <aside className="bg-white rounded-xl p-3 border border-gray-100">
                    <h3 className="text-xs font-semibold text-[#2f3150] mb-2">Task Logs</h3>
                    <div className="space-y-2 text-[10px] text-gray-500">
                      <div className="p-2 rounded bg-gray-50 border border-gray-100">Fri<br />09/09/2024</div>
                      <div className="p-2 rounded bg-gray-50 border border-gray-100">Mon<br />10/09/2024</div>
                    </div>
                  </aside>
                </section>
              ) : (
                <>
              <h2 className="text-xl font-bold text-[#2f3150] mb-4">Issue Register</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-white rounded-xl p-3 shadow-sm">
                  <h3 className="text-sm font-semibold text-[#2f3150] mb-2">Projects vs Issues</h3>
                  <svg viewBox="0 0 220 120" className="w-full h-28 chart-svg">
                    {[0, 10, 20, 30, 40, 50].map((v) => (
                      <g key={v}>
                        <line x1="18" x2="210" y1={92 - v * 1.5} y2={92 - v * 1.5} stroke="#eef2f7" />
                        <text x="4" y={95 - v * 1.5} fontSize="7" fill="#9ca3af">{v}</text>
                      </g>
                    ))}
                    {[['D1', 24, '#b28a44'], ['D2', 47, '#6ea3ef'], ['D3', 31, '#44527f']].map(([m, v, c], i) => (
                      <g key={String(m)}>
                        <rect x={58 + i * 32} y={92 - Number(v) * 1.5} width="12" height={Number(v) * 1.5} rx="2" className="chart-bar" fill={String(c)} />
                        <text x={64 + i * 32} y="108" fontSize="7" textAnchor="middle" fill="#9ca3af">{m}</text>
                      </g>
                    ))}
                  </svg>
                </div>
                <div className="bg-white rounded-xl p-3 shadow-sm">
                  <h3 className="text-sm font-semibold text-[#2f3150] mb-2">Issue Severity</h3>
                  <svg viewBox="0 0 220 120" className="w-full h-28 chart-svg">
                    <circle cx="104" cy="62" r="40" fill="#f3f4f6" />
                    <path d="M104 62 L104 22 A40 40 0 0 1 144 64 Z" fill="#ea6a6a" />
                    <path d="M104 62 L144 64 A40 40 0 0 1 76 92 Z" fill="#efb4b8" />
                    <path d="M104 62 L76 92 A40 40 0 0 1 88 24 Z" fill="#d69ea4" />
                    <circle cx="104" cy="62" r="5" fill="#fff" />
                    <text x="144" y="26" fontSize="8" fill="#ef6b6b">27</text>
                    <text x="144" y="34" fontSize="7" fill="#ef6b6b">Medium</text>
                    <text x="148" y="82" fontSize="8" fill="#ef6b6b">21</text>
                    <text x="148" y="90" fontSize="7" fill="#ef6b6b">High</text>
                    <text x="36" y="88" fontSize="8" fill="#d4a759">46</text>
                    <text x="36" y="96" fontSize="7" fill="#d4a759">Low</text>
                  </svg>
                </div>
                <div className="bg-white rounded-xl p-3 shadow-sm">
                  <h3 className="text-sm font-semibold text-[#2f3150] mb-2">Issue Status</h3>
                  <svg viewBox="0 0 220 120" className="w-full h-28 chart-svg">
                    <circle cx="106" cy="62" r="40" fill="#eef2f7" />
                    <path d="M106 62 L106 22 A40 40 0 1 1 73 84 Z" fill="#dc4f56" />
                    <path d="M106 62 L73 84 A40 40 0 0 1 121 25 Z" fill="#1f67e0" />
                    <circle cx="106" cy="62" r="5" fill="#fff" />
                    <text x="154" y="36" fontSize="8" fill="#1f67e0">20</text>
                    <text x="154" y="44" fontSize="7" fill="#1f67e0">Resolved</text>
                    <text x="40" y="92" fontSize="8" fill="#dc4f56">80</text>
                    <text x="40" y="100" fontSize="7" fill="#dc4f56">Opened</text>
                  </svg>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {[
                  ['Open', '#ef4444'],
                  ['Solve', '#2563eb'],
                ].map(([title, accent]) => (
                  <div key={String(title)} className="space-y-3">
                    <div className="bg-white rounded-xl border border-gray-100 px-3 py-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-[#2f3150]">{title}</p>
                      <button className="text-[10px] text-[#b28a44]">View all</button>
                    </div>
                    {[0, 1, 2].map((idx) => (
                      <div key={`${title}-${idx}`} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                        <div className="flex items-center justify-between">
                          <button type="button" onClick={() => setShowIssueDetails(true)} className="text-sm font-semibold" style={{ color: String(accent) }}>Issue Name</button>
                          <span className="px-2 py-0.5 rounded border border-gray-200 text-[9px] text-gray-500">Project Name</span>
                        </div>
                        <p className="text-[11px] text-[#4b5574] mt-1">Listing deliverables checklist</p>
                        <p className="text-[10px] text-gray-400">Create content for pieceland App. Create content for pieceland App.</p>
                        <div className="mt-2 flex items-center justify-between text-[10px] text-gray-400">
                          <span className="flex items-center gap-1"><AlertCircle size={10} /> {title === 'Open' ? '3 Tasks left' : '24 hrs'}</span>
                          <span>{title === 'Open' ? '07 min' : '2 hrs'}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <div className="w-4 h-4 rounded-full bg-orange-200 text-[8px] text-orange-700 flex items-center justify-center">E</div>
                          <p className="text-[9px] text-gray-400">11 file</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
                </>
              )}
            </section>
          ) : activeNav === 'Calendar' ? (
            <section className="bg-[#eef0f6] rounded-xl p-4">
              {showAddCalendarMeetingForm ? (
                <section className="bg-white rounded-xl p-5 shadow-sm max-w-5xl mx-auto">
                  <p className="text-[11px] text-gray-400 mb-4">
                    <button className="underline text-gray-500" onClick={() => setShowAddCalendarMeetingForm(false)}>Calendar</button>
                    {' > '}Add New Meeting
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3">
                    {[
                      ['Meeting Title *', 'Enter Meeting Title', false],
                      ['Department', 'Select', true],
                      ['Meeting Category *', 'Select Category', true],
                      ['Project Name', 'Select Category', true],
                      ['Vendor Name', 'Select Vendor Name', true],
                      ['Project Manager', 'Auto Fich', false],
                      ['Invite member', 'Select member', true],
                    ].map(([label, placeholder, selectField]) => (
                      <label key={String(label)} className="block">
                        <span className="text-[11px] text-gray-500 mb-1 block">{String(label)}</span>
                        {selectField ? (
                          <select className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-xs text-gray-500">
                            <option>{String(placeholder)}</option>
                          </select>
                        ) : (
                          <input className="w-full h-9 rounded-md border border-gray-200 px-3 text-xs text-gray-600" placeholder={String(placeholder)} />
                        )}
                      </label>
                    ))}
                    <label className="block">
                      <span className="text-[11px] text-gray-500 mb-1 block">Meeting Date *</span>
                      <input className="w-full h-9 rounded-md border border-gray-200 px-3 text-xs text-gray-600" placeholder="Select Date" />
                    </label>
                    <label className="block">
                      <span className="text-[11px] text-gray-500 mb-1 block">Start Time*</span>
                      <input className="w-full h-9 rounded-md border border-gray-200 px-3 text-xs text-gray-600" placeholder="--:--" />
                    </label>
                    <label className="block">
                      <span className="text-[11px] text-gray-500 mb-1 block">End Time*</span>
                      <input className="w-full h-9 rounded-md border border-gray-200 px-3 text-xs text-gray-600" placeholder="--:--" />
                    </label>
                  </div>
                  <label className="block mt-3">
                    <span className="text-[11px] text-gray-500 mb-1 block">Meeting Location</span>
                    <input className="w-full h-9 rounded-md border border-gray-200 px-3 text-xs text-gray-600" placeholder="Enter Meeting Location" />
                  </label>
                  <label className="block mt-3">
                    <span className="text-[11px] text-gray-500 mb-1 block">Meeting Agenda</span>
                    <textarea className="w-full h-20 rounded-md border border-gray-200 px-3 py-2 text-xs text-gray-600 resize-none" placeholder="Agenda..." />
                  </label>
                  <div className="mt-4 flex justify-end gap-3">
                    <button type="button" onClick={() => setShowAddCalendarMeetingForm(false)} className="h-8 px-6 rounded-md border border-[#b28a44] text-[#b28a44] text-xs">Cancel</button>
                    <button className="h-8 px-6 rounded-md bg-[#b28a44] text-white text-xs">Add to Calendar</button>
                  </div>
                </section>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-8">
                      <h2 className="text-xl font-bold text-[#2f3150]">Calendar</h2>
                      <div className="flex items-center gap-3 text-xs">
                        <label className="text-gray-500 flex items-center gap-2">
                          <span>Project Name</span>
                          <select className="h-8 rounded-md border border-gray-200 bg-white px-2 text-[11px] text-gray-500">
                            <option>All</option>
                          </select>
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowCalendarMom(false)}
                          className="h-7 px-3 rounded-full border border-[#d8c9ad] text-[10px] text-[#b28a44] bg-white"
                        >
                          Today
                        </button>
                        <button className="h-7 px-3 rounded-full border border-gray-200 text-[10px] text-gray-500 bg-white">June, 20,2022</button>
                        <button
                          type="button"
                          onClick={() => setShowCalendarMom(true)}
                          className="h-8 px-4 rounded-md border border-[#d8c9ad] text-[11px] text-[#b28a44] bg-white"
                        >
                          MOM
                        </button>
                      </div>
                    </div>
                    <button type="button" onClick={() => setShowAddCalendarMeetingForm(true)} className="h-9 px-4 rounded-md bg-[#b28a44] text-white text-xs font-semibold">+ New Meeting</button>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-[1fr_240px] gap-4">
                    {showCalendarMom ? (
                      <section className="bg-white rounded-xl p-3">
                        <p className="text-[11px] text-gray-400 mb-2">Calendar {'>'} MOM</p>
                        <table className="w-full">
                          <thead className="bg-gray-50 border-b border-gray-100">
                            <tr className="text-[10px] text-gray-400 text-left">
                              <th className="px-3 py-2">Meeting Title</th>
                              <th className="px-3 py-2">Category</th>
                              <th className="px-3 py-2">Project Name</th>
                              <th className="px-3 py-2">Date</th>
                              <th className="px-3 py-2" />
                            </tr>
                          </thead>
                          <tbody>
                            {[
                              ['Title 1', 'Follow-up', 'FP Project', 'Feb 09, 2024'],
                              ['Title 1', 'Review', 'FP Project', 'Feb 09, 2024'],
                              ['Title 1', 'Interview', 'FP Project', 'Feb 09, 2024'],
                              ['Title 1', 'Brainstorm', 'FP Project', 'Feb 09, 2024'],
                              ['Title 1', 'Follow-up', 'FP Project', 'Feb 09, 2024'],
                              ['Title 1', 'Review', 'FP Project', 'Feb 09, 2024'],
                              ['Title 1', 'Interview', 'FP Project', 'Feb 09, 2024'],
                            ].map((row, idx) => (
                              <tr key={idx} className="border-b border-gray-100 text-[11px] text-gray-700">
                                <td className="px-3 py-3 text-indigo-700 font-semibold">{row[0]}</td>
                                <td className="px-3 py-3">{row[1]}</td>
                                <td className="px-3 py-3">{row[2]}</td>
                                <td className="px-3 py-3 text-gray-500">{row[3]}</td>
                                <td className="px-3 py-3 text-gray-400">:</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </section>
                    ) : (
                      <section className="bg-white rounded-xl p-3">
                        <div className="grid grid-cols-[44px_1fr]">
                          <div className="text-[10px] text-gray-300 space-y-8 pt-2">
                            {['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'].map((time) => (
                              <p key={time}>{time}</p>
                            ))}
                          </div>
                          <div className="relative h-[410px] rounded-lg border border-gray-100 bg-[repeating-linear-gradient(to_right,#f6f7fb_0,#f6f7fb_1px,transparent_1px,transparent_16.66%)]">
                            {[15, 73, 139, 205, 271, 337].map((x) => (
                              <div key={x} className="absolute top-0 bottom-0 w-px bg-gray-100" style={{ left: x }} />
                            ))}
                            {[
                              { title: 'Meeting Title 1', top: 56, left: 54, color: '#17c983' },
                              { title: 'Meeting Title 2', top: 220, left: 2, color: '#2563eb' },
                              { title: 'Meeting Title 3', top: 140, left: 180, color: '#f6be00' },
                              { title: 'Meeting Title 4', top: 258, left: 275, color: '#2563eb' },
                              { title: 'Meeting Title 5', top: 96, left: 398, color: '#21c784' },
                              { title: 'Meeting Title 6', top: 140, left: 340, color: '#d35b66' },
                              { title: 'Meeting Title 8', top: 304, left: 331, color: '#f6be00' },
                              { title: 'New', top: 312, left: 78, color: '#474d7f' },
                            ].map((item) => (
                              <div key={item.title + item.top} className="absolute h-8 rounded-full px-4 text-white text-[9px] font-semibold flex items-center" style={{ top: item.top, left: item.left, backgroundColor: item.color }}>
                                {item.title}
                              </div>
                            ))}
                          </div>
                        </div>
                      </section>
                    )}

                    <section className="bg-white rounded-xl p-3">
                  <p className="text-[9px] text-gray-400 uppercase">Current Month</p>
                  <h3 className="text-sm font-semibold text-[#2f3150] mb-2">Scheduled Meetings</h3>
                  <div className="space-y-2">
                    {[
                      ['Standup', '20 HRS', '11', '#c9f4e4', '#138f6f'],
                      ['Requirements Gathering', '12 HRS', '12', '#e9edff', '#4c64bf'],
                      ['Technical Discussion', '22 HRS', '10', '#f7eed8', '#b8872e'],
                      ['Brain Storm Session', '24 HRS', '12', '#eef0ff', '#4d5bb7'],
                      ['Training Sessions', '10 HRS', '5', '#fdf4dd', '#b4882a'],
                      ['Quality Assurance', '22 HRS', '2', '#ffe6e8', '#cb4e59'],
                      ['Documents Review', '20 HRS', '3', '#e9e4ff', '#6958bb'],
                      ['Technical Discussion', '12 HRS', '4', '#e2f7ef', '#2f9879'],
                      ['Interview', '22 HRS', '8', '#ffe6e6', '#ca5454'],
                      ['Others', '22 HRS', '6', '#f5eedf', '#9a7a35'],
                    ].map(([name, hrs, count, bg, text]) => (
                      <div key={String(name) + String(count)} className="rounded-full px-3 py-1.5 flex items-center justify-between" style={{ backgroundColor: String(bg) }}>
                        <div>
                          <p className="text-[10px] font-semibold" style={{ color: String(text) }}>{name}</p>
                          <p className="text-[9px] text-gray-400">{hrs}</p>
                        </div>
                        <span className="w-5 h-5 rounded-full bg-white/80 text-[10px] font-semibold flex items-center justify-center" style={{ color: String(text) }}>{count}</span>
                      </div>
                    ))}
                  </div>
                </section>
                  </div>
                </>
              )}
            </section>
          ) : (
            <>
          {/* ── Overview ── */}
          <section className="bg-white rounded-xl p-5 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              {overviewCards.map(card => (
                <div
                  key={card.label}
                  className={`rounded-xl border-2 ${card.border} bg-white px-4 py-4`}
                >
                  <p className="text-[11px] text-gray-400 mb-3 leading-tight">{card.label}</p>
                  <p className="text-2xl font-extrabold text-[#2f3150]">{card.value}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Insights ── */}
          <section className="bg-white rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Insights</h2>
              <div className="flex items-center gap-2">
                {['Projects', 'All Status', 'This Month'].map(f => (
                  <button
                    key={f}
                    className="flex items-center gap-1 text-xs text-gray-600 border border-gray-200 rounded-md px-3 py-1.5 hover:bg-gray-50 transition-colors"
                  >
                    {f} <ChevronDown size={11} />
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">Assigned Tasks/Projects</p>
                <AssignedTasksChart />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">Tasks</p>
                <TasksChart />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">Issues</p>
                <IssuesDonut />
              </div>
            </div>
          </section>

          {/* ── Tasks table ── */}
          <section className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Tasks</h2>
              <button className="text-xs font-semibold text-indigo-600 hover:underline">View All</button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                {/* Header */}
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className={thCls}>Project<br />Name</th>
                    <th className={thCls}>Task Name</th>
                    <th className={thCls}>Priority</th>
                    <th className={thCls}>Status</th>
                    <th className={thCls}>Project<br />Man.</th>
                    <th className={thCls}>Project<br />Sponsor</th>
                    <th className={thCls}>Milestone</th>
                    <th className={thCls}>Timeline</th>
                    <th className={thCls}>Progress%</th>
                  </tr>
                </thead>

                <tbody>
                  {tasks.map((row, i) => (
                    <>
                      {/* Repeat mini-header before 3rd row to match image */}
                      {i === 2 && (
                        <tr key="sub-header" className="bg-gray-50 border-t border-b border-gray-100">
                          <td className={`${thCls} text-gray-400`}>Project<br />Name</td>
                          <td className={`${thCls} text-gray-400`}>Task Name</td>
                          <td className={`${thCls} text-gray-400`}>Priority</td>
                          <td className={`${thCls} text-gray-400`}>Status</td>
                          <td className={`${thCls} text-gray-400`}>Project<br />Man.</td>
                          <td className={`${thCls} text-gray-400`}>Project<br />Owner</td>
                          <td className={`${thCls} text-gray-400`}>Sprint</td>
                          <td className={`${thCls} text-gray-400`}>Timeline</td>
                          <td className={`${thCls} text-gray-400`}>Progress%</td>
                        </tr>
                      )}
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className={`${tdCls} text-gray-500`}>{row.project}</td>
                        <td className={`${tdCls} font-medium`}>{row.task}</td>
                        <td className={tdCls}><Badge label={row.priority} /></td>
                        <td className={tdCls}><Badge label={row.status} /></td>
                        <td className={tdCls}>{row.pm}</td>
                        <td className={tdCls}>{row.sponsor}</td>
                        <td className={tdCls}>{row.milestone}</td>
                        <td className={tdCls}>
                          <div className="text-[11px] leading-relaxed text-gray-500">
                            <div><span className="text-gray-400">Start date</span><br />{row.start}</div>
                            <div className="mt-1"><span className="text-gray-400">End date</span><br />{row.end}</div>
                          </div>
                        </td>
                        <td className={tdCls}><ProgressBar pct={row.pct} /></td>
                      </tr>
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
            </>
          )}
          </div>
        </main>
      </div>
    </div>
  );
}

// ─── Business dashboard (stakeholder / portfolio view) ─────────────────────────
function BusinessDashboard({ onLogout }: { onLogout: () => void }) {
  const [activeNav, setActiveNav] = useState('Dashboard');
  const [timelineFilter, setTimelineFilter] = useState<'Weekly' | 'Monthly' | 'Yearly'>('Yearly');
  const [timelineMonth, setTimelineMonth] = useState(() => yyyymmFromDate(new Date()));
  const monthInputRef = useRef<HTMLInputElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const programPickerRef = useRef<HTMLDivElement>(null);
  const [programMenuOpen, setProgramMenuOpen] = useState(false);
  const [selectedProgramGroup, setSelectedProgramGroup] = useState('Knowledge & Educational Excellence');
  const [timelineScrollRatio, setTimelineScrollRatio] = useState(0);
  const [timelineCanScrollH, setTimelineCanScrollH] = useState(false);
  const years = ['2013', '2014', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024'];
  const completed = [14, 18, 25, 41, 29, 33, 19, 18, 17, 22, 28, 24];
  const delayed = [20, 28, 23, 46, 34, 29, 34, 25, 38, 43, 37, 22];
  const onTrack = [16, 24, 22, 40, 31, 31, 30, 23, 39, 43, 36, 20];
  const progressData = [
    { label: 'Completed', value: 48, color: '#1d4ed8' },
    { label: 'On Track', value: 34, color: '#10b981' },
    { label: 'Delayed', value: 21, color: '#ef4444' },
    { label: 'On Hold', value: 22, color: '#f59e0b' },
  ];
  const budgetData = [
    { label: 'Financial', value: 352, color: '#3b82f6' },
    { label: 'Knowledge', value: 90.5, color: '#8b5cf6' },
    { label: 'External', value: 130, color: '#f59e0b' },
    { label: 'HR', value: 14.6, color: '#22c55e' },
    { label: 'Admin', value: 496, color: '#9ca3af' },
    { label: 'Digital', value: 135, color: '#a16207' },
  ];
  const navItems = [
    { name: 'Dashboard', icon: <LayoutDashboard size={16} /> },
    { name: 'Business pipeline', icon: <Briefcase size={16} /> },
    { name: 'Timeline', icon: <Calendar size={16} /> },
    { name: 'Reports', icon: <TrendingUp size={16} /> },
    { name: 'Feedback', icon: <MessageSquare size={16} /> },
  ];
  const summaryCards = [
    { title: 'Completed Projects', value: 32, color: '#2563eb', delta: '10+ more from last week', trend: [5, 8, 7, 10, 11, 9, 12] },
    { title: 'On Track Projects', value: 10, color: '#10b981', delta: '10+ more from last week', trend: [4, 5, 5, 6, 8, 7, 9] },
    { title: 'Delayed Project', value: 8, color: '#ef4444', delta: '08+ more from last week', trend: [3, 4, 4, 5, 4, 6, 5] },
  ];
  const kpiData = [
    { label: 'Pinnacle', value: 44, color: '#d4a759' },
    { label: 'Quality', value: 68, color: '#b58a3a' },
    { label: 'Risk', value: 35, color: '#e1c179' },
    { label: 'Efficiency', value: 52, color: '#8b6a2d' },
  ];
  const categoryData = [
    { label: 'Security', value: 59, color: '#2563eb' },
    { label: 'Application', value: 43, color: '#f59e0b' },
    { label: 'Support', value: 36, color: '#4f46e5' },
    { label: 'Infrastructure', value: 23, color: '#60a5fa' },
  ];
  const projectCounts = [
    { label: 'Network', value: 12, color: '#4f46e5' },
    { label: 'Infra', value: 42, color: '#d4a759' },
    { label: 'Support', value: 20, color: '#8b5e34' },
    { label: 'Security', value: 48, color: '#60a5fa' },
    { label: 'Integr.', value: 30, color: '#dc2626' },
  ];
  const budgetVsPlanned = [
    { month: 'JAN', actual: 140, planned: 190 }, { month: 'FEB', actual: 560, planned: 520 },
    { month: 'MAR', actual: 420, planned: 470 }, { month: 'APR', actual: 630, planned: 610 },
    { month: 'MAY', actual: 350, planned: 390 }, { month: 'JUN', actual: 420, planned: 410 },
    { month: 'JUL', actual: 480, planned: 450 }, { month: 'AUG', actual: 520, planned: 500 },
    { month: 'SEP', actual: 310, planned: 370 }, { month: 'OCT', actual: 640, planned: 590 },
    { month: 'NOV', actual: 220, planned: 290 }, { month: 'DEC', actual: 500, planned: 460 },
  ];
  const budgetDeviation = [
    { month: 'JAN', val: -20 }, { month: 'FEB', val: 16 }, { month: 'MAR', val: 22 }, { month: 'APR', val: 30 },
    { month: 'MAY', val: -24 }, { month: 'JUN', val: 16 }, { month: 'JUL', val: -14 }, { month: 'AUG', val: 26 },
    { month: 'SEP', val: -30 }, { month: 'OCT', val: 14 }, { month: 'NOV', val: 20 }, { month: 'DEC', val: 28 },
  ];
  const reportFilterLabels = ['Sector', 'Program', 'Project', 'KPI', 'Type', 'Budget', 'Program Manager', 'Project Manager', 'Duration', 'Status'];
  const reportStats = [
    { label: 'Sectors', value: 104, color: '#34d399' },
    { label: 'Delayed Projects', value: 87, color: '#f87171' },
    { label: 'Programs', value: 63, color: '#60a5fa' },
    { label: 'Projects', value: 108, color: '#fbbf24' },
    { label: 'On Hold', value: 46, color: '#fb7185' },
    { label: 'Completed Programs', value: 71, color: '#3b82f6' },
  ];
  const reportRows = [
    { project: 'DP Factor', priority: 'High', type: 'New', budget: '$42', owner: 'Ahmed Ali', pm: 'Time Bound', start: 'Feb 09, 2024', end: 'May 24, 2024', progress: 88, status: 'COMPLETED', statusColor: 'bg-blue-100 text-blue-700' },
    { project: 'Code.Tech', priority: 'Medium', type: 'Enhanc.', budget: '$25', owner: 'Omar Sami', pm: 'Time Bound', start: 'Feb 09, 2024', end: 'May 24, 2024', progress: 52, status: 'SLIGHTLY DELAYED', statusColor: 'bg-amber-100 text-amber-700' },
    { project: 'Ex.Process', priority: 'Medium', type: 'Change Request', budget: '$30', owner: 'Waleed Ali', pm: 'Time Bound', start: 'Feb 09, 2024', end: 'May 24, 2024', progress: 76, status: 'ON TRACK', statusColor: 'bg-emerald-100 text-emerald-700' },
    { project: 'Scaling', priority: 'Low', type: 'Change Request', budget: '$30', owner: 'Amr Fahmy', pm: 'Time Bound', start: 'Feb 09, 2024', end: 'May 24, 2024', progress: 21, status: 'DELAYED', statusColor: 'bg-rose-100 text-rose-700' },
    { project: 'DP Factor', priority: 'High', type: 'New', budget: '$42', owner: 'Ahmed Ali', pm: 'Time Bound', start: 'Feb 09, 2024', end: 'May 24, 2024', progress: 90, status: 'COMPLETED', statusColor: 'bg-blue-100 text-blue-700' },
  ];
  const pipelineBars = [
    { label: '2023 Q2', value: 6, color: '#7c3aed' },
    { label: '2023 Q3', value: 32, color: '#4cc9f0' },
    { label: '2023 Q4', value: 12, color: '#16a34a' },
    { label: '2024 Q1', value: 39, color: '#2563eb' },
    { label: '2024 Q1', value: 21, color: '#74c69d' },
    { label: '2024 Q2', value: 27, color: '#fb923c' },
    { label: '2024 Q2', value: 20, color: '#ef4444' },
    { label: '2024 Q3', value: 30, color: '#22c55e' },
    { label: '2024 Q3', value: 32, color: '#e9c46a' },
    { label: '2024 Q4', value: 14, color: '#6b7280' },
  ];
  const pipelineLegend = [
    { label: 'Strategic', color: '#16a34a' }, { label: 'Construction', color: '#6366f1' },
    { label: 'Support', color: '#2563eb' }, { label: 'Outsource', color: '#e9c46a' },
    { label: 'Implementation', color: '#7c3aed' }, { label: 'Infrastructure', color: '#22c55e' },
    { label: 'Time & Material', color: '#10b981' }, { label: 'Security', color: '#f59e0b' },
    { label: 'Managed Services', color: '#0ea5e9' }, { label: 'Application', color: '#ef4444' },
  ];
  const pipelineRows = [
    { name: 'Pinnacle', benefit: 'Productivity', budget: '$42', pm: 'Ahmed Ali', start: 'Feb 09, 2024', end: 'May 24, 2024', stage: 'RFP' },
    { name: 'Right Path', benefit: 'Efficiency', budget: '$25', pm: 'Omar Sami', start: 'Feb 09, 2024', end: 'May 24, 2024', stage: 'awarding' },
    { name: 'Road Map', benefit: 'Productivity', budget: '$30', pm: 'Waleed Ali', start: 'Feb 09, 2024', end: 'May 24, 2024', stage: 'business case approval' },
    { name: 'Coreline', benefit: 'Improvement', budget: '$30', pm: 'Amr Fahmy', start: 'Feb 09, 2024', end: 'May 24, 2024', stage: 'budget approval' },
    { name: 'Growth', benefit: 'Plan Realisation', budget: '$42', pm: 'Ahmed Ali', start: 'Feb 09, 2024', end: 'May 24, 2024', stage: 'acquiring resources' },
    { name: 'TopWay', benefit: 'Identify Benefits', budget: '$30', pm: 'Omar Sami', start: 'Feb 09, 2024', end: 'May 24, 2024', stage: 'allocate resources' },
    { name: 'Green Pro', benefit: 'Identify Benefits', budget: '$30', pm: 'Waleed Ali', start: 'Feb 09, 2024', end: 'May 24, 2024', stage: 'contract signing' },
  ];
  const timelinePrograms = [
    { group: 'Pinnacle Program', items: ['Code.Tech', 'Inno.Sales', 'Serv.In'] },
    { group: 'Financial Program', items: ['Code.Tech', 'Inno.Sales', 'Serv.In'] },
    { group: 'Growth Program', items: ['Code.Tech', 'Inno.Sales', 'Serv.In', 'Inno.Sales', 'Serv.In'] },
    { group: 'Road.map Program', items: ['Code.Tech', 'Inno.Sales', 'Serv.In'] },
    { group: 'RightPath Program', items: [] },
    { group: 'Production Program', items: [] },
  ];
  const timelineTracks = [
    { label: 'Profile', start: 10, width: 14, row: 1, color: '#59628a', progress: '44%' },
    { label: 'Logo', start: 3, width: 20, row: 2, color: '#19c37d', progress: '38%' },
    { label: 'Testimonial', start: 18, width: 18, row: 3, color: '#59628a', progress: '63%' },
    { label: 'Menu', start: 18, width: 12, row: 4, color: '#f4b400', progress: '87%' },
    { label: 'Settings', start: 70, width: 16, row: 5, color: '#1766e5', progress: '90%' },
    { label: 'Portfolio', start: 14, width: 34, row: 6, color: '#1766e5', progress: '63%' },
    { label: 'Menu', start: 15, width: 10, row: 7, color: '#19c37d', progress: '54%' },
    { label: 'Profile', start: 3, width: 18, row: 9, color: '#59628a', progress: '46%' },
    { label: 'Services', start: 36, width: 22, row: 10, color: '#f4b400', progress: '54%' },
    { label: 'Website', start: 60, width: 20, row: 2, color: '#f4b400', progress: '54%' },
    { label: 'Homepage', start: 74, width: 18, row: 6, color: '#19c37d', progress: '71%' },
  ];

  const sparklinePath = (values: number[], width: number, height: number) => {
    const max = Math.max(...values);
    const min = Math.min(...values);
    return values
      .map((v, i) => {
        const x = (i / (values.length - 1)) * width;
        const y = height - ((v - min) / (max - min || 1)) * height;
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  };

  const portfolioFilterOptions = [
    'Knowledge & Educational Excellence',
    'Strategic portfolio',
    'Operational programs',
  ];
  const timelineMonthLabels = sixMonthNamesStarting(timelineMonth);
  const timelineWeekLabels = weekLabelsFromMonthStart(timelineMonth, 24);
  const timelineMaxRow = Math.max(...timelineTracks.map((t) => t.row), 1);
  const timelineBodyMinHeight = Math.max(560, timelineMaxRow * 48 + 72);

  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      if (!programMenuOpen) return;
      const el = programPickerRef.current;
      if (el && !el.contains(e.target as Node)) setProgramMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [programMenuOpen]);

  useEffect(() => {
    const el = timelineScrollRef.current;
    if (!el || activeNav !== 'Timeline') return;
    const sync = () => {
      const max = el.scrollWidth - el.clientWidth;
      setTimelineCanScrollH(max > 2);
      setTimelineScrollRatio(max <= 0 ? 0 : el.scrollLeft / max);
    };
    sync();
    el.addEventListener('scroll', sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', sync);
      ro.disconnect();
    };
  }, [activeNav, timelineMonth]);

  const openMonthPicker = () => {
    const el = monthInputRef.current;
    if (!el) return;
    const inp = el as HTMLInputElement & { showPicker?: () => void | Promise<void> };
    const ret = inp.showPicker?.();
    if (ret != null && typeof (ret as Promise<void>).then === 'function') {
      void (ret as Promise<void>).catch(() => {
        inp.click();
      });
    } else if (ret == null) {
      inp.click();
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f6fb] text-gray-800">
      <aside className="w-52 bg-white border-r border-gray-100 flex flex-col flex-shrink-0">
        <div className="px-5 py-5 border-b border-gray-100">
          <LogoMark />
        </div>
        <nav className="flex-1 py-4 px-3 space-y-0.5">
          {navItems.map(({ name, icon }) => (
            <button
              key={name}
              type="button"
              onClick={() => setActiveNav(name)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeNav === name ? 'bg-indigo-50 text-[#151d5d]' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              <span className={`w-0.5 h-5 rounded-full ${activeNav === name ? 'bg-[#b28a44]' : 'bg-transparent'}`} />
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
            <ProfileDropdown onLogout={onLogout} />
          </div>
        </header>

        <main className="flex-1 overflow-auto p-5 space-y-4">
          {activeNav === 'Timeline' ? (
            <>
              <section className="bg-white rounded-xl p-4 shadow-sm chart-card">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h2 className="text-2xl font-semibold text-[#2d356b]">Timeline</h2>
                  <div className="flex items-center gap-2">
                    <input
                      ref={monthInputRef}
                      type="month"
                      value={timelineMonth}
                      onChange={(e) => setTimelineMonth(e.target.value)}
                      className="sr-only"
                      tabIndex={-1}
                      aria-hidden
                    />
                    <button
                      type="button"
                      onClick={() => setTimelineMonth(yyyymmFromDate(new Date()))}
                      className="h-8 px-4 rounded-full border border-amber-300 text-[11px] text-amber-700 hover:bg-amber-50 transition-colors"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={openMonthPicker}
                      className="h-8 px-4 rounded-full border border-gray-200 text-[11px] text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      {formatTimelineMonthHeading(timelineMonth)}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-3 min-h-0">
                  <div className="bg-[#f6f8fb] rounded-lg p-3 flex flex-col min-h-0">
                    <div className="relative mb-2 shrink-0" ref={programPickerRef}>
                      <button
                        type="button"
                        onClick={() => setProgramMenuOpen((o) => !o)}
                        className="w-full h-7 px-2 rounded-md border border-gray-200 text-[10px] text-left text-gray-600 flex items-center justify-between gap-2 bg-white"
                      >
                        <span className="truncate">{selectedProgramGroup}</span>
                        <ChevronDown size={10} className={`shrink-0 text-gray-400 transition-transform ${programMenuOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {programMenuOpen && (
                        <ul className="absolute left-0 right-0 top-full z-20 mt-1 py-1 rounded-md border border-gray-200 bg-white shadow-lg max-h-40 overflow-auto">
                          {portfolioFilterOptions.map((opt) => (
                            <li key={opt}>
                              <button
                                type="button"
                                className={`w-full text-left px-2 py-1.5 text-[10px] hover:bg-gray-50 ${opt === selectedProgramGroup ? 'text-[#151d5d] font-semibold bg-indigo-50/50' : 'text-gray-600'}`}
                                onClick={() => {
                                  setSelectedProgramGroup(opt);
                                  setProgramMenuOpen(false);
                                }}
                              >
                                {opt}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="space-y-2 flex-1 min-h-0 max-h-[560px] overflow-y-auto overflow-x-hidden pr-1 overscroll-contain">
                      {timelinePrograms.map((program) => (
                        <div key={program.group} className="bg-white border border-gray-100 rounded-md p-2">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-[#3a4275]">
                            <span>{program.group}</span>
                            <ChevronDown size={10} className="text-gray-400" />
                          </div>
                          {program.items.length > 0 && (
                            <ul className="mt-2 space-y-1">
                              {program.items.map((item, index) => (
                                <li key={`${program.group}-${item}-${index}`} className="text-[10px] text-gray-400 flex items-center gap-2">
                                  <span className="w-2 h-2 border border-gray-300 rounded-sm shrink-0" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 space-y-2 shrink-0">
                      {['Human Resources', 'Financial Resources', 'Digital Transformation', 'Administrative Affairs', 'Administrative Affairs'].map((item, i) => (
                        <button
                          key={`${item}-${i}`}
                          type="button"
                          className="w-full h-7 px-2 rounded-md border border-gray-200 text-[10px] text-left text-gray-600 flex items-center justify-between hover:bg-white/80"
                        >
                          <span className="truncate">{item}</span>
                          <ChevronDown size={10} className="shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white border border-gray-100 rounded-lg overflow-hidden flex flex-col min-h-0 min-w-0">
                    <div
                      ref={timelineScrollRef}
                      className="overflow-x-auto overflow-y-auto max-h-[560px] overscroll-contain scroll-smooth"
                    >
                      <div className="min-w-[1040px]">
                        <div className="sticky top-0 z-10 bg-white px-3 py-2 border-b border-gray-100 shadow-sm">
                          <div className="text-[9px] uppercase text-gray-400 flex justify-between gap-4 min-w-[880px] px-0.5">
                            {timelineMonthLabels.map((m) => (
                              <span key={m} className="flex-1 text-center min-w-0 truncate">
                                {m}
                              </span>
                            ))}
                          </div>
                          <div className="mt-1 text-[10px] text-gray-500 flex items-center gap-4 min-w-max pr-2">
                            {timelineWeekLabels.map((w, i) => (
                              <span key={`${w}-${i}`} className="w-6 shrink-0 text-center whitespace-nowrap">
                                {w}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div
                          className="relative bg-[repeating-linear-gradient(to_right,_#f1f5f9_0,_#f1f5f9_1px,_transparent_1px,_transparent_34px)] chart-svg"
                          style={{ minHeight: timelineBodyMinHeight }}
                        >
                          {timelineTracks.map((track, idx) => (
                            <div
                              key={`${track.label}-${idx}`}
                              className="absolute h-6 rounded-full text-white text-[9px] px-3 flex items-center justify-between shadow-sm transition-all duration-300 hover:scale-[1.02]"
                              style={{
                                left: `${track.start}%`,
                                width: `${track.width}%`,
                                top: `${track.row * 48}px`,
                                backgroundColor: track.color,
                              }}
                            >
                              <span className="truncate">{track.label}</span>
                              <span className="bg-white/85 text-gray-500 px-1.5 rounded-full shrink-0">{track.progress}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="h-6 bg-gray-100 border-t border-gray-100 flex items-center px-2 gap-2">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={0.25}
                        value={timelineScrollRatio * 100}
                        disabled={!timelineCanScrollH}
                        onChange={(e) => {
                          const el = timelineScrollRef.current;
                          if (!el) return;
                          const max = el.scrollWidth - el.clientWidth;
                          el.scrollLeft = (Number(e.target.value) / 100) * max;
                        }}
                        className="w-full h-1.5 accent-gray-500 disabled:opacity-30 cursor-ew-resize disabled:cursor-not-allowed"
                        aria-label="Scroll timeline horizontally"
                      />
                    </div>
                  </div>
                </div>
              </section>
            </>
          ) : activeNav === 'Business pipeline' ? (
            <>
              <section className="bg-white rounded-xl p-4 shadow-sm chart-card">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Business Pipeline</h2>
                <div className="border border-gray-100 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] uppercase tracking-wide text-gray-400">Projects</p>
                    <div className="flex items-center gap-2">
                      <button className="h-7 px-2 rounded-md border border-gray-200 text-[10px] text-gray-500">Year 2024</button>
                      <button className="h-7 px-2 rounded-md border border-gray-200 text-[10px] text-gray-500">All Categories</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-center">
                    <div className="lg:col-span-3">
                      <svg viewBox="0 0 700 210" className="w-full h-52 chart-svg">
                        {[0, 10, 20, 30, 40].map((v) => (
                          <g key={v}>
                            <line x1="26" x2="680" y1={180 - v * 3.6} y2={180 - v * 3.6} stroke="#edf2f7" />
                            <text x="14" y={184 - v * 3.6} fontSize="9" fill="#94a3b8">{v}</text>
                          </g>
                        ))}
                        {pipelineBars.map((bar, index) => (
                          <g key={`${bar.label}-${index}`}>
                            <rect className="chart-bar" x={48 + index * 62} y={180 - bar.value * 3.6} width="18" height={bar.value * 3.6} rx="4" fill={bar.color} />
                            <text x={57 + index * 62} y="198" fontSize="8" textAnchor="middle" fill="#94a3b8">{bar.label}</text>
                          </g>
                        ))}
                        <text x="690" y="198" fontSize="8" fill="#94a3b8">TIMELINE</text>
                      </svg>
                    </div>
                    <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-[10px]">
                      {pipelineLegend.map((item) => (
                        <div key={item.label} className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-gray-500">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-y border-gray-100">
                    <tr className="text-[10px] text-gray-400 uppercase text-left">
                      <th className="px-4 py-2">Program Name</th>
                      <th className="px-4 py-2">Benefits</th>
                      <th className="px-4 py-2">Budget</th>
                      <th className="px-4 py-2">Duration</th>
                      <th className="px-4 py-2">Current Stage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pipelineRows.map((row) => (
                      <tr key={row.name} className="border-b border-gray-100 text-xs text-gray-700">
                        <td className="px-4 py-2 text-indigo-700 underline">{row.name}</td>
                        <td className="px-4 py-2">{row.benefit}</td>
                        <td className={`px-4 py-2 font-semibold ${row.budget === '$25' ? 'text-emerald-500' : row.budget === '$42' ? 'text-rose-500' : 'text-indigo-700'}`}>{row.budget}</td>
                        <td className="px-4 py-2">
                          <div className="leading-4">
                            <p className="text-[10px] text-gray-400">Start date</p>
                            <p>{row.start}</p>
                            <p className="text-[10px] text-gray-400 mt-1">End date</p>
                            <p>{row.end}</p>
                          </div>
                        </td>
                        <td className="px-4 py-2">{row.stage}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </>
          ) : activeNav === 'Reports' ? (
            <>
              <section className="bg-white rounded-xl p-4 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-800 mb-3">Reports</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-10 gap-2">
                  {reportFilterLabels.map((label) => (
                    <div key={label} className="min-w-0">
                      <p className="text-[10px] text-gray-400 mb-1">{label}</p>
                      <button className="w-full h-7 rounded-md border border-gray-200 bg-gray-50 text-[10px] text-gray-500 flex items-center justify-between px-2">
                        <span>All</span>
                        <ChevronDown size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                {reportStats.map((card) => (
                  <div key={card.label} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 chart-card">
                    <p className="text-[10px] text-gray-400">{card.label}</p>
                    <p className="text-3xl font-bold text-gray-800 mt-1">{card.value}</p>
                    <div className="h-0.5 rounded-full mt-3" style={{ backgroundColor: card.color }} />
                  </div>
                ))}
              </section>

              <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl p-3 shadow-sm chart-card min-h-[220px]">
                  <h3 className="text-xs font-semibold text-gray-700 mb-2">Project Category</h3>
                  <DonutChart
                    className="w-full h-40 chart-svg"
                    slices={[
                      { label: 'Application', value: 43, color: '#1667de' },
                      { label: 'Security', value: 59, color: '#d3525a' },
                      { label: 'Support', value: 36, color: '#3b3a80' },
                      { label: 'Infrastructure', value: 23, color: '#f6be00' },
                    ]}
                    ringWidth={42}
                  />
                </div>
                <div className="bg-white rounded-xl p-3 shadow-sm chart-card min-h-[220px]">
                  <h3 className="text-xs font-semibold text-gray-700 mb-2">Projects Count</h3>
                  <svg viewBox="0 0 220 170" className="w-full h-40 chart-svg">
                    {[20, 40, 60, 80].map((v) => (
                      <line key={v} x1="26" x2="214" y1={140 - v} y2={140 - v} stroke="#f1f5f9" />
                    ))}
                    <text x="6" y="141" fontSize="8" fill="#9ca3af">0</text>
                    <text x="2" y="121" fontSize="8" fill="#9ca3af">20</text>
                    <text x="2" y="101" fontSize="8" fill="#9ca3af">40</text>
                    <text x="2" y="81" fontSize="8" fill="#9ca3af">60</text>
                    <text x="2" y="61" fontSize="8" fill="#9ca3af">80</text>
                    {projectCounts.map((bar, index) => (
                      <g key={bar.label}>
                        <rect className="chart-bar" x={35 + index * 36} y={140 - bar.value * 1.6} width="12" height={bar.value * 1.6} rx="3" fill={bar.color} />
                        <text x={40 + index * 36} y="154" fontSize="8" textAnchor="middle" fill="#9ca3af" transform={`rotate(-65 40 ${154})`}>
                          {bar.label}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
                <div className="bg-white rounded-xl p-3 shadow-sm chart-card min-h-[220px]">
                  <h3 className="text-xs font-semibold text-gray-700 mb-2">Budget</h3>
                  <div className="flex items-center justify-between gap-2">
                    <DonutChart
                      className="w-[62%] h-40 chart-svg"
                      showOuterLabels={false}
                      ringWidth={44}
                      slices={[
                        { label: 'Financial', value: 352, color: '#1667de' },
                        { label: 'Knowledge', value: 90, color: '#f6be00' },
                        { label: 'External', value: 130, color: '#3b3a80' },
                        { label: 'HR', value: 15, color: '#d3525a' },
                        { label: 'Admin', value: 496, color: '#64748b' },
                      ]}
                    />
                    <div className="w-[38%] text-[8px] text-gray-500 space-y-1">
                      <p>AED890,600 <span className="block">Knowledge & External</span></p>
                      <p>AED14,600 <span className="block">HR</span></p>
                      <p>AED436,000 <span className="block">Administrative Affairs</span></p>
                      <p>AED325,000 <span className="block">Financial Resources</span></p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-3 shadow-sm chart-card min-h-[220px]">
                  <h3 className="text-xs font-semibold text-gray-700 mb-2">Projects by progress</h3>
                  <div className="flex items-center justify-between gap-2">
                    <DonutChart
                      className="w-[68%] h-40 chart-svg"
                      showOuterLabels={false}
                      ringWidth={44}
                      slices={[
                        { label: 'Completed', value: 46, color: '#1667de' },
                        { label: 'On Hold', value: 27, color: '#f6be00' },
                        { label: 'Delayed', value: 21, color: '#d3525a' },
                      ]}
                    />
                    <div className="w-[32%] text-[8px] text-gray-500 space-y-1">
                      <p className="text-blue-600"><span className="font-semibold">46</span> Completed</p>
                      <p className="text-amber-500"><span className="font-semibold">27</span> On Hold</p>
                      <p className="text-rose-500"><span className="font-semibold">21</span> Delayed</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-y border-gray-100">
                    <tr className="text-[10px] text-gray-400 uppercase text-left">
                      <th className="px-3 py-2">Project Name</th>
                      <th className="px-3 py-2">Priority</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Budget</th>
                      <th className="px-3 py-2">Strag. Obj</th>
                      <th className="px-3 py-2">PM</th>
                      <th className="px-3 py-2">Dates</th>
                      <th className="px-3 py-2">Progress Level</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportRows.map((row, idx) => (
                      <tr key={`${row.project}-${idx}`} className="border-b border-gray-100 text-xs text-gray-700">
                        <td className="px-3 py-2 text-indigo-700 underline">{row.project}</td>
                        <td className="px-3 py-2">{row.priority}</td>
                        <td className="px-3 py-2">{row.type}</td>
                        <td className="px-3 py-2 font-semibold text-rose-500">{row.budget}</td>
                        <td className="px-3 py-2">{row.pm}</td>
                        <td className="px-3 py-2">{row.owner}</td>
                        <td className="px-3 py-2">
                          <div className="leading-4">
                            <p className="text-[10px] text-gray-400">Start date</p>
                            <p>{row.start}</p>
                            <p className="text-[10px] text-gray-400 mt-1">End date</p>
                            <p>{row.end}</p>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${row.progress}%` }} />
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-1 rounded-full text-[9px] font-semibold ${row.statusColor}`}>{row.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-3 py-2 text-[10px] text-gray-400 text-right">1-10 of 15</div>
              </section>
            </>
          ) : activeNav === 'Feedback' ? (
            <BusinessFeedbackList />
          ) : (
            <>
          <section className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">
            {summaryCards.map((card) => (
              <div key={card.title} className="bg-white rounded-xl p-4 shadow-sm lg:col-span-1 chart-card min-h-[170px]">
                <p className="text-xs text-gray-500">{card.title}</p>
                <p className="text-2xl font-bold mt-1">{card.value}</p>
                <svg viewBox="0 0 140 40" className="w-full h-12 mt-2 chart-svg">
                  <path d={sparklinePath(card.trend, 140, 34)} fill="none" stroke={card.color} strokeWidth="2.5" />
                </svg>
                <p className="text-[11px] text-gray-400">{card.delta}</p>
              </div>
            ))}

            <div className="bg-white rounded-xl p-4 shadow-sm lg:col-span-2 chart-card min-h-[220px]">
              <h3 className="text-sm font-bold text-gray-900 mb-2">Projects by progress</h3>
              <div className="flex items-center gap-4">
                <svg viewBox="0 0 160 160" className="w-36 h-36 chart-svg">
                  {(() => {
                    const total = progressData.reduce((sum, item) => sum + item.value, 0);
                    let angle = -90;
                    return progressData.map((slice) => {
                      const sweep = (slice.value / total) * 360;
                      const start = (Math.PI / 180) * angle;
                      const end = (Math.PI / 180) * (angle + sweep);
                      const largeArc = sweep > 180 ? 1 : 0;
                      const x1 = 80 + Math.cos(start) * 52;
                      const y1 = 80 + Math.sin(start) * 52;
                      const x2 = 80 + Math.cos(end) * 52;
                      const y2 = 80 + Math.sin(end) * 52;
                      angle += sweep;
                      return (
                        <path
                          key={slice.label}
                          d={`M ${x1} ${y1} A 52 52 0 ${largeArc} 1 ${x2} ${y2}`}
                          stroke={slice.color}
                          strokeWidth="20"
                          fill="none"
                          strokeLinecap="round"
                        />
                      );
                    });
                  })()}
                </svg>
                <div className="space-y-2 text-xs">
                  {progressData.map((item) => (
                    <div key={item.label} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-gray-500 w-20">{item.label}</span>
                      <span className="font-semibold text-gray-800">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">
            <div className="bg-white rounded-xl p-4 shadow-sm lg:col-span-3 chart-card">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold text-gray-900">Project Timeline</h2>
                <div className="flex items-center gap-2 text-xs">
                  {(['Weekly', 'Monthly', 'Yearly'] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setTimelineFilter(filter)}
                      className={timelineFilter === filter ? 'text-amber-700 font-semibold' : 'text-gray-400'}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>
              <svg viewBox="0 0 640 220" className="w-full h-64 chart-svg">
                {[10, 20, 30, 40, 50].map((v) => (
                  <line key={v} x1="42" x2="620" y1={210 - v * 3.5} y2={210 - v * 3.5} stroke="#f1f5f9" />
                ))}
                {years.map((year, i) => (
                  <text key={year} x={48 + i * 52} y="212" fontSize="9" fill="#94a3b8">{year}</text>
                ))}
                <polyline
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="2.2"
                  points={completed.map((v, i) => `${48 + i * 52},${210 - v * 3.5}`).join(' ')}
                />
                <polyline
                  fill="none"
                  stroke="#b0823a"
                  strokeWidth="2.2"
                  points={delayed.map((v, i) => `${48 + i * 52},${210 - v * 3.5}`).join(' ')}
                />
                <polyline
                  fill="none"
                  stroke="#374151"
                  strokeWidth="1.6"
                  strokeDasharray="5 4"
                  points={onTrack.map((v, i) => `${48 + i * 52},${210 - v * 3.5}`).join(' ')}
                />
              </svg>
            </div>

            <div className="lg:col-span-2 h-full flex">
              <section className="bg-white rounded-xl p-4 shadow-sm h-full w-full chart-card">
                <h3 className="text-sm font-bold text-gray-900 mb-2">Budget</h3>
                <div className="flex items-center gap-4">
                  <svg viewBox="0 0 160 160" className="w-36 h-36 chart-svg">
                    {(() => {
                      const total = budgetData.reduce((sum, item) => sum + item.value, 0);
                      let angle = -90;
                      return budgetData.map((slice) => {
                        const sweep = (slice.value / total) * 360;
                        const start = (Math.PI / 180) * angle;
                        const end = (Math.PI / 180) * (angle + sweep);
                        const largeArc = sweep > 180 ? 1 : 0;
                        const x1 = 80 + Math.cos(start) * 56;
                        const y1 = 80 + Math.sin(start) * 56;
                        const x2 = 80 + Math.cos(end) * 56;
                        const y2 = 80 + Math.sin(end) * 56;
                        angle += sweep;
                        return (
                          <path
                            key={slice.label}
                            d={`M 80 80 L ${x1} ${y1} A 56 56 0 ${largeArc} 1 ${x2} ${y2} Z`}
                            fill={slice.color}
                          />
                        );
                      });
                    })()}
                    <circle cx="80" cy="80" r="18" fill="#fff" />
                  </svg>
                  <div className="space-y-1.5 text-[10px]">
                    {budgetData.slice(0, 5).map((item) => (
                      <div key={item.label} className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-gray-500 w-16">{item.label}</span>
                        <span className="text-gray-700">AED{item.value}k</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm min-h-[300px] chart-card">
              <h3 className="text-sm font-bold text-gray-900 mb-2">KPI</h3>
              <div className="h-52 flex items-end justify-around gap-2">
                {kpiData.map((bar) => (
                  <div key={bar.label} className="flex flex-col items-center gap-2">
                    <div className="w-9 rounded-t-md chart-bar" style={{ height: `${bar.value * 1.3}px`, backgroundColor: bar.color }} />
                    <span className="text-[10px] text-gray-500">{bar.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm min-h-[300px] chart-card">
              <h3 className="text-sm font-bold text-gray-900 mb-2">Projects Category</h3>
              <div className="flex items-center gap-4 h-52">
                <svg viewBox="0 0 160 160" className="w-36 h-36 flex-shrink-0 chart-svg">
                  {(() => {
                    const total = categoryData.reduce((sum, item) => sum + item.value, 0);
                    let angle = -90;
                    return categoryData.map((slice) => {
                      const sweep = (slice.value / total) * 360;
                      const start = (Math.PI / 180) * angle;
                      const end = (Math.PI / 180) * (angle + sweep);
                      const largeArc = sweep > 180 ? 1 : 0;
                      const x1 = 80 + Math.cos(start) * 52;
                      const y1 = 80 + Math.sin(start) * 52;
                      const x2 = 80 + Math.cos(end) * 52;
                      const y2 = 80 + Math.sin(end) * 52;
                      angle += sweep;
                      return (
                        <path
                          key={slice.label}
                          d={`M ${x1} ${y1} A 52 52 0 ${largeArc} 1 ${x2} ${y2}`}
                          stroke={slice.color}
                          strokeWidth="22"
                          fill="none"
                          strokeLinecap="round"
                        />
                      );
                    });
                  })()}
                </svg>
                <div className="space-y-2 text-xs">
                  {categoryData.map((item) => (
                    <div key={item.label} className="flex items-center gap-2">
                      <span className="font-semibold text-gray-800">{item.value}</span>
                      <span className="text-gray-500">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm min-h-[300px] chart-card">
              <h3 className="text-sm font-bold text-gray-900 mb-2">Projects Count</h3>
              <div className="h-52 flex items-end justify-around gap-2">
                {projectCounts.map((bar) => (
                  <div key={bar.label} className="flex flex-col items-center gap-2">
                    <div className="w-9 rounded-t-md chart-bar" style={{ height: `${bar.value * 2.2}px`, backgroundColor: bar.color }} />
                    <span className="text-[10px] text-gray-500">{bar.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm chart-card">
              <h3 className="text-sm font-bold text-gray-900 mb-2">BUDGETING - Actual VS Planned</h3>
              <div className="h-44 flex items-end gap-1 overflow-hidden">
                {budgetVsPlanned.map((item) => (
                  <div key={item.month} className="flex-1 flex flex-col items-center justify-end">
                    <div className="flex items-end gap-[2px] h-36">
                      <div className="rounded-t bg-[#d9bf89] chart-bar" style={{ width: '6px', height: `${item.actual / 5}px` }} />
                      <div className="rounded-t bg-[#a07b3c] chart-bar" style={{ width: '6px', height: `${item.planned / 5}px` }} />
                    </div>
                    <span className="text-[9px] text-gray-400 mt-1">{item.month}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm chart-card">
              <h3 className="text-sm font-bold text-gray-900 mb-2">BUDGETING - Deviation</h3>
              <svg viewBox="0 0 600 200" className="w-full h-44 chart-svg">
                <line x1="20" y1="100" x2="580" y2="100" stroke="#d1d5db" />
                {budgetDeviation.map((item, i) => (
                  <g key={item.month}>
                    <rect
                      x={26 + i * 46}
                      y={item.val >= 0 ? 100 - item.val * 2 : 100}
                      width="18"
                      height={Math.abs(item.val * 2)}
                      fill="#a07b3c"
                      rx="2"
                    />
                    <text x={35 + i * 46} y="194" textAnchor="middle" fontSize="9" fill="#9ca3af">{item.month}</text>
                  </g>
                ))}
              </svg>
            </div>
          </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function ProgramDashboard({ onLogout }: { onLogout: () => void }) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [activeNav, setActiveNav] = useState('Dashboard');
  const [showAddProjectForm, setShowAddProjectForm] = useState(false);
  const [showAddMeetingForm, setShowAddMeetingForm] = useState(false);
  const [showAddDeliverableForm, setShowAddDeliverableForm] = useState(false);
  const [showAddReportForm, setShowAddReportForm] = useState(false);
  const [showAddProgramForm, setShowAddProgramForm] = useState(false);
  const [programFormMode, setProgramFormMode] = useState<'add' | 'edit'>('add');
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [programForm, setProgramForm] = useState({
    programName: '',
    benefits: '',
    programManager: '',
    budget: '',
    startDate: todayIso,
    endDate: todayIso,
    roi: '',
    kpi: '',
    status: '',
  });
  const [programFormBusy, setProgramFormBusy] = useState(false);
  const [programFormMsg, setProgramFormMsg] = useState('');
  const [programToast, setProgramToast] = useState<{ type: ToastType; message: string } | null>(null);
  const [projectFormBusy, setProjectFormBusy] = useState(false);
  const [projectFormErrors, setProjectFormErrors] = useState<Record<string, string>>({});
  const [projectMetaLoading, setProjectMetaLoading] = useState(false);
  const [projectForm, setProjectForm] = useState({
    projectName: '',
    programName: '',
    vendorName: '',
    projectPriority: '',
    projectCategory: '',
    projectType: '',
    strategicGoal: '',
    budget: '',
    assignToProjectManager: '',
    risks: '',
    kpi: '',
    methodology: '',
    startDate: todayIso,
    endDate: todayIso,
    department: '',
    projectStatus: '',
    milestone: '',
    projectSponsor: '',
    note: '',
    attachment: null as File | null,
  });
  const [projectChoiceOptions, setProjectChoiceOptions] = useState<{
    projectPriority: Array<{ label: string; value: number }>;
    projectType: Array<{ label: string; value: number }>;
    strategicGoal: Array<{ label: string; value: number }>;
    projectStatus: Array<{ label: string; value: number }>;
    projectCategory: Array<{ label: string; value: number }>;
    methodology: Array<{ label: string; value: number }>;
    projectSponsor: Array<{ label: string; value: number }>;
  }>({
    projectPriority: [],
    projectType: [],
    strategicGoal: [],
    projectStatus: [],
    projectCategory: [],
    methodology: [],
    projectSponsor: [],
  });
  const [projectTextColumns, setProjectTextColumns] = useState<{
    projectName: string;
    program: string;
    projectCategory: string;
    vendor: string;
    budget: string;
    risks: string;
    kpi: string;
    methodology: string;
    department: string;
    milestone: string;
    assignPm: string;
    note: string;
    sponsor: string;
    startDate: string;
    endDate: string;
  }>({
    projectName: 'new_projectname',
    program: 'new_programid',
    projectCategory: 'new_projectcategory',
    vendor: 'new_clientname',
    budget: 'new_budget',
    risks: 'new_risks',
    kpi: 'new_kpi',
    methodology: 'new_methodology',
    department: 'new_sector',
    milestone: 'new_milestone',
    assignPm: 'new_programmanager',
    note: 'new_note',
    sponsor: 'new_projectsponsor',
    startDate: 'new_startdate',
    endDate: 'new_enddate',
  });
  const [projectChoiceColumns, setProjectChoiceColumns] = useState<{
    projectPriority: string;
    projectType: string;
    strategicGoal: string;
    projectStatus: string;
    projectCategory: string;
    methodology: string;
  }>({
    projectPriority: 'new_projectpriority',
    projectType: 'new_projecttype',
    strategicGoal: 'new_strategicgoal',
    projectStatus: 'new_projectstatus',
    projectCategory: 'new_projectcategory',
    methodology: 'new_methodology',
  });
  const [projectMasterOptions, setProjectMasterOptions] = useState<{
    program: string[];
    projectCategory: string[];
    kpi: string[];
    methodology: string[];
    milestone: string[];
    sector: string[];
  }>({
    program: [],
    projectCategory: [],
    kpi: [],
    methodology: [],
    milestone: [],
    sector: [],
  });
  const [projectManagerEmails, setProjectManagerEmails] = useState<string[]>([]);
  const [projectSponsorEmails, setProjectSponsorEmails] = useState<string[]>([]);
  const [vendorOptions, setVendorOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [projectProgramIdByName, setProjectProgramIdByName] = useState<Record<string, string>>({});
  const [projectUserIdByEmail, setProjectUserIdByEmail] = useState<Record<string, string>>({});
  const [projectFieldOptionMap, setProjectFieldOptionMap] = useState<Record<string, Array<{ label: string; value: number }>>>({});
  const [projectFieldTypeMap, setProjectFieldTypeMap] = useState<Record<string, string>>({});
  const [projectAvailableColumns, setProjectAvailableColumns] = useState<string[]>([]);
  const [programFormErrors, setProgramFormErrors] = useState<Partial<Record<keyof typeof programForm, string>>>({});
  const [benefitsOptions, setBenefitsOptions] = useState<string[]>([]);
  const [kpiOptions, setKpiOptions] = useState<string[]>([]);
  /** Emails: users with Department/role = Program (matches Power Apps: Filter Users where Department = "Program") */
  const [programManagerEmailOptions, setProgramManagerEmailOptions] = useState<string[]>([]);
  const fallbackStatusOptions = [
    { value: 100000000, label: 'To Start' },
    { value: 100000001, label: 'On Hold' },
    { value: 100000002, label: 'Delayed' },
  ];
  const [statusOptions, setStatusOptions] = useState<Array<{ label: string; value: number }>>(fallbackStatusOptions);
  const [programRows, setProgramRows] = useState<Array<Record<string, unknown>>>([]);
  const [programLoading, setProgramLoading] = useState(false);
  const [projectRows, setProjectRows] = useState<Array<Record<string, unknown>>>([]);
  const [projectRowsLoading, setProjectRowsLoading] = useState(false);
  const [programColumns, setProgramColumns] = useState<{
    benefits?: string;
    manager?: string;
    budget?: string;
    roi?: string;
    kpi?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    progress?: string;
    name?: string;
  }>({});
  const overviewCards = [
    { label: 'Projects', value: 72, color: '#d4a759' },
    { label: 'In Work', value: 64, color: '#34d399' },
    { label: 'Delayed', value: 48, color: '#f87171' },
    { label: 'Completed', value: 23, color: '#60a5fa' },
    { label: 'Tasks', value: 48, color: '#fbbf24' },
    { label: 'Users', value: 31, color: '#fda4af' },
    { label: 'Incidents', value: 36, color: '#3b82f6' },
  ];
  const navItems = [
    { name: 'Dashboard', icon: <LayoutDashboard size={16} /> },
    { name: 'Program', icon: <FolderOpen size={16} /> },
    { name: 'Projects', icon: <Briefcase size={16} /> },
    { name: 'Meetings', icon: <Calendar size={16} /> },
    { name: 'Deliverables', icon: <ShieldCheck size={16} /> },
    { name: 'Reports', icon: <FileText size={16} /> },
    { name: 'Project Pipeline', icon: <TrendingUp size={16} /> },
  ];
  const projectBars = [
    { label: 'On Track', val: 74, color: '#34d399' },
    { label: 'Completed', val: 63, color: '#60a5fa' },
    { label: 'Delayed', val: 41, color: '#ef4444' },
  ];
  const projectBoardColumns = [
    { title: 'To Start', color: '#f6be00' },
    { title: 'On Track', color: '#10b981' },
    { title: 'Delayed', color: '#ef4444' },
    { title: 'Completed', color: '#2563eb' },
  ];
  const meetingBlocks = [
    { label: 'Meeting 10:00', col: 1, row: 1, color: '#10b981' },
    { label: 'Meeting 11:00', col: 2, row: 2, color: '#f6be00' },
    { label: 'Meeting 11:30', col: 3, row: 2, color: '#ef4444' },
    { label: 'Meeting 09:30', col: 0, row: 3, color: '#2563eb' },
    { label: 'Meeting 14:00', col: 2, row: 3, color: '#0f5fd8' },
    { label: 'Meeting 15:00', col: 3, row: 4, color: '#f6be00' },
    { label: 'Meeting 16:00', col: 1, row: 4, color: '#59628a' },
  ];
  const scheduledMeetings = [
    { title: 'Project Review Meeting', time: '10:00', color: '#d9f3eb' },
    { title: 'Requirement Discussion', time: '11:00', color: '#e0ebff' },
    { title: 'Team Standup', time: '11:30', color: '#ffe6e6' },
    { title: 'Quick Review', time: '13:00', color: '#f6f2db' },
    { title: 'Sprint Meeting', time: '14:00', color: '#e6f4ff' },
    { title: 'Client Demo', time: '15:00', color: '#f2e9ff' },
    { title: 'Planning', time: '16:00', color: '#fff0d9' },
  ];
  const deliverablesRows = [
    { project: 'DP Factor', sponsor: 'HR', items: 'Design, Development, Training, Report, Document', status: 'COMPLETED', statusColor: 'bg-blue-100 text-blue-700' },
    { project: 'Code.Tech', sponsor: 'Sales', items: 'Document, Report, Attachments, Project Plan', status: 'RESCHEDULED', statusColor: 'bg-emerald-100 text-emerald-700' },
    { project: 'Ex.Process', sponsor: 'Operations', items: 'Document, Report, Attachments, Hardware', status: 'RESCHEDULED', statusColor: 'bg-emerald-100 text-emerald-700' },
    { project: 'Scaling', sponsor: 'Marketing', items: 'Design, Report, License, Training, Project Plan', status: 'DELAYED', statusColor: 'bg-rose-100 text-rose-700' },
    { project: 'Digital Portal', sponsor: 'IT', items: 'UAT link, Production Link, Attachments, Knowledge Transfer', status: 'PENDING', statusColor: 'bg-red-100 text-red-600' },
    { project: 'DP Finster', sponsor: 'HR', items: 'Design, Development, Training, Report, Document', status: 'COMPLETED', statusColor: 'bg-blue-100 text-blue-700' },
    { project: 'Code.Tech', sponsor: 'Sales', items: 'Document, Report, Attachments, Project Plan', status: 'ASSIGNED', statusColor: 'bg-indigo-100 text-indigo-700' },
    { project: 'Ex.Process', sponsor: 'Operations', items: 'Document, Report, Attachments, Hardware', status: 'RESCHEDULED', statusColor: 'bg-emerald-100 text-emerald-700' },
    { project: 'Scaling', sponsor: 'Marketing', items: 'Design, Report, License, Training, Project Plan', status: 'PENDING', statusColor: 'bg-red-100 text-red-600' },
    { project: 'Digital Portal', sponsor: 'IT', items: 'UAT link, Production Link, Attachments, Knowledge Transfer', status: 'PENDING', statusColor: 'bg-red-100 text-red-600' },
  ];
  const reportStatsProgram = [
    { label: 'Total Projects', value: 273, color: '#d4a759' },
    { label: 'Sectors', value: 104, color: '#34d399' },
    { label: 'Delayed Projects', value: 87, color: '#f87171' },
    { label: 'Programs', value: 63, color: '#60a5fa' },
    { label: 'Projects', value: 108, color: '#fbbf24' },
    { label: 'Total Budget', value: 478, color: '#fb7185' },
    { label: 'Completed Programs', value: 71, color: '#3b82f6' },
  ];
  const reportRowsProgram = [
    { project: 'DP Factor', priority: 'High', type: 'New', budget: '$42', owner: 'Ahmed Ali', pm: 'Time Bound', start: 'Feb 09, 2024', end: 'May 24, 2024', progress: 88, status: 'COMPLETED', statusColor: 'bg-blue-100 text-blue-700' },
    { project: 'Code.Tech', priority: 'Medium', type: 'Enhanc.', budget: '$25', owner: 'Omar Sami', pm: 'Time Bound', start: 'Feb 09, 2024', end: 'May 24, 2024', progress: 52, status: 'SLIGHTLY DELAYED', statusColor: 'bg-amber-100 text-amber-700' },
    { project: 'Ex.Process', priority: 'Medium', type: 'Change Request', budget: '$30', owner: 'Waleed Ali', pm: 'Time Bound', start: 'Feb 09, 2024', end: 'May 24, 2024', progress: 76, status: 'ON TRACK', statusColor: 'bg-emerald-100 text-emerald-700' },
    { project: 'Scaling', priority: 'Low', type: 'Change Request', budget: '$30', owner: 'Amr Fahmy', pm: 'Time Bound', start: 'Feb 09, 2024', end: 'May 24, 2024', progress: 21, status: 'DELAYED', statusColor: 'bg-rose-100 text-rose-700' },
    { project: 'DP Factor', priority: 'High', type: 'New', budget: '$42', owner: 'Ahmed Ali', pm: 'Time Bound', start: 'Feb 09, 2024', end: 'May 24, 2024', progress: 90, status: 'COMPLETED', statusColor: 'bg-blue-100 text-blue-700' },
  ];
  const pipelineRowsProgram = [
    { name: 'Pinnacle', benefit: 'Productivity', budget: '$42', stage: 'RFP' },
    { name: 'Right Path', benefit: 'Efficiency', budget: '$25', stage: 'awarding' },
    { name: 'Road Map', benefit: 'Productivity', budget: '$30', stage: 'business case approval' },
    { name: 'Coreline', benefit: 'Improvement', budget: '$30', stage: 'budget approval' },
    { name: 'Growth', benefit: 'Plan Realisation', budget: '$42', stage: 'acquiring resources' },
  ];
  const categoryFromMaster = (row: EnjazMasterDataRow): string => {
    const named = String(row.new_categoryname ?? '').trim();
    if (named) return named;
    const valueMap = new Map<number, string>([
      [100000000, 'Program Code'], [100000001, 'KPI'], [100000002, 'Benefits'],
      [100000003, 'Project Category'], [100000004, 'Sector'], [100000005, 'Milestone'],
      [100000006, 'Project Code'], [100000007, 'Stage'], [100000008, 'Report Type'],
      [100000009, 'Specialization'], [100000010, 'Meeting Category'], [100000011, 'Deliverables'],
      [100000012, 'Industry'], [100000013, 'Country'], [100000014, 'Region'],
      [100000015, 'Currency'], [100000016, 'Time'], [100000017, 'Shift'],
      [100000018, 'Holiday'], [100000019, 'Methodology'],
    ]);
    const raw = row.new_category;
    const num = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isNaN(num) && valueMap.has(num)) return valueMap.get(num) ?? '';
    return String(raw ?? '');
  };

  const isMasterActive = (row: EnjazMasterDataRow) => {
    const raw = String(row.new_statusname ?? row.new_status ?? '').toLowerCase();
    return !(raw.includes('inactive') || raw === '100000001' || raw === '1');
  };

  const normalizeCategory = (value: string) => value.toLowerCase().replace(/[\s_&-]+/g, '');

  const optionsFromMetadataAttribute = (attrs: Array<Record<string, unknown>>, logicalName: string) => {
    const attr = attrs.find((a) => String(a.LogicalName ?? a.logicalName ?? '').toLowerCase() === logicalName.toLowerCase());
    const optionListRaw =
      (attr?.OptionSet as { Options?: Array<Record<string, unknown>> } | undefined)?.Options
      ?? (attr?.OptionSet as { options?: Array<Record<string, unknown>> } | undefined)?.options
      ?? (attr?.optionSet as { Options?: Array<Record<string, unknown>> } | undefined)?.Options
      ?? (attr?.optionSet as { options?: Array<Record<string, unknown>> } | undefined)?.options
      ?? [];
    return optionListRaw
      .map((o) => {
        const value = Number(o.Value ?? o.value ?? NaN);
        const label =
          String(
            (o.Label as { UserLocalizedLabel?: { Label?: string } } | undefined)?.UserLocalizedLabel?.Label
            ?? (o.Label as { LocalizedLabels?: Array<{ Label?: string }> } | undefined)?.LocalizedLabels?.[0]?.Label
            ?? (o.label as string | undefined)
            ?? '',
          ).trim();
        if (Number.isNaN(value) || !label) return null;
        return { value, label };
      })
      .filter((o): o is { label: string; value: number } => Boolean(o));
  };

  const attrTypeName = (attr?: Record<string, unknown>): string =>
    String(
      (attr?.AttributeTypeName as { Value?: string } | undefined)?.Value
      ?? attr?.AttributeType
      ?? attr?.attributeType
      ?? '',
    ).toLowerCase();

  const pickLogicalByContains = (names: string[], include: string[], exclude: string[] = []) =>
    names.find((n) => {
      const lower = n.toLowerCase();
      return include.every((i) => lower.includes(i.toLowerCase())) && !exclude.some((e) => lower.includes(e.toLowerCase()));
    });
  const readAttrLabel = (attr: Record<string, unknown>) =>
    String(
      (attr.DisplayName as { UserLocalizedLabel?: { Label?: string } } | undefined)?.UserLocalizedLabel?.Label
      ?? (attr.displayName as { userLocalizedLabel?: { label?: string } } | undefined)?.userLocalizedLabel?.label
      ?? '',
    ).trim();
  const normalizeAttrKey = (value: string) => value.toLowerCase().replace(/[\s_\-]+/g, '');
  const pickLogicalByDisplayLabel = (attrs: Array<Record<string, unknown>>, label: string) => {
    const target = normalizeAttrKey(label);
    const match = attrs.find((a) => normalizeAttrKey(readAttrLabel(a)) === target);
    const logical = String(match?.LogicalName ?? match?.logicalName ?? '').trim();
    return logical || undefined;
  };
  const pickLogicalFromAttrs = (
    attrs: Array<Record<string, unknown>>,
    includeNameParts: string[],
    includeLabelParts: string[] = includeNameParts,
    excludeNameParts: string[] = [],
  ) =>
    attrs.find((a) => {
      const logical = String(a.LogicalName ?? a.logicalName ?? '').toLowerCase();
      const label = readAttrLabel(a).toLowerCase();
      const byName = includeNameParts.every((p) => logical.includes(p.toLowerCase())) && !excludeNameParts.some((p) => logical.includes(p.toLowerCase()));
      const byLabel = includeLabelParts.every((p) => label.includes(p.toLowerCase()));
      return byName || byLabel;
    });

  useEffect(() => {
    if (Object.keys(projectFormErrors).length === 0) return;
    setProjectFormErrors((prev) => {
      const next = { ...prev };
      if (next.projectName && projectForm.projectName.trim()) delete next.projectName;
      if (next.programName && projectForm.programName) delete next.programName;
      if (next.vendorName && projectForm.vendorName.trim()) delete next.vendorName;
      if (next.projectPriority && projectForm.projectPriority) delete next.projectPriority;
      if (next.projectCategory && projectForm.projectCategory) delete next.projectCategory;
      if (next.projectType && projectForm.projectType) delete next.projectType;
      if (next.strategicGoal && projectForm.strategicGoal) delete next.strategicGoal;
      if (next.assignToProjectManager && projectForm.assignToProjectManager) delete next.assignToProjectManager;
      if (next.risks && projectForm.risks.trim()) delete next.risks;
      if (next.methodology && projectForm.methodology) delete next.methodology;
      if (next.department && projectForm.department) delete next.department;
      if (next.projectStatus && projectForm.projectStatus) delete next.projectStatus;
      if (next.milestone && projectForm.milestone) delete next.milestone;
      if (next.projectSponsor && projectForm.projectSponsor) delete next.projectSponsor;
      if (next.budget && /^\d+(\.\d+)?$/.test(projectForm.budget.trim())) delete next.budget;
      if (next.startDate && projectForm.startDate && projectForm.startDate >= todayIso) delete next.startDate;
      if (
        next.endDate
        && projectForm.endDate
        && projectForm.endDate >= todayIso
        && (!projectForm.startDate || projectForm.endDate >= projectForm.startDate)
      ) delete next.endDate;
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
  }, [projectForm, projectFormErrors, todayIso]);

  const readFirstString = (row: Record<string, unknown>, keys: string[]): string => {
    for (const k of keys) {
      const value = row[k];
      const text = String(value ?? '').trim();
      if (text) return text;
    }
    return '';
  };

  const loadPrograms = async () => {
    setProgramLoading(true);
    try {
      const res = await New_programsService.getAll({ top: 500, orderBy: ['createdon desc'] });
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to load programs');
      setProgramRows((res.data ?? []) as unknown as Array<Record<string, unknown>>);
    } catch (error) {
      setProgramFormMsg(error instanceof Error ? error.message : 'Failed to load programs');
    } finally {
      setProgramLoading(false);
    }
  };

  /**
   * Program Add/Edit — Project Manager: Users where `new_role` is Program (choice 100000002),
   * options show `new_newcolumn` only (per Users table spec).
   */
  const loadProgramManagerEmails = async () => {
    try {
      const res = await NewUsersService.getAll({ top: 500, orderBy: ['createdon desc'] });
      if (!res.success) return;
      const userRows = (res.data ?? []) as Array<Record<string, unknown>>;

      const isProgramRole = (u: Record<string, unknown>) => {
        const raw = u.new_role;
        const n = Number(raw);
        if (!Number.isNaN(n) && n === 100000002) return true; // Dataverse: Program
        if (String(raw ?? '') === '100000002') return true;
        if (String(raw ?? '').trim() === 'Program') return true;
        return String(u.new_rolename ?? '').trim().toLowerCase() === 'program';
      };

      const fromNewColumn = userRows
        .filter(isProgramRole)
        .map((u) => String(u.new_newcolumn ?? '').trim())
        .filter((s) => s.length > 0);

      setProgramManagerEmailOptions(
        Array.from(new Set(fromNewColumn)).sort((a, b) => a.localeCompare(b)),
      );
    } catch {
      // non-fatal
    }
  };

  const loadProgramMetadata = async () => {
    const metaRes = await New_programsService.getMetadata();
    const meta = (metaRes as { data?: unknown })?.data as { Attributes?: Array<Record<string, unknown>> } | undefined;
    const attrs = meta?.Attributes ?? [];
    const findAttrByLogical = (logical: string) =>
      attrs.find((a) => String(a.LogicalName ?? a.logicalName ?? '').toLowerCase() === logical.toLowerCase());
    const logicalNames = attrs
      .map((a) => String(a.LogicalName ?? a.logicalName ?? a.SchemaName ?? a.schemaName ?? ''))
      .filter(Boolean);
    const pick = (...parts: string[]) =>
      logicalNames.find((name) => {
        const n = name.toLowerCase();
        return parts.every((p) => n.includes(p));
      });

    const statusAttr = findAttrByLogical('new_status');
    const optionListRaw =
      (statusAttr?.OptionSet as { Options?: Array<Record<string, unknown>> } | undefined)?.Options
      ?? (statusAttr?.OptionSet as { options?: Array<Record<string, unknown>> } | undefined)?.options
      ?? (statusAttr?.optionSet as { Options?: Array<Record<string, unknown>> } | undefined)?.Options
      ?? (statusAttr?.optionSet as { options?: Array<Record<string, unknown>> } | undefined)?.options
      ?? [];
    const parsedStatusOptions = optionListRaw
      .map((o) => {
        const value = Number(o.Value ?? o.value ?? NaN);
        const label =
          String(
            (o.Label as { UserLocalizedLabel?: { Label?: string } } | undefined)?.UserLocalizedLabel?.Label
            ?? (o.Label as { LocalizedLabels?: Array<{ Label?: string }> } | undefined)?.LocalizedLabels?.[0]?.Label
            ?? (o.label as string | undefined)
            ?? '',
          ).trim();
        if (Number.isNaN(value) || !label) return null;
        return { value, label };
      })
      .filter((o): o is { value: number; label: string } => Boolean(o));

    const finalStatusOptions = parsedStatusOptions.length > 0 ? parsedStatusOptions : fallbackStatusOptions;
    setProgramColumns({
      name: pick('name') ?? 'new_name',
      startDate: pick('start', 'date') ?? 'new_startdate',
      endDate: pick('end', 'date') ?? 'new_enddate',
      status: pick('program', 'status') ?? pick('status') ?? 'new_programstatus',
      benefits: pick('benefit') ?? 'new_benefits',
      manager: pick('manager') ?? 'new_programmanager',
      budget: pick('budget') ?? 'crcf8_budget',
      roi: pick('roi') ?? 'new_roi',
      kpi: pick('kpi') ?? 'new_kpi',
      progress: pick('progress'),
    });
    setStatusOptions(finalStatusOptions);
    setProgramForm((f) => ({
      ...f,
      status: f.status || (finalStatusOptions[0] ? String(finalStatusOptions[0].value) : ''),
    }));
  };

  useEffect(() => {
    if (activeNav !== 'Program') return;
    let cancelled = false;
    (async () => {
      try {
        await loadProgramMetadata();

        const res = await EnjazMasterDataService.getAll({ top: 1000, orderBy: ['new_code asc'] });
        if (!res.success) throw new Error(res.error?.message ?? 'Failed to load master data options');
        const rows = res.data ?? [];
        const benefits = rows
          .filter((r) => categoryFromMaster(r) === 'Benefits')
          .map((r) => String(r.new_enjazmasterdata1 ?? '').trim())
          .filter(Boolean);
        const kpis = rows
          .filter((r) => categoryFromMaster(r) === 'KPI')
          .map((r) => String(r.new_enjazmasterdata1 ?? '').trim())
          .filter(Boolean);
        if (!cancelled) {
          setBenefitsOptions(Array.from(new Set(benefits)));
          setKpiOptions(Array.from(new Set(kpis)));
        }
        if (!cancelled) await loadProgramManagerEmails();
        if (!cancelled) await loadPrograms();
      } catch (error) {
        if (!cancelled) setProgramFormMsg(error instanceof Error ? error.message : 'Failed to load dropdown values');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeNav]);

  const getValueFromRow = (row: Record<string, unknown>, key: string): unknown => {
    if (row[key] !== undefined) return row[key];
    const lower = key.toLowerCase();
    for (const k of Object.keys(row)) {
      if (k.toLowerCase() === lower) return row[k];
    }
    return undefined;
  };

  const getProgramBudgetDisplay = (row: Record<string, unknown>) => {
    const formatPrimitive = (v: unknown): string | null => {
      if (v === undefined || v === null) return null;
      if (typeof v === 'number' && !Number.isNaN(v)) return String(v);
      if (typeof v === 'string') {
        const t = v.trim();
        return t || null;
      }
      if (typeof v === 'object' && v !== null) {
        const o = v as { Value?: number; value?: number };
        if (o.Value !== undefined && o.Value !== null && !Number.isNaN(o.Value)) return String(o.Value);
        if (o.value !== undefined && o.value !== null && !Number.isNaN(o.value)) return String(o.value);
      }
      return null;
    };

    const raw = (k: string) => formatPrimitive(getValueFromRow(row, k));

    const tryKeys = [
      'crcf8_budget',
      programColumns.budget,
      'new_budget',
      'crcf8_programbudget',
      'new_programbudget',
      'new_program_budget',
    ].filter(Boolean) as string[];
    for (const k of tryKeys) {
      const t = raw(k);
      if (t !== null && t !== '') return t;
    }
    for (const k of Object.keys(row)) {
      const low = k.toLowerCase();
      if (!low.includes('budget') || low.includes('name') || low.includes('transaction') || k.includes('@')) continue;
      const t = formatPrimitive(row[k]);
      if (t !== null && t !== '') return t;
    }
    return '';
  };

  const clearProgramForm = () => {
    setProgramForm({
      programName: '',
      benefits: '',
      programManager: programManagerEmailOptions[0] ?? '',
      budget: '',
      startDate: todayIso,
      endDate: todayIso,
      roi: '',
      kpi: '',
      status: statusOptions[0] ? String(statusOptions[0].value) : '',
    });
    setProgramFormErrors({});
    setProgramFormMsg('');
  };

  const openAddProgram = () => {
    setProgramFormMode('add');
    setEditingProgramId(null);
    clearProgramForm();
    void loadProgramManagerEmails();
    setShowAddProgramForm(true);
  };

  const toDateInput = (value: unknown) => {
    const raw = String(value ?? '').trim();
    if (!raw) return todayIso;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return todayIso;
    return d.toISOString().slice(0, 10);
  };

  const openEditProgram = async (row: Record<string, unknown>) => {
    const id = String(row.new_programid ?? '');
    if (!id) {
      setProgramFormMsg('Unable to edit: missing program id.');
      return;
    }
    await loadProgramManagerEmails();
    setProgramFormMode('edit');
    setEditingProgramId(id);
    setProgramFormErrors({});
    setProgramFormMsg('');

    let rowToUse: Record<string, unknown> = { ...row };
    try {
      const res = await New_programsService.get(id);
      if (res.success && res.data) {
        rowToUse = { ...rowToUse, ...(res.data as object) } as Record<string, unknown>;
      }
    } catch {
      // Use grid row only if single-record load fails
    }

    const readProgramValue = (primary?: string, fallbacks: string[] = []) => {
      const keys = [primary, ...fallbacks].filter(Boolean) as string[];
      for (const key of keys) {
        const val = rowValueText(rowToUse, key);
        if (val !== '-') return val;
      }
      return '';
    };
    setProgramForm({
      programName: readProgramValue(programColumns.name ?? 'new_name', ['new_name']),
      benefits: readProgramValue(programColumns.benefits, ['new_benefits']),
      programManager: readProgramValue(programColumns.manager, ['new_programmanager']),
      budget: getProgramBudgetDisplay(rowToUse),
      startDate: toDateInput(getValueFromRow(rowToUse, programColumns.startDate ?? 'new_startdate')),
      endDate: toDateInput(getValueFromRow(rowToUse, programColumns.endDate ?? 'new_enddate')),
      roi: readProgramValue(programColumns.roi, ['new_roi']),
      kpi: readProgramValue(programColumns.kpi, ['new_kpi']),
      status: String(
        getValueFromRow(rowToUse, programColumns.status ?? 'new_programstatus') ?? rowToUse.new_programstatus ?? '',
      ),
    });
    setShowAddProgramForm(true);
  };

  const saveProgram = async () => {
    const next: Partial<Record<keyof typeof programForm, string>> = {};
    if (!programForm.programName.trim()) next.programName = 'Program Name is required';
    if (!programForm.benefits) next.benefits = 'Benefits is required';
    if (!programForm.programManager.trim()) next.programManager = 'Project Manager is required';
    if (!programForm.budget.trim()) next.budget = 'Budget is required';
    else if (!/^\d+(\.\d+)?$/.test(programForm.budget.trim())) next.budget = 'Budget must be numbers only';
    if (!programForm.startDate) next.startDate = 'Start Date is required';
    if (programFormMode === 'add' && programForm.startDate && programForm.startDate < todayIso) next.startDate = 'Past dates are not allowed';
    if (!programForm.endDate) next.endDate = 'End Date is required';
    if (programForm.startDate && programForm.endDate && programForm.endDate < programForm.startDate) next.endDate = 'End Date should be after Start Date';
    if (!programForm.roi.trim()) next.roi = 'ROI is required';
    if (!programForm.kpi) next.kpi = 'KPI is required';
    if (!programForm.status) next.status = 'Program Status is required';
    setProgramFormErrors(next);
    if (Object.keys(next).length > 0) return;

    setProgramFormBusy(true);
    setProgramFormMsg('');
    try {
      const payload: Record<string, unknown> = {
        [programColumns.name ?? 'new_name']: programForm.programName.trim(),
        [programColumns.startDate ?? 'new_startdate']: new Date(programForm.startDate).toISOString(),
        new_programstatus: Number(programForm.status),
        new_benefits: programForm.benefits,
        new_programmanager: programForm.programManager.trim(),
        new_roi: programForm.roi.trim(),
        new_kpi: programForm.kpi,
        new_enddate: new Date(programForm.endDate).toISOString(),
        crcf8_budget: Number(programForm.budget),
      };
      if (programColumns.status && programColumns.status !== 'new_programstatus') {
        payload[programColumns.status] = Number(programForm.status);
      }
      if (programColumns.benefits) payload[programColumns.benefits] = programForm.benefits;
      if (programColumns.manager) payload[programColumns.manager] = programForm.programManager.trim();
      if (programColumns.budget && programColumns.budget !== 'crcf8_budget') {
        payload[programColumns.budget] = Number(programForm.budget);
      }
      if (programColumns.roi) payload[programColumns.roi] = programForm.roi.trim();
      if (programColumns.kpi) payload[programColumns.kpi] = programForm.kpi;
      if (programColumns.endDate) payload[programColumns.endDate] = new Date(programForm.endDate).toISOString();

      if (programFormMode === 'edit' && editingProgramId) {
        const res = await New_programsService.update(
          editingProgramId,
          payload as Parameters<typeof New_programsService.update>[1],
        );
        if (!res.success) throw new Error(res.error?.message ?? 'Failed to update program');
        setProgramFormMsg('Program updated successfully.');
        setProgramToast({ type: 'success', message: 'Program updated successfully.' });
      } else {
        const res = await New_programsService.create(payload as Parameters<typeof New_programsService.create>[0]);
        if (!res.success) throw new Error(res.error?.message ?? 'Failed to create program');
        setProgramFormMsg('Program saved successfully.');
        setProgramToast({ type: 'success', message: 'Program created successfully.' });
      }
      clearProgramForm();
      await loadPrograms();
      setShowAddProgramForm(false);
    } catch (error) {
      setProgramFormMsg(error instanceof Error ? error.message : 'Failed to create program');
      setProgramToast({ type: 'error', message: error instanceof Error ? error.message : 'Failed to create program' });
    } finally {
      setProgramFormBusy(false);
    }
  };

  const loadProjectFormData = async () => {
    setProjectMetaLoading(true);
    try {
      const [projectMetaRes, masterRes, usersRes, programsRes, vendorsRes] = await Promise.all([
        New_projectsService.getMetadata(),
        EnjazMasterDataService.getAll({ top: 1000, orderBy: ['new_code asc'] }),
        NewUsersService.getAll({ top: 500, orderBy: ['createdon desc'] }),
        New_programsService.getAll({ top: 500, orderBy: ['createdon desc'] }),
        New_vendorsService.getAll({ top: 500, orderBy: ['createdon desc'] }),
      ]);
      const attrs = ((projectMetaRes as { data?: { Attributes?: Array<Record<string, unknown>> } })?.data?.Attributes ?? []);
      const attrByLogical = new Map(
        attrs.map((a) => [String(a.LogicalName ?? a.logicalName ?? '').toLowerCase(), a] as const),
      );
      const logicalNames = attrs
        .map((a) => String(a.LogicalName ?? a.logicalName ?? '').trim())
        .filter(Boolean);
      setProjectAvailableColumns(logicalNames.map((n) => n.toLowerCase()));
      const detectedMilestone =
        String(pickLogicalFromAttrs(attrs, ['milestone'], ['milestone'], ['name', 'id'])?.LogicalName ?? '').trim()
        || String(pickLogicalFromAttrs(attrs, ['milestone'], ['milestone'], ['name', 'id'])?.logicalName ?? '').trim()
        || pickLogicalByContains(logicalNames, ['milestone'], ['name', 'id'])
        || 'new_milestone';
      const detectedSector =
        String(pickLogicalFromAttrs(attrs, ['sector'], ['sector', 'department'], ['name', 'id'])?.LogicalName ?? '').trim()
        || String(pickLogicalFromAttrs(attrs, ['sector'], ['sector', 'department'], ['name', 'id'])?.logicalName ?? '').trim()
        || pickLogicalByContains(logicalNames, ['sector'], ['name', 'id'])
        || 'new_sector';
      const detectedProjectStatus =
        String(pickLogicalFromAttrs(attrs, ['project', 'status'], ['project', 'status'], ['program', 'statecode', 'statuscode'])?.LogicalName ?? '').trim()
        || String(pickLogicalFromAttrs(attrs, ['project', 'status'], ['project', 'status'], ['program', 'statecode', 'statuscode'])?.logicalName ?? '').trim()
        || pickLogicalByContains(logicalNames, ['project', 'status'], ['program', 'statecode', 'statuscode'])
        || logicalNames.find((n) => n.toLowerCase() === 'new_status')
        || logicalNames.find((n) => n.toLowerCase() === 'new_projectstatus')
        || 'new_projectstatus';
      const detectedProjectCategory =
        String(pickLogicalFromAttrs(attrs, ['project', 'category'], ['project', 'category'], ['name', 'id'])?.LogicalName ?? '').trim()
        || String(pickLogicalFromAttrs(attrs, ['project', 'category'], ['project', 'category'], ['name', 'id'])?.logicalName ?? '').trim()
        || pickLogicalByContains(logicalNames, ['project', 'category'], ['name', 'id'])
        || 'new_projectcategory';
      const detectedMethodology =
        String(pickLogicalFromAttrs(attrs, ['methodology'], ['methodology'], ['name', 'id'])?.LogicalName ?? '').trim()
        || String(pickLogicalFromAttrs(attrs, ['methodology'], ['methodology'], ['name', 'id'])?.logicalName ?? '').trim()
        || pickLogicalByContains(logicalNames, ['methodology'], ['name', 'id'])
        || 'new_methodology';
      const detectedProgram =
        String(pickLogicalFromAttrs(attrs, ['program'], ['program name', 'program'], ['manager', 'status', 'priority', 'type', 'category'])?.LogicalName ?? '').trim()
        || String(pickLogicalFromAttrs(attrs, ['program'], ['program name', 'program'], ['manager', 'status', 'priority', 'type', 'category'])?.logicalName ?? '').trim()
        || pickLogicalByContains(logicalNames, ['program'], ['manager', 'status', 'priority', 'type', 'category'])
        || 'new_programid';
      const detectedKpi =
        String(pickLogicalFromAttrs(attrs, ['kpi'], ['kpi'], ['name', 'id'])?.LogicalName ?? '').trim()
        || String(pickLogicalFromAttrs(attrs, ['kpi'], ['kpi'], ['name', 'id'])?.logicalName ?? '').trim()
        || pickLogicalByContains(logicalNames, ['kpi'], ['name', 'id'])
        || 'new_kpi';
      const detectedRisks =
        String(pickLogicalFromAttrs(attrs, ['risk'], ['risk'])?.LogicalName ?? '').trim()
        || String(pickLogicalFromAttrs(attrs, ['risk'], ['risk'])?.logicalName ?? '').trim()
        || pickLogicalByContains(logicalNames, ['risk'])
        || 'new_risks';
      const detectedManager =
        String(pickLogicalFromAttrs(attrs, ['manager'], ['project manager', 'manager'], ['name'])?.LogicalName ?? '').trim()
        || String(pickLogicalFromAttrs(attrs, ['manager'], ['project manager', 'manager'], ['name'])?.logicalName ?? '').trim()
        || pickLogicalByContains(logicalNames, ['manager'], ['name'])
        || 'new_programmanager';
      const detectedSponsor =
        String(pickLogicalFromAttrs(attrs, ['sponsor'], ['project sponsor', 'sponsor'], ['name'])?.LogicalName ?? '').trim()
        || String(pickLogicalFromAttrs(attrs, ['sponsor'], ['project sponsor', 'sponsor'], ['name'])?.logicalName ?? '').trim()
        || pickLogicalByContains(logicalNames, ['sponsor'], ['name'])
        || 'new_projectsponsor';
      const detectedProgramText = pickLogicalByDisplayLabel(attrs, 'Program Name') ?? detectedProgram;
      const detectedProjectCategoryText = pickLogicalByDisplayLabel(attrs, 'Project Category') ?? detectedProjectCategory;
      const detectedManagerText = pickLogicalByDisplayLabel(attrs, 'Project Manager') ?? detectedManager;
      const detectedRisksText = pickLogicalByDisplayLabel(attrs, 'Risks') ?? detectedRisks;
      const detectedKpiText = pickLogicalByDisplayLabel(attrs, 'KPI') ?? detectedKpi;
      const detectedMethodologyText = pickLogicalByDisplayLabel(attrs, 'Methodology') ?? detectedMethodology;
      const detectedSectorText = pickLogicalByDisplayLabel(attrs, 'Sector') ?? detectedSector;
      const detectedMilestoneText = pickLogicalByDisplayLabel(attrs, 'Mile Stone') ?? pickLogicalByDisplayLabel(attrs, 'Milestone') ?? detectedMilestone;
      const detectedSponsorText = pickLogicalByDisplayLabel(attrs, 'Project Sponsor') ?? detectedSponsor;
      setProjectChoiceColumns((prev) => ({
        ...prev,
        projectStatus: detectedProjectStatus,
        projectCategory: detectedProjectCategory,
        methodology: detectedMethodology,
      }));
      setProjectTextColumns((prev) => ({
        ...prev,
        program: detectedProgramText,
        projectCategory: detectedProjectCategoryText,
        kpi: detectedKpiText,
        risks: detectedRisksText,
        methodology: detectedMethodologyText,
        assignPm: detectedManagerText,
        sponsor: detectedSponsorText,
        milestone: detectedMilestoneText,
        department: detectedSectorText,
      }));
      const fallbackProjectPriority = Object.entries(New_projectsnew_projectpriority).map(([value, label]) => ({ value: Number(value), label }));
      const fallbackProjectType = Object.entries(New_projectsnew_projecttype).map(([value, label]) => ({ value: Number(value), label }));
      const fallbackStrategicGoal = Object.entries(New_projectsnew_strategicgoal).map(([value, label]) => ({ value: Number(value), label }));
      const fallbackProjectStatus = Object.entries(New_projectsnew_projectstatus).map(([value, label]) => ({ value: Number(value), label }));
      const metaProjectPriority = optionsFromMetadataAttribute(attrs, 'new_projectpriority');
      const metaProjectType = optionsFromMetadataAttribute(attrs, 'new_projecttype');
      const metaStrategicGoal = optionsFromMetadataAttribute(attrs, 'new_strategicgoal');
      const metaProjectStatus = optionsFromMetadataAttribute(attrs, detectedProjectStatus);
      const metaMethodology = optionsFromMetadataAttribute(attrs, detectedMethodology);
      const metaProjectCategory = optionsFromMetadataAttribute(attrs, detectedProjectCategory);
      const metaMilestone = optionsFromMetadataAttribute(attrs, detectedMilestone);
      const metaSector = optionsFromMetadataAttribute(attrs, detectedSector);
      const metaProjectSponsor = optionsFromMetadataAttribute(attrs, 'new_projectsponsor');
      const fallbackMethodology = [
        { value: 100000000, label: 'Agile' },
        { value: 100000001, label: 'Waterfall' },
      ];
      setProjectFieldOptionMap({
        new_projectpriority: metaProjectPriority.length > 0 ? metaProjectPriority : fallbackProjectPriority,
        new_projecttype: metaProjectType.length > 0 ? metaProjectType : fallbackProjectType,
        new_strategicgoal: metaStrategicGoal.length > 0 ? metaStrategicGoal : fallbackStrategicGoal,
        [detectedProjectStatus]: metaProjectStatus.length > 0 ? metaProjectStatus : fallbackProjectStatus,
        [detectedProjectCategory]: metaProjectCategory,
        [detectedMethodology]: metaMethodology.length > 0 ? metaMethodology : fallbackMethodology,
        [detectedMilestone]: metaMilestone,
        [detectedSector]: metaSector,
        new_projectsponsor: metaProjectSponsor,
      });
      setProjectFieldTypeMap({
        new_projectpriority: attrTypeName(attrByLogical.get('new_projectpriority')),
        new_projecttype: attrTypeName(attrByLogical.get('new_projecttype')),
        new_strategicgoal: attrTypeName(attrByLogical.get('new_strategicgoal')),
        [detectedProjectStatus]: attrTypeName(attrByLogical.get(detectedProjectStatus.toLowerCase())),
        [detectedProjectCategory]: attrTypeName(attrByLogical.get(detectedProjectCategory.toLowerCase())),
        [detectedMethodology]: attrTypeName(attrByLogical.get(detectedMethodology.toLowerCase())),
        [detectedMilestone]: attrTypeName(attrByLogical.get(detectedMilestone.toLowerCase())),
        [detectedSector]: attrTypeName(attrByLogical.get(detectedSector.toLowerCase())),
        new_projectsponsor: attrTypeName(attrByLogical.get('new_projectsponsor')),
      });
      setProjectChoiceOptions({
        projectPriority: metaProjectPriority.length > 0 ? metaProjectPriority : fallbackProjectPriority,
        projectType: metaProjectType.length > 0 ? metaProjectType : fallbackProjectType,
        strategicGoal: metaStrategicGoal.length > 0 ? metaStrategicGoal : fallbackStrategicGoal,
        projectStatus: metaProjectStatus.length > 0 ? metaProjectStatus : fallbackProjectStatus,
        projectCategory: metaProjectCategory,
        methodology: metaMethodology.length > 0 ? metaMethodology : fallbackMethodology,
        projectSponsor: metaProjectSponsor,
      });

      if (!masterRes.success) throw new Error(masterRes.error?.message ?? 'Failed to load master data');
      const masterRows = (masterRes.data ?? []).filter((r) => isMasterActive(r));
      const getByCategory = (categoryCandidates: string[]) =>
        Array.from(
          new Set(
            masterRows
              .filter((r) => {
                const cat = normalizeCategory(categoryFromMaster(r));
                const byCategoryName = categoryCandidates.some((c) => cat.includes(normalizeCategory(c)));
                const code = String(r.new_uniqueid ?? '').trim();
                const byCodePrefix =
                  (categoryCandidates.some((c) => normalizeCategory(c).includes('projectcategory')) && /^P\d+$/i.test(code))
                  || (categoryCandidates.some((c) => normalizeCategory(c).includes('sector')) && /^S\d+$/i.test(code));
                return byCategoryName || byCodePrefix;
              })
              .map((r) => String(r.new_enjazmasterdata1 ?? '').trim())
              .filter(Boolean),
          ),
        );
      setProjectMasterOptions({
        program: programsRes.success
          ? Array.from(new Set((programsRes.data ?? []).map((p) => String(p.new_name ?? '').trim()).filter(Boolean)))
          : [],
        projectCategory: (() => {
          const vals = getByCategory(['projectcategory', 'project category']);
          if (vals.length > 0) return vals;
          return optionsFromMetadataAttribute(attrs, detectedProjectCategory).map((o) => o.label);
        })(),
        kpi: getByCategory(['kpi']),
        methodology: getByCategory(['methodology', 'methodologymaster']),
        milestone: getByCategory(['milestone']),
        sector: getByCategory(['sector', 'department']),
      });

      const userRows = usersRes.success ? (usersRes.data ?? []) : [];
      const userIdMap: Record<string, string> = {};
      userRows.forEach((u) => {
        const email = String(u.new_newcolumn ?? u.new_userid ?? '').trim();
        const id = String(u.new_usersid ?? '').trim();
        if (email && id) userIdMap[email.toLowerCase()] = id;
      });
      setProjectUserIdByEmail(userIdMap);
      const projectRoleUsers = userRows.filter((u) => String(u.new_role ?? '') === '100000003' || String(u.new_rolename ?? '').toLowerCase() === 'project');
      setProjectManagerEmails(
        Array.from(new Set(projectRoleUsers.map((u) => String(u.new_newcolumn ?? u.new_userid ?? '').trim()).filter(Boolean))),
      );
      const activeUsers = userRows.filter((u) => String(u.new_status ?? '') === '100000000' || String(u.new_statusname ?? '').toLowerCase() === 'active');
      setProjectSponsorEmails(
        Array.from(new Set(activeUsers.map((u) => String(u.new_newcolumn ?? u.new_userid ?? '').trim()).filter(Boolean))),
      );
      const programIdMap: Record<string, string> = {};
      if (programsRes.success) {
        (programsRes.data ?? []).forEach((p) => {
          const name = String(p.new_name ?? '').trim();
          const id = String(p.new_programid ?? '').trim();
          if (name && id) programIdMap[name.toLowerCase()] = id;
        });
      }
      setProjectProgramIdByName(programIdMap);
      const vendorRows = vendorsRes.success ? ((vendorsRes.data ?? []) as unknown as Array<Record<string, unknown>>) : [];
      const activeVendors = vendorRows.filter((v) => {
        const statusName = readFirstString(v, ['new_statusname', 'statusname', 'Status']).toLowerCase();
        const statusCode = readFirstString(v, ['new_status', 'status', 'StatusCode']);
        const appStatus = readFirstString(v, ['new_appstatus', 'appstatus', 'AppStatus']).toLowerCase();
        const stateCode = readFirstString(v, ['statecode', 'StateCode']);
        return statusName === 'active' || statusCode === '100000000' || appStatus === 'active' || stateCode === '0';
      });
      const byName = new Map<string, { label: string; value: string }>();
      activeVendors.forEach((v) => {
        const label = readFirstString(v, ['new_vendorname', 'vendorname', 'VendorName', 'Vendor Name']);
        const value = readFirstString(v, ['new_vendoremail', 'vendoremail', 'VendorEmail', 'Vendor Email']);
        if (!label || !value || byName.has(label)) return;
        byName.set(label, { label, value });
      });
      const options = Array.from(byName.values());
      if (options.length === 0) {
        vendorRows.forEach((v) => {
          const label = readFirstString(v, ['new_vendorname', 'vendorname', 'VendorName', 'Vendor Name']);
          const value = readFirstString(v, ['new_vendoremail', 'vendoremail', 'VendorEmail', 'Vendor Email']);
          if (!label || !value || byName.has(label)) return;
          byName.set(label, { label, value });
        });
      }
      setVendorOptions(Array.from(byName.values()));
    } catch (error) {
      setProgramToast({ type: 'error', message: error instanceof Error ? error.message : 'Failed to load project form data' });
    } finally {
      setProjectMetaLoading(false);
    }
  };

  const clearProjectForm = () => {
    setProjectForm({
      projectName: '',
      programName: '',
      vendorName: '',
      projectPriority: '',
      projectCategory: '',
      projectType: '',
      strategicGoal: '',
      budget: '',
      assignToProjectManager: '',
      risks: '',
      kpi: '',
      methodology: '',
      startDate: todayIso,
      endDate: todayIso,
      department: '',
      projectStatus: '',
      milestone: '',
      projectSponsor: '',
      note: '',
      attachment: null,
    });
    setProjectFormErrors({});
  };

  const saveProject = async () => {
    const req: Record<string, string> = {};
    if (!projectForm.projectName.trim()) req.projectName = 'Project Name is required';
    if (!projectForm.programName) req.programName = 'Program Name is required';
    if (!projectForm.vendorName.trim()) req.vendorName = 'Vendor Name is required';
    if (!projectForm.projectPriority) req.projectPriority = 'Project Priority is required';
    if (!projectForm.projectCategory) req.projectCategory = 'Project Category is required';
    if (!projectForm.projectType) req.projectType = 'Project Type is required';
    if (!projectForm.strategicGoal) req.strategicGoal = 'Strategic Goal is required';
    if (!projectForm.budget.trim()) req.budget = 'Budget is required';
    else if (!/^\d+(\.\d+)?$/.test(projectForm.budget.trim())) req.budget = 'Budget must be numbers only';
    if (!projectForm.assignToProjectManager) req.assignToProjectManager = 'Project Manager is required';
    if (!projectForm.risks.trim()) req.risks = 'Risks is required';
    if (!projectForm.methodology) req.methodology = 'Methodology is required';
    if (!projectForm.startDate) req.startDate = 'Start Date is required';
    if (!projectForm.endDate) req.endDate = 'End Date is required';
    if (projectForm.startDate && projectForm.startDate < todayIso) req.startDate = 'Start Date cannot be in the past';
    if (projectForm.endDate && projectForm.endDate < todayIso) req.endDate = 'End Date cannot be in the past';
    if (projectForm.startDate && projectForm.endDate && projectForm.endDate < projectForm.startDate) req.endDate = 'End Date should be after Start Date';
    if (!projectForm.department) req.department = 'Department is required';
    if (!projectForm.projectStatus) req.projectStatus = 'Project Status is required';
    if (!projectForm.milestone) req.milestone = 'Milestone is required';
    if (!projectForm.projectSponsor) req.projectSponsor = 'Project Sponsor is required';
    setProjectFormErrors(req);
    if (Object.keys(req).length > 0) return;

    const normalizeChoiceLabel = (value: string) => value.toLowerCase().replace(/[\s_\-]+/g, '');
    const toChoice = (options: Array<{ label: string; value: number }>, label: string) =>
      options.find((o) => normalizeChoiceLabel(o.label) === normalizeChoiceLabel(label))?.value;

    const coerceByFieldType = (logicalName: string, input: string) => {
      const type = (projectFieldTypeMap[logicalName] ?? '').toLowerCase();
      const options = projectFieldOptionMap[logicalName] ?? [];
      if (type.includes('picklist') || type.includes('integer') || type.includes('int32')) {
        const matched = toChoice(options, input);
        if (matched !== undefined) return matched;
        const numeric = Number(input);
        if (!Number.isNaN(numeric)) return numeric;
      }
      return input;
    };

    const effectiveNote = (projectForm.note || '').trim();

    const payload: Record<string, unknown> = {
      new_name: projectForm.projectName.trim(),
      [projectTextColumns.projectName]: projectForm.projectName.trim(),
      [projectTextColumns.vendor]: projectForm.vendorName.trim(),
      [projectTextColumns.budget]: Number(projectForm.budget.trim()),
      crcf8_note: effectiveNote || undefined,
      [projectTextColumns.startDate]: new Date(projectForm.startDate).toISOString(),
      [projectTextColumns.endDate]: new Date(projectForm.endDate).toISOString(),
    };
    const hasColumn = (logicalName: string) => projectAvailableColumns.includes(logicalName.toLowerCase());
    payload.crcf8_programname = projectForm.programName;
    payload.new_projectpriority = Number(projectForm.projectPriority);
    payload.new_projecttype = Number(projectForm.projectType);
    payload.new_strategicgoal = Number(projectForm.strategicGoal);
    payload.crcf8_risks = projectForm.risks.trim();
    payload.crcf8_projectmanager = projectForm.assignToProjectManager;
    payload.new_kpi = projectForm.kpi;
    payload.new_projectcategory = projectForm.projectCategory;
    payload.new_methodology = coerceByFieldType('new_methodology', projectForm.methodology);
    payload.new_sector = projectForm.department;
    payload.crcf8_milestone = projectForm.milestone;
    payload.new_projectstatus = Number(projectForm.projectStatus);
    if (!hasColumn(projectTextColumns.projectCategory) && hasColumn(projectChoiceColumns.projectCategory)) payload[projectChoiceColumns.projectCategory] = coerceByFieldType(projectChoiceColumns.projectCategory, projectForm.projectCategory);
    if (!hasColumn(projectTextColumns.methodology) && hasColumn(projectChoiceColumns.methodology)) payload[projectChoiceColumns.methodology] = coerceByFieldType(projectChoiceColumns.methodology, projectForm.methodology);
    payload.crcf8_projectsponsor = projectForm.projectSponsor;

    setProjectFormBusy(true);
    try {
      const res = await New_projectsService.create(payload as Parameters<typeof New_projectsService.create>[0]);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to create project');

      setShowAddProjectForm(false);
      clearProjectForm();
      setProgramToast({ type: 'success', message: 'Project created successfully.' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to create project';
      setProgramToast({ type: 'error', message: msg });
    } finally {
      setProjectFormBusy(false);
    }
  };

  const loadProjectRows = async () => {
    setProjectRowsLoading(true);
    try {
      const res = await New_projectsService.getAll({ top: 500, orderBy: ['createdon desc'] });
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to load projects');
      setProjectRows((res.data ?? []) as unknown as Array<Record<string, unknown>>);
    } catch (error) {
      setProgramToast({ type: 'error', message: error instanceof Error ? error.message : 'Failed to load projects' });
    } finally {
      setProjectRowsLoading(false);
    }
  };

  useEffect(() => {
    if (activeNav === 'Projects' && showAddProjectForm) {
      void loadProjectFormData();
    }
  }, [activeNav, showAddProjectForm]);

  useEffect(() => {
    if (activeNav === 'Projects' && !showAddProjectForm) {
      void loadProjectRows();
    }
  }, [activeNav, showAddProjectForm]);

  const rowValueText = (row: Record<string, unknown>, column?: string) => {
    if (!column) return '-';
    if (column === (programColumns.status ?? 'new_status')) {
      const namedStatus = row[`${column}name`] ?? row.new_statusname;
      if (namedStatus !== undefined && namedStatus !== null && String(namedStatus).trim()) return String(namedStatus);
      const rawStatus = row[column] ?? row.new_status;
      const statusNum = Number(rawStatus ?? NaN);
      const mapped = statusOptions.find((opt) => opt.value === statusNum)?.label;
      if (mapped) return mapped;
      const fallbackMapped = fallbackStatusOptions.find((opt) => opt.value === statusNum)?.label;
      if (fallbackMapped) return fallbackMapped;
    }
    const direct = row[column];
    const named = row[`${column}name`];
    const value = named ?? direct;
    if (value === undefined || value === null || String(value).trim() === '') return '-';
    return String(value);
  };

  const readProjectStatusLabel = (row: Record<string, unknown>) => {
    const named =
      String(row.new_projectstatusname ?? row[`${projectChoiceColumns.projectStatus}name`] ?? '').trim();
    if (named) return named.toLowerCase();
    const raw = Number(row.new_projectstatus ?? row[projectChoiceColumns.projectStatus] ?? NaN);
    const dynamic = projectChoiceOptions.projectStatus.find((s) => s.value === raw)?.label;
    if (dynamic) return dynamic.toLowerCase();
    const fallback = New_projectsnew_projectstatus[raw as keyof typeof New_projectsnew_projectstatus];
    return String(fallback ?? '').toLowerCase();
  };

  const boardProjectsByStatus = projectBoardColumns.reduce<Record<string, Array<Record<string, unknown>>>>((acc, column) => {
    acc[column.title] = [];
    return acc;
  }, {});
  projectRows.forEach((row) => {
    const status = readProjectStatusLabel(row);
    if (status.includes('tostart') || status.includes('to start') || status.includes('planned')) {
      boardProjectsByStatus['To Start'].push(row);
    } else if (status.includes('ontrack') || status.includes('on track') || status.includes('active')) {
      boardProjectsByStatus['On Track'].push(row);
    } else if (status.includes('delay')) {
      boardProjectsByStatus.Delayed.push(row);
    } else if (status.includes('complete')) {
      boardProjectsByStatus.Completed.push(row);
    }
  });

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f6fb] text-gray-800">
      <aside className="w-52 bg-white border-r border-gray-100 flex flex-col flex-shrink-0">
        <div className="px-5 py-5 border-b border-gray-100">
          <LogoMark />
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map(({ name, icon }) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                setActiveNav(name);
                if (name !== 'Projects') {
                  setShowAddProjectForm(false);
                }
                if (name !== 'Meetings') {
                  setShowAddMeetingForm(false);
                }
                if (name !== 'Deliverables') {
                  setShowAddDeliverableForm(false);
                }
                if (name !== 'Reports') {
                  setShowAddReportForm(false);
                }
                if (name !== 'Program') {
                  setShowAddProgramForm(false);
                }
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeNav === name
                  ? 'bg-indigo-50 text-[#151d5d]'
                  : 'text-gray-400 hover:bg-gray-50 hover:text-gray-700'
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
            <ProfileDropdown onLogout={onLogout} />
          </div>
        </header>

        <main className="flex-1 overflow-auto p-5 space-y-4">
          {programToast && <NotificationToast type={programToast.type} message={programToast.message} onClose={() => setProgramToast(null)} />}
          {activeNav === 'Program' ? (
            <>
              {showAddProgramForm ? (
                <section className="bg-white rounded-xl p-6 shadow-sm">
                  <div className="flex items-start justify-between mb-6">
                    <h2 className="text-2xl font-bold text-[#20243b]">
                      {programFormMode === 'edit' ? 'Program / Edit Program' : 'Program / Add New Program'}
                    </h2>
                    <button
                      type="button"
                      className="text-3xl leading-none text-gray-500 hover:text-gray-700"
                      onClick={() => setShowAddProgramForm(false)}
                    >
                      ×
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5">
                    <label>
                      <span className="text-sm text-[#353b57]">Program Name <span className="text-rose-500">*</span></span>
                      <input
                        className="mt-2 h-10 w-full rounded-sm border border-gray-300 px-3 text-sm"
                        placeholder="Enter"
                        value={programForm.programName}
                        onChange={(e) => setProgramForm((f) => ({ ...f, programName: e.target.value }))}
                      />
                      {programFormErrors.programName && <p className="mt-1 text-[11px] text-rose-600">{programFormErrors.programName}</p>}
                    </label>
                    <label>
                      <span className="text-sm text-[#353b57]">Benefits <span className="text-rose-500">*</span></span>
                      <select
                        className="mt-2 h-10 w-full rounded-sm border border-gray-300 px-3 text-sm text-gray-500"
                        value={programForm.benefits}
                        onChange={(e) => setProgramForm((f) => ({ ...f, benefits: e.target.value }))}
                      >
                        <option value="">Select Benefits</option>
                        {benefitsOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      {programFormErrors.benefits && <p className="mt-1 text-[11px] text-rose-600">{programFormErrors.benefits}</p>}
                    </label>
                    <label>
                      <span className="text-sm text-[#353b57]">Project Manager <span className="text-rose-500">*</span></span>
                      <select
                        className="mt-2 h-10 w-full rounded-sm border border-gray-300 px-3 text-sm text-gray-500"
                        value={programForm.programManager}
                        onChange={(e) => setProgramForm((f) => ({ ...f, programManager: e.target.value }))}
                      >
                        <option value="">Select Project Manager</option>
                        {Array.from(new Set([...programManagerEmailOptions, programForm.programManager].filter(Boolean)))
                          .sort((a, b) => a.localeCompare(b))
                          .map((email) => (
                            <option key={email} value={email}>{email}</option>
                          ))}
                      </select>
                      {programFormErrors.programManager && <p className="mt-1 text-[11px] text-rose-600">{programFormErrors.programManager}</p>}
                    </label>

                    <label>
                      <span className="text-sm text-[#353b57]">Budgets <span className="text-rose-500">*</span></span>
                      <div className="mt-2 flex h-10 overflow-hidden rounded-sm border border-gray-300">
                        <input
                          className="h-full flex-1 px-3 text-sm outline-none"
                          placeholder="Enter"
                          value={programForm.budget}
                          inputMode="decimal"
                          onChange={(e) => {
                            const next = e.target.value;
                            if (/^\d*\.?\d*$/.test(next)) setProgramForm((f) => ({ ...f, budget: next }));
                          }}
                        />
                        <span className="w-12 border-l border-gray-300 text-xs text-gray-500 flex items-center justify-center">AED</span>
                      </div>
                      {programFormErrors.budget && <p className="mt-1 text-[11px] text-rose-600">{programFormErrors.budget}</p>}
                    </label>
                    <label>
                      <span className="text-sm text-[#353b57]">Start Date <span className="text-rose-500">*</span></span>
                      <input
                        type="date"
                        min={programFormMode === 'add' ? todayIso : undefined}
                        className="mt-2 h-10 w-full rounded-sm border border-gray-300 px-3 text-sm outline-none"
                        value={programForm.startDate}
                        onChange={(e) => setProgramForm((f) => ({ ...f, startDate: e.target.value }))}
                      />
                      {programFormErrors.startDate && <p className="mt-1 text-[11px] text-rose-600">{programFormErrors.startDate}</p>}
                    </label>
                    <label>
                      <span className="text-sm text-[#353b57]">End Date <span className="text-rose-500">*</span></span>
                      <input
                        type="date"
                        min={programForm.startDate || (programFormMode === 'add' ? todayIso : undefined)}
                        className="mt-2 h-10 w-full rounded-sm border border-gray-300 px-3 text-sm outline-none"
                        value={programForm.endDate}
                        onChange={(e) => setProgramForm((f) => ({ ...f, endDate: e.target.value }))}
                      />
                      {programFormErrors.endDate && <p className="mt-1 text-[11px] text-rose-600">{programFormErrors.endDate}</p>}
                    </label>
                    <label>
                      <span className="text-sm text-[#353b57]">ROI <span className="text-rose-500">*</span></span>
                      <input
                        className="mt-2 h-10 w-full rounded-sm border border-gray-300 px-3 text-sm"
                        placeholder="Enter ROI Value"
                        value={programForm.roi}
                        onChange={(e) => setProgramForm((f) => ({ ...f, roi: e.target.value }))}
                      />
                      {programFormErrors.roi && <p className="mt-1 text-[11px] text-rose-600">{programFormErrors.roi}</p>}
                    </label>

                    <label>
                      <span className="text-sm text-[#353b57]">KPI <span className="text-rose-500">*</span></span>
                      <select
                        className="mt-2 h-10 w-full rounded-sm border border-gray-300 px-3 text-sm text-gray-500"
                        value={programForm.kpi}
                        onChange={(e) => setProgramForm((f) => ({ ...f, kpi: e.target.value }))}
                      >
                        <option value="">Select KPI</option>
                        {kpiOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      {programFormErrors.kpi && <p className="mt-1 text-[11px] text-rose-600">{programFormErrors.kpi}</p>}
                    </label>
                    <label>
                      <span className="text-sm text-[#353b57]">Program Status <span className="text-rose-500">*</span></span>
                      <select
                        className="mt-2 h-10 w-full rounded-sm border border-gray-300 px-3 text-sm text-gray-500"
                        value={programForm.status}
                        onChange={(e) => setProgramForm((f) => ({ ...f, status: e.target.value }))}
                      >
                        <option value="">Select Program Status</option>
                        {statusOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      {programFormErrors.status && <p className="mt-1 text-[11px] text-rose-600">{programFormErrors.status}</p>}
                    </label>
                  </div>
                  {programFormMsg && <p className="mt-4 text-sm text-gray-700">{programFormMsg}</p>}

                  <div className="mt-16 flex items-center justify-end gap-5">
                    <button
                      type="button"
                      className="h-10 px-10 rounded-xl border border-[#b59b59] text-[#8f7a43] text-lg"
                      onClick={clearProgramForm}
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveProgram()}
                      disabled={programFormBusy}
                      className="h-10 px-12 rounded-xl bg-[#b59b59] text-white text-lg disabled:opacity-50"
                    >
                      {programFormBusy ? 'Saving...' : programFormMode === 'edit' ? 'Update' : 'Save'}
                    </button>
                  </div>
                </section>
              ) : (
                <>
                  <section className="flex items-center justify-between">
                    <h2 className="text-3xl font-bold text-[#2f3150]">Programs</h2>
                    <div className="flex items-center gap-2">
                      <button
                        className="h-8 px-4 rounded-md border border-gray-200 bg-white text-xs text-gray-600"
                        onClick={async () => {
                          await loadProgramMetadata();
                          await loadProgramManagerEmails();
                          await loadPrograms();
                        }}
                        disabled={programLoading}
                      >
                        {programLoading ? 'Refreshing...' : 'Refresh'}
                      </button>
                      <button
                        className="h-8 px-4 rounded-md bg-[#b28a44] text-white text-sm font-medium"
                        onClick={openAddProgram}
                      >
                        Add New Program
                      </button>
                    </div>
                  </section>

                  <section className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-3">
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-indigo-100 border-y border-indigo-200">
                          <tr className="text-[10px] text-[#3b4f8f] uppercase text-left">
                            <th className="px-3 py-2">Program Name</th>
                            <th className="px-3 py-2">Benefits</th>
                            <th className="px-3 py-2">Project Manager</th>
                            <th className="px-3 py-2">Budgets</th>
                            <th className="px-3 py-2">KPI</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Progress</th>
                            <th className="px-3 py-2">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {programLoading ? (
                            <tr className="border-b border-gray-100 text-xs text-gray-500">
                              <td className="px-3 py-3" colSpan={8}>Loading programs...</td>
                            </tr>
                          ) : programRows.length === 0 ? (
                            <tr className="border-b border-gray-100 text-xs text-gray-500">
                              <td className="px-3 py-3" colSpan={8}>No programs found.</td>
                            </tr>
                          ) : programRows.map((row) => {
                            const id = String(row.new_programid ?? row[programColumns.name ?? 'new_name'] ?? Math.random());
                            const displayText = (primary?: string, fallbacks: string[] = []) => {
                              const keys = [primary, ...fallbacks].filter(Boolean) as string[];
                              for (const key of keys) {
                                const value = rowValueText(row, key);
                                if (value !== '-') return value;
                              }
                              return '-';
                            };
                            const statusLabel = displayText(programColumns.status, ['new_programstatus']);
                            const progressText = rowValueText(row, programColumns.progress);
                            const statusClass =
                              statusLabel.toLowerCase().includes('delayed')
                                ? 'bg-rose-100 text-rose-700'
                                : statusLabel.toLowerCase().includes('on hold')
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-emerald-100 text-emerald-700';
                            return (
                              <tr key={id} className="border-b border-gray-100 text-xs text-gray-700">
                                <td className="px-3 py-2">{displayText(programColumns.name ?? 'new_name', ['new_name'])}</td>
                                <td className="px-3 py-2">{displayText(programColumns.benefits, ['new_benefits'])}</td>
                                <td className="px-3 py-2">{displayText(programColumns.manager, ['new_programmanager'])}</td>
                                <td className="px-3 py-2">{getProgramBudgetDisplay(row)}</td>
                                <td className="px-3 py-2">{displayText(programColumns.kpi, ['new_kpi'])}</td>
                                <td className="px-3 py-2">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${statusClass}`}>
                                    {statusLabel}
                                  </span>
                                </td>
                                <td className="px-3 py-2">{progressText === '-' ? '-' : `${progressText}%`}</td>
                                <td className="px-3 py-2">
                                  <button
                                    className="h-6 w-6 rounded border border-gray-200 inline-flex items-center justify-center text-gray-500 hover:bg-gray-50"
                                    onClick={() => void openEditProgram(row)}
                                  >
                                    <Pencil size={12} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <aside className="space-y-3">
                      <div className="bg-white rounded-xl p-3 shadow-sm chart-card">
                        <h3 className="text-sm font-semibold text-[#2f3150] mb-2">Budget chart</h3>
                        <div className="flex items-center justify-center">
                          <DonutChart
                            className="w-40 h-40 chart-svg"
                            showOuterLabels={false}
                            ringWidth={42}
                            slices={[
                              { label: 'Default Program', value: 68, color: '#323b8f' },
                              { label: 'Other', value: 32, color: '#dbe2f4' },
                            ]}
                          />
                        </div>
                      </div>
                      <div className="bg-white rounded-xl p-3 shadow-sm chart-card">
                        <h3 className="text-sm font-semibold text-[#2f3150] mb-2">Program Progress Levels</h3>
                        <svg viewBox="0 0 260 170" className="w-full h-36 chart-svg">
                          {[65, 66, 67, 68, 69, 70].map((v, idx) => (
                            <g key={v}>
                              <line x1="32" x2="240" y1={145 - idx * 22} y2={145 - idx * 22} stroke="#edf2f7" />
                              <text x="8" y={148 - idx * 22} fontSize="8" fill="#94a3b8">{v}</text>
                            </g>
                          ))}
                          <rect x="118" y="79" width="42" height="66" rx="4" fill="#1fcf92" className="chart-bar" />
                          <text x="137" y="72" textAnchor="middle" fontSize="10" fill="#2f3150">67</text>
                          <text x="142" y="158" textAnchor="middle" fontSize="8" fill="#6b7280" transform="rotate(-55 142 158)">Program 1</text>
                        </svg>
                      </div>
                    </aside>
                  </section>
                </>
              )}
            </>
          ) : activeNav === 'Reports' ? (
            <>
              {showAddReportForm ? (
                <section className="bg-white rounded-xl p-6 shadow-sm max-w-4xl mx-auto w-full">
                  <p className="text-[11px] text-gray-400 mb-5">
                    <button className="underline text-gray-500" onClick={() => setShowAddReportForm(false)}>Reports</button>
                    {' > '}Create New Report
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                    {[
                      ['Report Title', 'Enter Report Title'], ['Project Name', 'Enter Project Name'],
                      ['Program', 'Select'], ['Sector', 'Select'],
                      ['Program Status', 'Select'], ['Report Type', 'Select'],
                      ['Assign to Management Member', 'Select Member'], ['Remark', 'Remarks'],
                    ].map(([label, placeholder], idx) => (
                      <div key={label} className={idx === 7 ? 'md:row-span-2' : ''}>
                        <label className="text-[11px] text-gray-500">{label}</label>
                        {idx === 7 ? (
                          <textarea className="mt-1 w-full h-[88px] rounded-md border border-gray-200 px-3 py-2 text-sm resize-none" placeholder={placeholder} />
                        ) : (
                          <input className="mt-1 h-9 w-full rounded-md border border-gray-200 px-3 text-sm" placeholder={placeholder} />
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3">
                    <label className="text-[11px] text-gray-500">Summary</label>
                    <textarea className="mt-1 w-full h-16 rounded-md border border-gray-200 px-3 py-2 text-sm resize-none" placeholder="Report body" />
                  </div>
                  <div className="mt-3">
                    <label className="text-[11px] text-gray-500">Attachments</label>
                    <div className="mt-1 h-20 border border-dashed border-gray-300 rounded-md text-[10px] text-gray-400 flex items-center justify-center">
                      Choose a file or drag it here
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-end gap-3">
                    <button className="h-9 px-8 rounded-md border border-[#b28a44] text-[#b28a44] text-sm font-semibold">Cancel</button>
                    <button className="h-9 px-8 rounded-md border border-[#b28a44] text-[#b28a44] text-sm font-semibold">Review</button>
                    <button className="h-9 px-8 rounded-md bg-[#b28a44] text-white text-sm font-semibold">Send Report</button>
                  </div>
                </section>
              ) : (
                <>
                  <section className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-[#2f3150]">Reports</h2>
                    <button className="h-8 px-4 rounded-md bg-[#b28a44] text-white text-sm font-medium" onClick={() => setShowAddReportForm(true)}>+ Create a Report</button>
                  </section>
                  <section className="bg-white rounded-xl p-3 shadow-sm">
                    <div className="grid grid-cols-2 md:grid-cols-5 xl:grid-cols-10 gap-2">
                      {['Sector', 'Program', 'Project', 'KPI', 'Type', 'Budget', 'Program Manager', 'Project Manager', 'Duration', 'Status'].map((label) => (
                        <div key={label}>
                          <p className="text-[10px] text-gray-400 mb-1">{label}</p>
                          <button className="w-full h-7 rounded-md border border-gray-200 bg-gray-50 text-[10px] text-gray-500 flex items-center justify-between px-2">
                            <span>All</span>
                            <ChevronDown size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                  <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                    {reportStatsProgram.map((card) => (
                      <div key={card.label} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 chart-card">
                        <p className="text-[10px] text-gray-400">{card.label}</p>
                        <p className="text-3xl font-bold text-gray-800 mt-1">{card.label === 'Total Budget' ? '$478M' : card.value}</p>
                        <div className="h-0.5 rounded-full mt-3" style={{ backgroundColor: card.color }} />
                      </div>
                    ))}
                  </section>

                  <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                    <div className="bg-white rounded-xl p-3 shadow-sm chart-card min-h-[220px]">
                      <h3 className="text-xs font-semibold text-gray-700 mb-2">Project Category</h3>
                      <div className="flex items-center justify-center">
                        <DonutChart
                          className="w-36 h-36 chart-svg"
                          showOuterLabels={false}
                          ringWidth={40}
                          slices={[
                            { label: 'Application', value: 43, color: '#1667de' },
                            { label: 'Security', value: 59, color: '#d3525a' },
                            { label: 'Support', value: 36, color: '#3b3a80' },
                            { label: 'Infrastructure', value: 23, color: '#f6be00' },
                          ]}
                        />
                      </div>
                    </div>
                    <div className="bg-white rounded-xl p-3 shadow-sm chart-card min-h-[220px]">
                      <h3 className="text-xs font-semibold text-gray-700 mb-2">Projects Count</h3>
                      <svg viewBox="0 0 220 170" className="w-full h-40 chart-svg">
                        {[20, 40, 60, 80].map((v) => <line key={v} x1="26" x2="214" y1={140 - v} y2={140 - v} stroke="#f1f5f9" />)}
                        {[12, 45, 22, 50, 31].map((v, i) => (
                          <rect key={i} x={35 + i * 36} y={140 - v * 1.6} width="12" height={v * 1.6} rx="3" className="chart-bar" fill={['#59628a', '#d4a759', '#b28a44', '#60a5fa', '#d65257'][i]} />
                        ))}
                      </svg>
                    </div>
                    <div className="bg-white rounded-xl p-3 shadow-sm chart-card min-h-[220px]">
                      <h3 className="text-xs font-semibold text-gray-700 mb-2">Budget</h3>
                      <div className="flex items-center justify-center">
                        <DonutChart
                          className="w-36 h-36 chart-svg"
                          showOuterLabels={false}
                          ringWidth={42}
                          slices={[
                            { label: 'Financial', value: 43, color: '#1667de' },
                            { label: 'Knowledge', value: 25, color: '#f6be00' },
                            { label: 'External', value: 21, color: '#3b3a80' },
                            { label: 'HR', value: 18, color: '#d3525a' },
                          ]}
                        />
                      </div>
                    </div>
                    <div className="bg-white rounded-xl p-3 shadow-sm chart-card min-h-[220px]">
                      <h3 className="text-xs font-semibold text-gray-700 mb-2">Projects by progress</h3>
                      <div className="flex items-center justify-center">
                        <DonutChart
                          className="w-36 h-36 chart-svg"
                          showOuterLabels={false}
                          ringWidth={42}
                          slices={[
                            { label: 'Completed', value: 46, color: '#1667de' },
                            { label: 'On Hold', value: 27, color: '#f6be00' },
                            { label: 'Delayed', value: 21, color: '#d3525a' },
                          ]}
                        />
                      </div>
                    </div>
                  </section>
                  <section className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-y border-gray-100">
                        <tr className="text-[10px] text-gray-400 uppercase text-left">
                          <th className="px-3 py-2">Project Name</th>
                          <th className="px-3 py-2">Priority</th>
                          <th className="px-3 py-2">Type</th>
                          <th className="px-3 py-2">Budget</th>
                          <th className="px-3 py-2">Strag. Obj</th>
                          <th className="px-3 py-2">PM</th>
                          <th className="px-3 py-2">Dates</th>
                          <th className="px-3 py-2">Progress Level</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportRowsProgram.map((row, idx) => (
                          <tr key={`${row.project}-${idx}`} className="border-b border-gray-100 text-xs text-gray-700">
                            <td className="px-3 py-2 text-indigo-700 underline">{row.project}</td>
                            <td className="px-3 py-2">{row.priority}</td>
                            <td className="px-3 py-2">{row.type}</td>
                            <td className="px-3 py-2 font-semibold text-rose-500">{row.budget}</td>
                            <td className="px-3 py-2">{row.pm}</td>
                            <td className="px-3 py-2">{row.owner}</td>
                            <td className="px-3 py-2">
                              <div className="leading-4">
                                <p className="text-[10px] text-gray-400">Start date</p>
                                <p>{row.start}</p>
                                <p className="text-[10px] text-gray-400 mt-1">End date</p>
                                <p>{row.end}</p>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${row.progress}%` }} />
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-1 rounded-full text-[9px] font-semibold ${row.statusColor}`}>{row.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="px-3 py-2 text-[10px] text-gray-400 text-right">1-10 of 15</div>
                  </section>
                </>
              )}
            </>
          ) : activeNav === 'Project Pipeline' ? (
            <>
              <section className="bg-white rounded-xl p-4 shadow-sm chart-card">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Business Pipeline</h2>
                <div className="border border-gray-100 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] uppercase tracking-wide text-gray-400">Projects</p>
                    <div className="flex items-center gap-2">
                      <button className="h-7 px-2 rounded-md border border-gray-200 text-[10px] text-gray-500">Year 2024</button>
                      <button className="h-7 px-2 rounded-md border border-gray-200 text-[10px] text-gray-500">All Categories</button>
                    </div>
                  </div>
                  <svg viewBox="0 0 700 210" className="w-full h-52 chart-svg">
                    {[0, 10, 20, 30, 40].map((v) => (
                      <g key={v}>
                        <line x1="26" x2="680" y1={180 - v * 3.6} y2={180 - v * 3.6} stroke="#edf2f7" />
                        <text x="14" y={184 - v * 3.6} fontSize="9" fill="#94a3b8">{v}</text>
                      </g>
                    ))}
                    {[8, 30, 14, 38, 22, 28, 20, 32, 34, 16].map((v, i) => (
                      <rect key={i} x={48 + i * 62} y={180 - v * 3.6} width="18" height={v * 3.6} rx="4" className="chart-bar" fill={['#7c3aed', '#4cc9f0', '#16a34a', '#2563eb', '#74c69d', '#fb923c', '#ef4444', '#22c55e', '#e9c46a', '#6b7280'][i]} />
                    ))}
                  </svg>
                </div>
              </section>

              <section className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-y border-gray-100">
                    <tr className="text-[10px] text-gray-400 uppercase text-left">
                      <th className="px-4 py-2">Program Name</th>
                      <th className="px-4 py-2">Benefits</th>
                      <th className="px-4 py-2">Budget</th>
                      <th className="px-4 py-2">Current Stage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pipelineRowsProgram.map((row) => (
                      <tr key={row.name} className="border-b border-gray-100 text-xs text-gray-700">
                        <td className="px-4 py-2 text-indigo-700 underline">{row.name}</td>
                        <td className="px-4 py-2">{row.benefit}</td>
                        <td className={`px-4 py-2 font-semibold ${row.budget === '$25' ? 'text-emerald-500' : row.budget === '$42' ? 'text-rose-500' : 'text-indigo-700'}`}>{row.budget}</td>
                        <td className="px-4 py-2">{row.stage}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </>
          ) : activeNav === 'Deliverables' ? (
            <>
              {showAddDeliverableForm ? (
                <section className="bg-white rounded-xl p-6 shadow-sm max-w-4xl mx-auto w-full">
                  <p className="text-[11px] text-gray-400 mb-5">
                    <button className="underline text-gray-500" onClick={() => setShowAddDeliverableForm(false)}>Deliverables</button>
                    {' > '}Add New Deliverables
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
                    <div>
                      <label className="text-[11px] text-gray-500">Project Name</label>
                      <select className="mt-1 h-9 w-full rounded-md border border-gray-200 px-3 text-sm text-gray-400"><option>Select Project Name</option></select>
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-500">Project Category</label>
                      <select className="mt-1 h-9 w-full rounded-md border border-gray-200 px-3 text-sm text-gray-400"><option>Auto fetch</option></select>
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-500">Project Manager</label>
                      <select className="mt-1 h-9 w-full rounded-md border border-gray-200 px-3 text-sm text-gray-400"><option>Auto fetch</option></select>
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-500">Project Goal</label>
                      <input className="mt-1 h-9 w-full rounded-md border border-gray-200 px-3 text-sm text-gray-500" value="Auto fetch" readOnly />
                    </div>
                  </div>

                  <p className="text-[12px] font-semibold text-gray-700 mt-5 mb-3">The deliverables include:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-6 text-[11px] text-gray-600">
                    {[
                      'Hardware', 'Licenses', 'Phase1', 'Phase2', 'Design', 'Business Requirements', 'Design Document', 'User Manual Document',
                      'UAT', 'Production Link', 'Training', 'Knowledge Transfer', 'Professional Services', 'Consultation', 'Scope Document', 'Report',
                    ].map((item, idx) => (
                      <label key={item} className="flex items-center gap-2">
                        <input type="checkbox" className="accent-[#b28a44]" defaultChecked={[0, 2, 4, 8, 10, 12].includes(idx)} />
                        {item}
                      </label>
                    ))}
                  </div>

                  <div className="mt-4">
                    <label className="text-[11px] text-gray-500">Notes</label>
                    <textarea className="mt-1 w-full h-24 rounded-md border border-gray-200 px-3 py-2 text-sm resize-none" placeholder="Notes..." />
                  </div>

                  <div className="mt-5 flex items-center justify-end gap-3">
                    <button className="h-9 px-8 rounded-md border border-[#b28a44] text-[#b28a44] text-sm font-semibold">Cancel</button>
                    <button className="h-9 px-8 rounded-md bg-[#b28a44] text-white text-sm font-semibold">+ Save</button>
                  </div>
                </section>
              ) : (
                <>
                  <section className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-[#2f3150]">Display List Of Deliverables</h2>
                    <button className="h-8 px-4 rounded-md bg-[#b28a44] text-white text-sm font-medium" onClick={() => setShowAddDeliverableForm(true)}>+ New Deliverable</button>
                  </section>

                  <section className="grid grid-cols-1 xl:grid-cols-[1fr_260px] gap-3">
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-y border-gray-100">
                          <tr className="text-[10px] text-gray-400 uppercase text-left">
                            <th className="px-3 py-2">Project</th>
                            <th className="px-3 py-2">Project Sponsor</th>
                            <th className="px-3 py-2">Deliverables</th>
                            <th className="px-3 py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deliverablesRows.map((row, idx) => (
                            <tr key={`${row.project}-${idx}`} className="border-b border-gray-100 text-xs text-gray-700">
                              <td className="px-3 py-2 text-indigo-700 underline">{row.project}</td>
                              <td className="px-3 py-2">{row.sponsor}</td>
                              <td className="px-3 py-2">{row.items}</td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${row.statusColor}`}>{row.status}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="px-3 py-2 text-[10px] text-gray-400 text-right">1-10 of 15</div>
                    </div>

                    <aside className="space-y-3">
                      <div className="bg-white rounded-xl p-3 shadow-sm chart-card">
                        <h3 className="text-sm font-semibold text-[#2f3150] mb-2">Deliverables Status</h3>
                        <svg viewBox="0 0 260 170" className="w-full h-36 chart-svg">
                          {[0, 5, 10, 15, 20, 25].map((v) => (
                            <g key={v}>
                              <line x1="24" x2="244" y1={130 - v * 4.2} y2={130 - v * 4.2} stroke="#e5e7eb" />
                              <text x="6" y={133 - v * 4.2} fontSize="8" fill="#94a3b8">{v}</text>
                            </g>
                          ))}
                          <polygon points="24,71 79,75 134,88 189,46 244,96 244,130 24,130" fill="#1d4ed8" />
                          <polygon points="24,130 79,122 134,35 189,67 244,28 244,130 24,130" fill="#ef4444" opacity="0.85" />
                          <polygon points="24,71 79,122 134,118 189,46 244,96 244,130 24,130" fill="#f6be00" opacity="0.95" />
                          {['Jan', 'Feb', 'Mar', 'Apr', 'May'].map((m, i) => (
                            <text key={m} x={22 + i * 55} y="145" fontSize="8" fill="#94a3b8">{m}</text>
                          ))}
                          <circle cx="30" cy="160" r="4" fill="#ef4444" />
                          <text x="40" y="163" fontSize="8" fill="#6b7280">Total</text>
                          <circle cx="88" cy="160" r="4" fill="#1d4ed8" />
                          <text x="98" y="163" fontSize="8" fill="#6b7280">Delivered</text>
                          <circle cx="158" cy="160" r="4" fill="#f6be00" />
                          <text x="168" y="163" fontSize="8" fill="#6b7280">To Be Delivered</text>
                        </svg>
                      </div>
                      <div className="bg-white rounded-xl p-3 shadow-sm chart-card">
                        <h3 className="text-sm font-semibold text-[#2f3150] mb-2">Deliverables via Projects</h3>
                        <svg viewBox="0 0 260 180" className="w-full h-40 chart-svg">
                          <text x="8" y="20" fontSize="8" fill="#94a3b8">DELIVERABLES</text>
                          {[10, 20, 30, 40, 50].map((v) => (
                            <g key={v}>
                              <line x1="24" x2="244" y1={140 - v * 2.2} y2={140 - v * 2.2} stroke="#e5e7eb" strokeDasharray="3 3" />
                              <text x="10" y={143 - v * 2.2} fontSize="8" fill="#94a3b8">{v}</text>
                            </g>
                          ))}
                          {[13, 44, 21, 50, 30].map((v, i) => (
                            <rect key={i} x={40 + i * 40} y={140 - v * 2.2} width="16" height={v * 2.2} rx="4" className="chart-bar" fill={['#59628a', '#e4bf7f', '#bf9650', '#6fa0e4', '#d65257'][i]} />
                          ))}
                          {['Code.Tech', 'ExProcess', 'Scaling', 'RightPath', 'Digital Retail'].map((name, i) => (
                            <text key={name} x={48 + i * 40} y="160" fontSize="8" fill="#2f3150" textAnchor="middle" transform={`rotate(-60 48 ${160})`}>
                              {name}
                            </text>
                          ))}
                          <text x="236" y="176" fontSize="8" fill="#2f3150" transform="rotate(-90 236 176)">PROJECTS</text>
                        </svg>
                      </div>
                    </aside>
                  </section>
                </>
              )}
            </>
          ) : activeNav === 'Meetings' ? (
            <>
              {showAddMeetingForm ? (
                <section className="grid grid-cols-1 xl:grid-cols-[1fr_220px] gap-3">
                  <div className="bg-white rounded-xl p-5 shadow-sm">
                    <p className="text-[11px] text-gray-400 mb-4">
                      <button className="underline text-gray-500" onClick={() => setShowAddMeetingForm(false)}>Meetings</button>
                      {' > '}Add New Meeting
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                      {[
                        ['Meeting Title', 'Enter Meeting Title'], ['Meeting Category', 'Select Category'],
                        ['Department', 'Select'], ['Project Name', 'Select Project Name'],
                        ['Vendor Name/Email', 'Enter Vendor Name/Email'], ['Project Manager', 'Select Project Manager'],
                        ['Attendance', 'Select'], ['Meeting Date', 'Select Date'],
                        ['Start Time', '--:--'], ['End Time', '--:--'], ['Meeting Location', 'Enter Meeting Location'],
                      ].map(([label, placeholder], i) => (
                        <div key={label} className={i === 10 ? 'md:col-span-2' : ''}>
                          <label className="text-[11px] text-gray-500">{label}</label>
                          <input className="mt-1 h-9 w-full rounded-md border border-gray-200 px-3 text-sm" placeholder={placeholder} />
                        </div>
                      ))}
                    </div>
                    <div className="mt-3">
                      <label className="text-[11px] text-gray-500">Meeting Agenda</label>
                      <textarea className="mt-1 h-20 w-full rounded-md border border-gray-200 px-3 py-2 text-sm resize-none" placeholder="Meeting Agenda" />
                    </div>
                    <div className="mt-4 flex items-center justify-end gap-3">
                      <button className="h-9 px-7 rounded-md border border-[#b28a44] text-[#b28a44] text-sm font-medium">Cancel</button>
                      <button className="h-9 px-7 rounded-md bg-[#b28a44] text-white text-sm font-medium">Add to Calendar</button>
                    </div>
                  </div>
                  <aside className="space-y-3">
                    <div className="bg-white rounded-xl p-3 shadow-sm">
                      <h3 className="text-xs font-semibold text-[#2f3150] mb-2">Meeting Insights</h3>
                      <svg viewBox="0 0 180 130" className="w-full h-32 chart-svg">
                        {[0, 20, 40, 60, 80, 100].map((v) => (
                          <line key={v} x1="20" x2="170" y1={110 - v * 0.9} y2={110 - v * 0.9} stroke="#edf2f7" />
                        ))}
                        {[15, 38, 70, 46, 60, 68, 42, 80].map((v, i) => (
                          <rect key={i} x={26 + i * 18} y={110 - v * 0.9} width="10" height={v * 0.9} rx="2" className="chart-bar" fill={['#ef4444','#d4a759','#d4a759','#0ea5e9','#4f46e5','#f6be00','#10b981','#2563eb'][i]} />
                        ))}
                      </svg>
                    </div>
                    <div className="bg-white rounded-xl p-3 shadow-sm">
                      <h3 className="text-xs font-semibold text-[#2f3150] mb-2">Meetings Category</h3>
                      <div className="space-y-1 text-[10px]">
                        {[
                          ['Follow Up', 78, '#4f46e5'], ['Requirements', 64, '#f6be00'], ['Technical', 58, '#0ea5e9'],
                          ['Planning', 51, '#10b981'], ['Brain Session', 43, '#ef4444'], ['Testing', 37, '#8b5cf6'],
                        ].map(([label, value, color]) => (
                          <div key={`${label}-${value}`} className="flex items-center gap-2">
                            <span className="w-16 text-gray-500">{label}</span>
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full" style={{ width: `${value}%`, backgroundColor: String(color) }} />
                            </div>
                            <span className="text-gray-400">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </aside>
                </section>
              ) : (
                <section className="bg-white rounded-xl p-4 shadow-sm chart-card">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-3xl font-bold text-[#2f3150]">Meeting</h2>
                    <div className="flex items-center gap-2">
                      <button className="h-7 px-3 rounded-md border border-gray-200 text-[10px] text-gray-500">Project Name</button>
                      <button className="h-7 px-2 rounded-md border border-gray-200 text-[10px] text-gray-500">Today</button>
                      <button className="h-7 px-3 rounded-md border border-gray-200 text-[10px] text-gray-500">Jun 09 2024</button>
                      <button className="h-8 px-4 rounded-md border border-[#b28a44] text-[#b28a44] text-sm font-medium">Month</button>
                      <button className="h-8 px-4 rounded-md bg-[#b28a44] text-white text-sm font-medium" onClick={() => setShowAddMeetingForm(true)}>+ New Meeting</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-[1fr_250px] gap-3">
                    <div className="border border-gray-100 rounded-lg p-2 overflow-hidden">
                      <svg viewBox="0 0 720 360" className="w-full h-[340px] chart-svg">
                        {[0, 1, 2, 3, 4, 5].map((r) => (
                          <line key={`r-${r}`} x1="50" x2="700" y1={40 + r * 52} y2={40 + r * 52} stroke="#edf2f7" />
                        ))}
                        {[0, 1, 2, 3, 4].map((c) => (
                          <line key={`c-${c}`} x1={50 + c * 130} x2={50 + c * 130} y1="40" y2="300" stroke="#edf2f7" />
                        ))}
                        {['9:00', '10:00', '11:00', '12:00', '13:00', '14:00'].map((t, i) => (
                          <text key={t} x="8" y={44 + i * 52} fontSize="9" fill="#9ca3af">{t}</text>
                        ))}
                        {meetingBlocks.map((m, i) => (
                          <g key={m.label + i}>
                            <rect
                              x={58 + m.col * 130}
                              y={58 + m.row * 42}
                              width="90"
                              height="18"
                              rx="9"
                              fill={m.color}
                              className="chart-bar"
                            />
                            <text x={64 + m.col * 130} y={71 + m.row * 42} fontSize="8" fill="#fff">{m.label}</text>
                          </g>
                        ))}
                      </svg>
                    </div>
                    <aside className="bg-[#f9fafb] border border-gray-100 rounded-lg p-3">
                      <h3 className="text-sm font-semibold text-[#2f3150] mb-2">Scheduled Meetings</h3>
                      <div className="space-y-2">
                        {scheduledMeetings.map((item) => (
                          <div key={item.title + item.time} className="rounded-md px-2 py-1.5" style={{ backgroundColor: item.color }}>
                            <p className="text-[10px] text-[#2f3150] font-semibold">{item.title}</p>
                            <p className="text-[9px] text-gray-500">{item.time}</p>
                          </div>
                        ))}
                      </div>
                    </aside>
                  </div>
                </section>
              )}
            </>
          ) : activeNav === 'Projects' ? (
            <>
              {showAddProjectForm ? (
                <section className="bg-white rounded-xl p-6 shadow-sm max-w-5xl mx-auto w-full">
                  <p className="text-[11px] text-gray-400 mb-5">
                    <button className="underline text-gray-500" onClick={() => setShowAddProjectForm(false)}>Projects</button>
                    {' > '}Add New Project
                  </p>
                  {projectMetaLoading && <p className="mb-3 text-xs text-gray-500">Loading dropdown values...</p>}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                    <div>
                      <label className="text-[11px] text-gray-500">Project Name *</label>
                      <input className="mt-1 h-9 w-full rounded-md border border-gray-200 px-3 text-sm" value={projectForm.projectName} onChange={(e) => setProjectForm((f) => ({ ...f, projectName: e.target.value }))} />
                      {projectFormErrors.projectName && <p className="mt-1 text-[11px] text-rose-600">{projectFormErrors.projectName}</p>}
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-500">Program Name *</label>
                      <select className="mt-1 h-9 w-full cursor-pointer rounded-md border border-gray-200 px-3 text-sm" value={projectForm.programName} onChange={(e) => setProjectForm((f) => ({ ...f, programName: e.target.value }))}>
                        <option value="">Select Program</option>
                        {projectMasterOptions.program.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                      {projectFormErrors.programName && <p className="mt-1 text-[11px] text-rose-600">{projectFormErrors.programName}</p>}
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-500">Vendor Name *</label>
                      <select className="mt-1 h-9 w-full cursor-pointer rounded-md border border-gray-200 px-3 text-sm" value={projectForm.vendorName} onChange={(e) => setProjectForm((f) => ({ ...f, vendorName: e.target.value }))}>
                        <option value="">Select Vendor</option>
                        {vendorOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                      {projectFormErrors.vendorName && <p className="mt-1 text-[11px] text-rose-600">{projectFormErrors.vendorName}</p>}
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-500">Project Priority *</label>
                      <select className="mt-1 h-9 w-full cursor-pointer rounded-md border border-gray-200 px-3 text-sm" value={projectForm.projectPriority} onChange={(e) => setProjectForm((f) => ({ ...f, projectPriority: e.target.value }))}>
                        <option value="">Select Project Priority</option>
                        {projectChoiceOptions.projectPriority.map((opt) => <option key={opt.value} value={String(opt.value)}>{opt.label}</option>)}
                      </select>
                      {projectFormErrors.projectPriority && <p className="mt-1 text-[11px] text-rose-600">{projectFormErrors.projectPriority}</p>}
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-500">Project Category *</label>
                      <select className="mt-1 h-9 w-full cursor-pointer rounded-md border border-gray-200 px-3 text-sm" value={projectForm.projectCategory} onChange={(e) => setProjectForm((f) => ({ ...f, projectCategory: e.target.value }))}>
                        <option value="">Select Project Category</option>
                        {projectMasterOptions.projectCategory.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                      {projectFormErrors.projectCategory && <p className="mt-1 text-[11px] text-rose-600">{projectFormErrors.projectCategory}</p>}
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-500">Project Type *</label>
                      <select className="mt-1 h-9 w-full cursor-pointer rounded-md border border-gray-200 px-3 text-sm" value={projectForm.projectType} onChange={(e) => setProjectForm((f) => ({ ...f, projectType: e.target.value }))}>
                        <option value="">Select Project Type</option>
                        {projectChoiceOptions.projectType.map((opt) => <option key={opt.value} value={String(opt.value)}>{opt.label}</option>)}
                      </select>
                      {projectFormErrors.projectType && <p className="mt-1 text-[11px] text-rose-600">{projectFormErrors.projectType}</p>}
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-500">Strategic Goal *</label>
                      <select className="mt-1 h-9 w-full cursor-pointer rounded-md border border-gray-200 px-3 text-sm" value={projectForm.strategicGoal} onChange={(e) => setProjectForm((f) => ({ ...f, strategicGoal: e.target.value }))}>
                        <option value="">Select Goal</option>
                        {projectChoiceOptions.strategicGoal.map((opt) => <option key={opt.value} value={String(opt.value)}>{opt.label}</option>)}
                      </select>
                      {projectFormErrors.strategicGoal && <p className="mt-1 text-[11px] text-rose-600">{projectFormErrors.strategicGoal}</p>}
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-500">Budget *</label>
                      <div className="mt-1 flex h-9 overflow-hidden rounded-md border border-gray-200">
                        <input className="h-full flex-1 px-3 text-sm outline-none" value={projectForm.budget} inputMode="decimal" onChange={(e) => {
                          const next = e.target.value;
                          if (/^\d*\.?\d*$/.test(next)) setProjectForm((f) => ({ ...f, budget: next }));
                        }} />
                        <span className="w-12 border-l border-gray-200 text-xs text-gray-500 flex items-center justify-center">AED</span>
                      </div>
                      {projectFormErrors.budget && <p className="mt-1 text-[11px] text-rose-600">{projectFormErrors.budget}</p>}
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-500">Assign to Project Manager *</label>
                      <select className="mt-1 h-9 w-full cursor-pointer rounded-md border border-gray-200 px-3 text-sm" value={projectForm.assignToProjectManager} onChange={(e) => setProjectForm((f) => ({ ...f, assignToProjectManager: e.target.value }))}>
                        <option value="">Select Project Manager</option>
                        {projectManagerEmails.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                      {projectFormErrors.assignToProjectManager && <p className="mt-1 text-[11px] text-rose-600">{projectFormErrors.assignToProjectManager}</p>}
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-500">Risks *</label>
                      <input className="mt-1 h-9 w-full rounded-md border border-gray-200 px-3 text-sm" value={projectForm.risks} onChange={(e) => setProjectForm((f) => ({ ...f, risks: e.target.value }))} />
                      {projectFormErrors.risks && <p className="mt-1 text-[11px] text-rose-600">{projectFormErrors.risks}</p>}
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-500">KPI</label>
                      <select className="mt-1 h-9 w-full cursor-pointer rounded-md border border-gray-200 px-3 text-sm" value={projectForm.kpi} onChange={(e) => setProjectForm((f) => ({ ...f, kpi: e.target.value }))}>
                        <option value="">Select KPI</option>
                        {projectMasterOptions.kpi.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-500">Methodology *</label>
                      <select className="mt-1 h-9 w-full cursor-pointer rounded-md border border-gray-200 px-3 text-sm" value={projectForm.methodology} onChange={(e) => setProjectForm((f) => ({ ...f, methodology: e.target.value }))}>
                        <option value="">Select Methodology</option>
                        {projectMasterOptions.methodology.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                      {projectFormErrors.methodology && <p className="mt-1 text-[11px] text-rose-600">{projectFormErrors.methodology}</p>}
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-500">Start Date *</label>
                      <input type="date" min={todayIso} className="mt-1 h-9 w-full rounded-md border border-gray-200 px-3 text-sm" value={projectForm.startDate} onChange={(e) => setProjectForm((f) => ({ ...f, startDate: e.target.value }))} />
                      {projectFormErrors.startDate && <p className="mt-1 text-[11px] text-rose-600">{projectFormErrors.startDate}</p>}
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-500">End Date *</label>
                      <input type="date" min={projectForm.startDate || todayIso} className="mt-1 h-9 w-full rounded-md border border-gray-200 px-3 text-sm" value={projectForm.endDate} onChange={(e) => setProjectForm((f) => ({ ...f, endDate: e.target.value }))} />
                      {projectFormErrors.endDate && <p className="mt-1 text-[11px] text-rose-600">{projectFormErrors.endDate}</p>}
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-500">Department *</label>
                      <select className="mt-1 h-9 w-full cursor-pointer rounded-md border border-gray-200 px-3 text-sm" value={projectForm.department} onChange={(e) => setProjectForm((f) => ({ ...f, department: e.target.value }))}>
                        <option value="">Select Department</option>
                        {projectMasterOptions.sector.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                      {projectFormErrors.department && <p className="mt-1 text-[11px] text-rose-600">{projectFormErrors.department}</p>}
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-500">Project Status *</label>
                      <select className="mt-1 h-9 w-full cursor-pointer rounded-md border border-gray-200 px-3 text-sm" value={projectForm.projectStatus} onChange={(e) => setProjectForm((f) => ({ ...f, projectStatus: e.target.value }))}>
                        <option value="">Select Project Status</option>
                        {projectChoiceOptions.projectStatus.map((opt) => <option key={opt.value} value={String(opt.value)}>{opt.label}</option>)}
                      </select>
                      {projectFormErrors.projectStatus && <p className="mt-1 text-[11px] text-rose-600">{projectFormErrors.projectStatus}</p>}
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-500">Milestone *</label>
                      <select className="mt-1 h-9 w-full cursor-pointer rounded-md border border-gray-200 px-3 text-sm" value={projectForm.milestone} onChange={(e) => setProjectForm((f) => ({ ...f, milestone: e.target.value }))}>
                        <option value="">Select Milestone</option>
                        {projectMasterOptions.milestone.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                      {projectFormErrors.milestone && <p className="mt-1 text-[11px] text-rose-600">{projectFormErrors.milestone}</p>}
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-500">Project Sponsor *</label>
                      <select className="mt-1 h-9 w-full cursor-pointer rounded-md border border-gray-200 px-3 text-sm" value={projectForm.projectSponsor} onChange={(e) => setProjectForm((f) => ({ ...f, projectSponsor: e.target.value }))}>
                        <option value="">Select Project Sponsor</option>
                        {projectSponsorEmails.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                      {projectFormErrors.projectSponsor && <p className="mt-1 text-[11px] text-rose-600">{projectFormErrors.projectSponsor}</p>}
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-500">Attachments</label>
                      <input type="file" className="mt-1 h-9 w-full rounded-md border border-gray-200 px-2 text-sm" onChange={(e) => setProjectForm((f) => ({ ...f, attachment: e.target.files?.[0] ?? null }))} />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="text-[11px] text-gray-500">Note</label>
                    <textarea className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm h-24 resize-none" value={projectForm.note} onChange={(e) => setProjectForm((f) => ({ ...f, note: e.target.value }))} />
                  </div>

                  <div className="mt-5 flex items-center justify-end gap-3">
                    <button type="button" className="h-9 px-8 rounded-md border border-[#b28a44] text-[#b28a44] text-sm font-semibold" onClick={() => setShowAddProjectForm(false)}>Cancel</button>
                    <button type="button" className="h-9 px-8 rounded-md border border-[#b28a44] text-[#b28a44] text-sm font-semibold" onClick={clearProjectForm}>Clear</button>
                    <button type="button" className="h-9 px-8 rounded-md bg-[#b28a44] text-white text-sm font-semibold disabled:opacity-50" disabled={projectFormBusy || projectMetaLoading} onClick={() => void saveProject()}>
                      {projectFormBusy ? 'Saving...' : '+ Save'}
                    </button>
                  </div>
                </section>
              ) : (
                <>
                  <section className="flex items-center justify-between">
                    <h2 className="text-4xl font-bold text-[#262f68]">Projects</h2>
                    <button
                      className="h-9 px-4 rounded-md bg-[#b28a44] text-white text-sm font-medium"
                      onClick={() => {
                        clearProjectForm();
                        setShowAddProjectForm(true);
                      }}
                    >
                      + New Project
                    </button>
                  </section>

                  <section className="grid grid-cols-1 lg:grid-cols-4 gap-3">
                    {projectBoardColumns.map((column) => (
                      <div key={column.title} className="space-y-3">
                        <div className="bg-white rounded-lg px-3 py-2 flex items-center justify-between">
                          <h3 className="text-2xl font-semibold text-[#2f3150]">{column.title}</h3>
                          <span className="text-[11px] text-[#b28a44]">{boardProjectsByStatus[column.title]?.length ?? 0}</span>
                        </div>
                        <div className="max-h-[65vh] overflow-y-auto pr-1 space-y-3">
                          {projectRowsLoading ? (
                            <p className="text-xs text-gray-500 px-1">Loading projects...</p>
                          ) : (boardProjectsByStatus[column.title] ?? []).length === 0 ? (
                            <p className="text-xs text-gray-400 px-1">No projects in this status.</p>
                          ) : (
                            (boardProjectsByStatus[column.title] ?? []).map((row, rowIdx) => (
                              <article key={`${column.title}-${String(row.new_projectid ?? rowIdx)}`} className="bg-white rounded-xl p-3 shadow-sm chart-card">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-sm font-semibold underline" style={{ color: column.color }}>
                                    {String(row.new_projectname ?? row.new_name ?? 'Project Name')}
                                  </p>
                                  <span className="text-[10px] text-gray-400">{String(row.new_projectstatusname ?? column.title)}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-y-1 text-[10px] text-gray-500 mb-2">
                                  <p>Project Sponsor: {String(row.crcf8_projectsponsor ?? row.new_projectsponsorname ?? row.new_projectsponsor ?? '-')}</p>
                                  <p className="text-right">AED {String(row.new_budget ?? '-')}</p>
                                  <p>Category: {String(row.new_projectcategoryname ?? row.new_projectcategory ?? '-')}</p>
                                  <p className="text-right">Method: {String(row.new_methodologyname ?? row.new_methodology ?? '-')}</p>
                                </div>
                                <div className="grid grid-cols-2 text-[10px] mb-1">
                                  <div>
                                    <p className="text-gray-400">Start Date</p>
                                    <p className="text-[#2f3150] font-semibold">{String(row.new_startdate ?? '-').slice(0, 10)}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-400">End Date</p>
                                    <p className="text-[#2f3150] font-semibold">{String(row.new_enddate ?? '-').slice(0, 10)}</p>
                                  </div>
                                </div>
                              </article>
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </section>
                </>
              )}
            </>
          ) : (
            <>
          <section className="bg-white rounded-xl p-4 shadow-sm chart-card">
            <h2 className="text-sm font-bold text-gray-900 mb-3">Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
              {overviewCards.map((card) => (
                <div key={card.label} className="border rounded-lg p-2.5 bg-white" style={{ borderColor: `${card.color}66` }}>
                  <p className="text-[10px] text-gray-400">{card.label}</p>
                  <p className="text-2xl font-bold text-[#2f3150] mt-1">{card.value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-xl p-4 shadow-sm chart-card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900">Insights</h2>
              <div className="flex items-center gap-2">
                {['Projects', 'All Departments', 'All Status', 'This Month'].map((f) => (
                  <button key={f} className="h-7 px-2 rounded-md border border-gray-200 text-[10px] text-gray-500">
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 min-h-[210px]">
                <h3 className="text-[11px] font-semibold text-gray-600 mb-2">Budget</h3>
                <div className="flex items-center justify-between gap-2">
                  <svg viewBox="0 0 180 180" className="w-44 h-44 chart-svg">
                    <circle cx="90" cy="90" r="46" fill="#3b82f6" />
                    <path d="M90 90 L90 44 A46 46 0 0 1 134 70 Z" fill="#d4a759" />
                    <path d="M90 90 L134 70 A46 46 0 0 1 125 118 Z" fill="#60a5fa" />
                    <path d="M90 90 L125 118 A46 46 0 0 1 88 136 Z" fill="#ef4444" />
                    <path d="M90 90 L88 136 A46 46 0 0 1 54 118 Z" fill="#4f46e5" />
                    <path d="M90 90 L54 118 A46 46 0 0 1 53 66 Z" fill="#10b981" />
                    <circle cx="90" cy="90" r="10" fill="#fff" />
                  </svg>
                  <div className="text-[9px] text-gray-500 space-y-1">
                    <p><span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1" />Financial</p>
                    <p><span className="inline-block w-2 h-2 rounded-full bg-[#d4a759] mr-1" />Knowledge</p>
                    <p><span className="inline-block w-2 h-2 rounded-full bg-sky-400 mr-1" />External</p>
                    <p><span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" />HR</p>
                    <p><span className="inline-block w-2 h-2 rounded-full bg-indigo-600 mr-1" />Admin</p>
                    <p><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />Digital</p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 min-h-[210px]">
                <h3 className="text-[11px] font-semibold text-gray-600 mb-2">Projects</h3>
                <div className="space-y-3 mt-4">
                  {projectBars.map((bar) => (
                    <div key={bar.label}>
                      <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                        <span>{bar.label}</span>
                        <span>{bar.val}%</span>
                      </div>
                      <div className="h-4 rounded-sm bg-gray-200 overflow-hidden">
                        <div className="h-full chart-bar" style={{ width: `${bar.val}%`, backgroundColor: bar.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 min-h-[210px]">
                <h3 className="text-[11px] font-semibold text-gray-600 mb-2">Milestones</h3>
                <svg viewBox="0 0 260 150" className="w-full h-40 chart-svg">
                  <line x1="10" y1="120" x2="250" y2="120" stroke="#e5e7eb" />
                  <polygon points="10,120 70,120 95,80 150,95 190,55 250,70 250,120 10,120" fill="#2563eb" opacity="0.9" />
                  <polygon points="10,120 70,120 100,90 150,60 185,88 250,50 250,120 10,120" fill="#f59e0b" opacity="0.9" />
                  <polyline points="10,120 70,120 100,90 150,60 185,88 250,50" fill="none" stroke="#ef4444" strokeWidth="2" />
                  <text x="12" y="136" fontSize="8" fill="#9ca3af">Jan</text>
                  <text x="60" y="136" fontSize="8" fill="#9ca3af">Feb</text>
                  <text x="108" y="136" fontSize="8" fill="#9ca3af">Mar</text>
                  <text x="156" y="136" fontSize="8" fill="#9ca3af">Apr</text>
                  <text x="204" y="136" fontSize="8" fill="#9ca3af">May</text>
                </svg>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="bg-white rounded-xl p-4 shadow-sm chart-card">
              <h3 className="text-[11px] font-semibold text-gray-600 mb-2">Actual Vs Planned</h3>
              <div className="flex items-center gap-3 mb-2 text-[10px] text-gray-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#d4b06a]" />Actual</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#9b6f2c]" />Planned</span>
              </div>
              <svg viewBox="0 0 500 180" className="w-full h-40 chart-svg">
                {[0, 20, 40, 60, 80, 100].map((v) => (
                  <g key={v}>
                    <line x1="28" x2="492" y1={150 - v * 1.2} y2={150 - v * 1.2} stroke="#eef2f7" />
                    <text x="6" y={154 - v * 1.2} fontSize="8" fill="#9ca3af">{v}</text>
                  </g>
                ))}
                {['J','F','M','A','M','J','J','A','S','O','N','D'].map((m, i) => {
                  const actual = [35, 72, 45, 88, 54, 60, 50, 66, 58, 79, 61, 52][i];
                  const planned = [42, 68, 55, 80, 48, 64, 56, 70, 62, 74, 66, 58][i];
                  const x = 34 + i * 38;
                  return (
                    <g key={m + i}>
                      <rect className="chart-bar" x={x} y={150 - actual * 1.2} width="10" height={actual * 1.2} rx="2" fill="#d4b06a" />
                      <rect className="chart-bar" x={x + 12} y={150 - planned * 1.2} width="10" height={planned * 1.2} rx="2" fill="#9b6f2c" />
                      <text x={x + 10} y="168" textAnchor="middle" fontSize="8" fill="#9ca3af">{m}</text>
                    </g>
                  );
                })}
              </svg>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm chart-card">
              <h3 className="text-[11px] font-semibold text-gray-600 mb-2">Budget Deviation</h3>
              <svg viewBox="0 0 460 160" className="w-full h-36 chart-svg">
                <line x1="10" y1="80" x2="450" y2="80" stroke="#d1d5db" />
                {[-20, -10, 0, 10, 20].map((v) => (
                  <text key={v} x="0" y={80 - v * 2} fontSize="8" fill="#9ca3af">{v}</text>
                ))}
                {[-15, 25, 18, -20, 30, -12, 24, -18, 19, -10, 22, -14].map((v, i) => (
                  <rect key={i} x={18 + i * 36} y={v >= 0 ? 80 - v * 2 : 80} width="14" height={Math.abs(v * 2)} className="chart-bar" fill="#b28a44" rx="2" />
                ))}
                {['J','F','M','A','M','J','J','A','S','O','N','D'].map((m, i) => (
                  <text key={m + i} x={25 + i * 36} y="154" fontSize="8" fill="#9ca3af">{m}</text>
                ))}
              </svg>
            </div>
          </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function ProjectDashboard({ onLogout }: { onLogout: () => void }) {
  const [activeNav, setActiveNav] = useState('Dashboard');
  const [teamTab, setTeamTab] = useState('Workload');
  const [showAddTeamMemberForm, setShowAddTeamMemberForm] = useState(false);
  const [showAddTaskForm, setShowAddTaskForm] = useState(false);
  const [showAddMeetingForm, setShowAddMeetingForm] = useState(false);
  const [showAddDeliverableForm, setShowAddDeliverableForm] = useState(false);
  const [showAddIssueForm, setShowAddIssueForm] = useState(false);
  const navItems = [
    { name: 'Dashboard', icon: <LayoutDashboard size={16} /> },
    { name: 'Projects', icon: <Briefcase size={16} /> },
    { name: 'Team Management', icon: <Users size={16} /> },
    { name: 'Tasks', icon: <CheckSquare size={16} /> },
    { name: 'Issues', icon: <AlertCircle size={16} /> },
    { name: 'Meetings', icon: <Calendar size={16} /> },
    { name: 'Deliverables', icon: <FolderOpen size={16} /> },
  ];
  const overview = [
    { label: 'Meetings', value: 23, color: '#d4a759' },
    { label: 'Projects', value: 4, color: '#34d399' },
    { label: 'Team Members', value: 18, color: '#60a5fa' },
    { label: 'Issues', value: 42, color: '#2563eb' },
    { label: 'Tasks', value: 250, color: '#f6be00' },
    { label: 'Deliverables', value: 53, color: '#9ca3af' },
  ];
  const projectColumns = [
    {
      name: 'To Start',
      accent: '#f6be00',
      cards: [
        { title: 'Project Name', progress: 30, sponsor: 'HR', category: 'Support', approach: 'Traditional', start: 'Aug 16, 2023', end: 'Oct 16, 2023' },
        { title: 'Project Name', progress: 30, sponsor: 'HR', category: 'Support', approach: 'Hybrid', start: 'Aug 16, 2023', end: 'Oct 16, 2023' },
        { title: 'Project Name', progress: 30, sponsor: 'HR', category: 'Support', approach: 'Traditional', start: 'Aug 16, 2023', end: 'Oct 18, 2023' },
      ],
    },
    {
      name: 'On Track',
      accent: '#10b981',
      cards: [
        { title: 'Project Name', progress: 30, sponsor: 'HR', category: 'Support', approach: 'Agile', start: 'Aug 16, 2023', end: 'Oct 16, 2023' },
        { title: 'Project Name', progress: 30, sponsor: 'HR', category: 'Support', approach: 'Agile', start: 'Aug 16, 2023', end: 'Oct 16, 2023' },
        { title: 'Project Name', progress: 30, sponsor: 'HR', category: 'Support', approach: 'Agile', start: 'Aug 16, 2023', end: 'Oct 16, 2023' },
      ],
    },
    {
      name: 'Delayed',
      accent: '#ef4444',
      cards: [
        { title: 'Project Name', progress: 30, sponsor: 'HR', category: 'Support', approach: 'Agile', start: 'Aug 16, 2023', end: 'Oct 16, 2023' },
        { title: 'Project Name', progress: 30, sponsor: 'HR', category: 'Support', approach: 'Agile', start: 'Aug 16, 2023', end: 'Oct 16, 2023' },
        { title: 'Project Name', progress: 30, sponsor: 'HR', category: 'Support', approach: 'Agile', start: 'Aug 16, 2023', end: 'Oct 16, 2023' },
      ],
    },
    {
      name: 'Completed',
      accent: '#2563eb',
      cards: [
        { title: 'Project Name', progress: 100, sponsor: 'HR', category: 'Support', approach: 'Agile', start: 'Aug 16, 2023', end: 'Oct 16, 2023' },
        { title: 'Project Name', progress: 100, sponsor: 'HR', category: 'Support', approach: 'Agile', start: 'Aug 16, 2023', end: 'Oct 16, 2023' },
        { title: 'Project Name', progress: 100, sponsor: 'HR', category: 'Support', approach: 'Agile', start: 'Aug 16, 2023', end: 'Oct 16, 2023' },
      ],
    },
  ];
  const teamTabs = ['Workload', 'Performance', 'Evaluation'];
  const workloadBars = [
    { name: 'WEEK 1', value: 12, color: '#21c784' },
    { name: 'WEEK 2', value: 42, color: '#dc595f' },
    { name: 'WEEK 3', value: 18, color: '#f6be00' },
    { name: 'WEEK 4', value: 50, color: '#385a8f' },
    { name: 'WEEK 5', value: 26, color: '#7848aa' },
    { name: 'WEEK 6', value: 34, color: '#ff7a00' },
    { name: 'WEEK 7', value: 26, color: '#1f5fd6' },
    { name: 'WEEK 8', value: 39, color: '#1f8a56' },
    { name: 'WEEK 9', value: 26, color: '#88afea' },
    { name: 'WEEK 10', value: 42, color: '#9a5f1a' },
    { name: 'WEEK 11', value: 20, color: '#8b73d6' },
  ];
  const teamRows = [
    ['Dany Marko', '14hrs', '20 hrs', '105 hrs', '250 days', '70%', 'Low'],
    ['Traumpy Manu', '14hrs', '20 hrs', '105 hrs', '250 days', '70%', 'High'],
    ['Ali Aljabery', '14hrs', '20 hrs', '105 hrs', '250 days', '70%', 'Optimal'],
    ['Samer Salem', '14hrs', '20 hrs', '105 hrs', '250 days', '70%', 'Low'],
    ['Moemen Ali', '14hrs', '20 hrs', '105 hrs', '250 days', '70%', 'High'],
    ['Omar Adel', '14hrs', '20 hrs', '105 hrs', '250 days', '70%', 'Optimal'],
    ['Sami Safwat', '14hrs', '20 hrs', '105 hrs', '250 days', '70%', 'Low'],
    ['Amer Raji', '14hrs', '20 hrs', '105 hrs', '250 days', '70%', 'High'],
  ];
  const evaluationRows = [
    ['Dany Marko', 'DP Factor Proposal', 'iOS Developer', '5', 'Feb 25,2022'],
    ['Traumpy Manu', 'Tranportation Gov.', 'BA', '3', 'Feb 24,2022'],
    ['Ali Aljabery', 'Apex website', 'QA', '2', 'Feb 22,2022'],
    ['Samer Salem', 'StellarSolutions', 'Assistant', '4', 'Feb 20,2022'],
    ['Moemen Ali', 'StellarSolutions', 'Java Developer', '3', 'Feb 20,2022'],
    ['Omar Adel', 'StellarSolutions', 'Tech Architecture', '5', 'Feb 20,2022'],
    ['Sami Safwat', 'StellarSolutions', 'Java Developer', '5', 'Feb 20,2022'],
    ['Amer Raji', 'StellarSolutions', 'BA', '2', 'Feb 20,2022'],
    ['Ahmed Jalal', 'StellarSolutions', 'Assistant', '3', 'Feb 20,2022'],
  ];
  const performanceMembers = [
    ['Samy Jalal', 'Junior', '30%'],
    ['Jerry Lee', 'Senior', '50%'],
    ['Ramy Hope', 'Junior', '30%'],
    ['Ahmed Ali', 'Senior', '70%'],
    ['Sam Jhon', 'Junior', '30%'],
    ['Jaxx Lee', 'Junior', '30%'],
    ['John Block', 'Senior', '50%'],
    ['Ahmed Ali', 'Senior', '50%'],
  ];
  const taskColumns = [
    { name: 'Future Tasks', color: '#10b981' },
    { name: 'In Progress', color: '#f59e0b' },
    { name: 'Delayed', color: '#ef4444' },
    { name: 'Completed', color: '#2563eb' },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f6fb] text-gray-800">
      <aside className="w-52 bg-white border-r border-gray-100 flex flex-col flex-shrink-0">
        <div className="px-5 py-5 border-b border-gray-100">
          <LogoMark />
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map(({ name, icon }) => (
            <div key={name}>
              <button
                type="button"
                onClick={() => {
                  setActiveNav(name);
                  if (name !== 'Team Management') {
                    setTeamTab('Workload');
                    setShowAddTeamMemberForm(false);
                  }
                  if (name !== 'Tasks') setShowAddTaskForm(false);
                  if (name !== 'Meetings') setShowAddMeetingForm(false);
                  if (name !== 'Deliverables') setShowAddDeliverableForm(false);
                  if (name !== 'Issues') setShowAddIssueForm(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeNav === name ? 'bg-amber-50 text-[#151d5d]' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-700'
                }`}
              >
                <span className="flex items-center gap-3">
                  {icon}
                  {name}
                </span>
                {name === 'Team Management' && <ChevronDown size={12} className={activeNav === 'Team Management' ? 'text-[#151d5d]' : 'text-gray-400'} />}
              </button>
              {name === 'Team Management' && activeNav === 'Team Management' && (
                <div className="ml-9 mt-1 space-y-1">
                  {teamTabs.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setTeamTab(tab)}
                      className={`block w-full text-left px-2 py-1 text-[10px] rounded-md ${
                        teamTab === tab ? 'text-[#151d5d] font-semibold bg-white border border-gray-100' : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
            <ProfileDropdown onLogout={onLogout} />
          </div>
        </header>

        <main className="flex-1 overflow-auto p-5 space-y-4">
          {activeNav === 'Tasks' ? (
            <section className="bg-[#eef0f6] rounded-xl p-4">
              {showAddTaskForm ? (
                <section className="bg-white rounded-xl p-5 shadow-sm max-w-4xl mx-auto">
                  <p className="text-[11px] text-gray-400 mb-4">
                    <button className="underline text-gray-500" onClick={() => setShowAddTaskForm(false)}>Tasks</button>
                    {' > '}Add New Task
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                    {[
                      ['Task Title', 'Enter Task title', false],
                      ['Project Name', 'Select project', true],
                      ['Assign to team members', 'Select member', false],
                      ['Level', 'Select Level', true],
                      ['Task Duration', '', false],
                      ['Sub Task', 'Subtask', false],
                      ['Performance', 'Select', true],
                      ['Score rate', 'If user add', true],
                      ['Cost', '', false],
                      ['Task Status', 'If user add', true],
                    ].map(([label, placeholder, selectField]) => (
                      <label key={String(label)} className="block">
                        <span className="text-[11px] text-gray-500 mb-1 block">{String(label)}</span>
                        {label === 'Task Duration' ? (
                          <div className="flex items-center gap-2">
                            <button className="h-9 px-3 rounded-md border border-gray-200 text-[10px] text-gray-600">2025/01/08</button>
                            <button className="h-9 px-3 rounded-md border border-gray-200 text-[10px] text-gray-600">03/20/2025</button>
                            <span className="text-[10px] text-gray-400">2 days</span>
                          </div>
                        ) : selectField ? (
                          <select className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-xs text-gray-500">
                            <option>{String(placeholder)}</option>
                          </select>
                        ) : (
                          <input className="w-full h-9 rounded-md border border-gray-200 px-3 text-xs text-gray-600" placeholder={String(placeholder)} />
                        )}
                      </label>
                    ))}
                  </div>
                  <label className="block mt-3">
                    <span className="text-[11px] text-gray-500 mb-1 block">Description</span>
                    <textarea className="w-full h-16 rounded-md border border-gray-200 px-3 py-2 text-xs text-gray-600 resize-none" placeholder="Description..." />
                  </label>
                  <label className="block mt-3">
                    <span className="text-[11px] text-gray-500 mb-1 block">Attachment</span>
                    <button className="w-full h-16 rounded-md border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-400">
                      <span className="font-semibold text-gray-600">Choose a file</span> or drag it here
                    </button>
                  </label>
                  <div className="mt-4 flex justify-end gap-3">
                    <button type="button" onClick={() => setShowAddTaskForm(false)} className="h-8 px-6 rounded-md border border-[#b28a44] text-[#b28a44] text-xs">Cancel</button>
                    <button className="h-8 px-6 rounded-md bg-[#b28a44] text-white text-xs">Assign Task</button>
                  </div>
                </section>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-5 flex-wrap">
                      <h2 className="text-3xl font-bold text-[#2f3150]">Tasks</h2>
                      {[
                        ['Due date', 'Select date'],
                        ['Assign to', 'All'],
                        ['Project', 'All'],
                        ['Status', 'All'],
                      ].map(([label, value]) => (
                        <label key={label} className="flex items-center gap-2 text-xs text-gray-500">
                          <span>{label}</span>
                          <select className="h-8 rounded-md border border-gray-200 bg-white px-2 text-[11px] text-gray-500">
                            <option>{value}</option>
                          </select>
                        </label>
                      ))}
                    </div>
                    <button type="button" onClick={() => setShowAddTaskForm(true)} className="h-9 px-5 rounded-md bg-[#b28a44] text-white text-xs font-semibold">+ New Task</button>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
                    {taskColumns.map((column) => (
                      <div key={column.name} className="space-y-3">
                        <div className="bg-white rounded-xl border border-gray-100 px-3 py-2 flex items-center justify-between">
                          <p className="text-xl font-semibold text-[#2f3150]">{column.name}</p>
                          <button className="text-[10px] text-[#b28a44]">View All</button>
                        </div>
                        {[0, 1, 2].map((idx) => (
                          <div key={`${column.name}-${idx}`} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold" style={{ color: column.color }}>Task Name</p>
                              <span className="px-2 py-0.5 rounded border border-gray-200 text-[9px] text-gray-500">Project Name</span>
                            </div>
                            <p className="text-[11px] text-[#4b5574] mt-1">auditing information architecture</p>
                            <p className="text-[10px] text-gray-400">Create content for pieceland App</p>
                            <p className="text-[10px] mt-2" style={{ color: column.color }}>Sub.Task title</p>
                            <div className="mt-1 flex items-center justify-between text-[10px] text-gray-400">
                              <span className="flex items-center gap-1"><Calendar size={10} /> Due Date</span>
                              <span className="flex items-center gap-1"><Clock size={10} /> {column.name === 'Delayed' ? '5 hrs' : '5 days'}</span>
                            </div>
                            <div className="mt-1 flex items-center justify-between text-[10px] text-gray-400">
                              <span>Aug 20, 2021</span>
                              <button className="w-5 h-5 rounded border border-[#d8c9ad] text-[#b28a44] text-[10px]">↗</button>
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                              <div className="w-4 h-4 rounded-full bg-orange-200 text-[8px] text-orange-700 flex items-center justify-center">E</div>
                              <p className="text-[9px] text-gray-400">11 file</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          ) : activeNav === 'Meetings' ? (
            <section className="bg-[#eef0f6] rounded-xl p-4">
              {showAddMeetingForm ? (
                <section className="bg-white rounded-xl p-5 shadow-sm max-w-5xl mx-auto">
                  <p className="text-[11px] text-gray-400 mb-4">
                    <button className="underline text-gray-500" onClick={() => setShowAddMeetingForm(false)}>Calendar</button>
                    {' > '}Add New Meeting
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3">
                    {[
                      ['Meeting Title *', 'Enter Meeting Title', false],
                      ['Department', 'Select', true],
                      ['Meeting Category *', 'Select Category', true],
                      ['Project Name', 'Select Project Category', true],
                      ['Vendor Name', 'Select Vendor Name', true],
                      ['Project Manager', 'Auto Fetch', false],
                      ['Invite member', 'Select member', true],
                    ].map(([label, placeholder, selectField]) => (
                      <label key={String(label)} className="block">
                        <span className="text-[11px] text-gray-500 mb-1 block">{String(label)}</span>
                        {selectField ? (
                          <select className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-xs text-gray-500">
                            <option>{String(placeholder)}</option>
                          </select>
                        ) : (
                          <input className="w-full h-9 rounded-md border border-gray-200 px-3 text-xs text-gray-600" placeholder={String(placeholder)} />
                        )}
                      </label>
                    ))}
                    <label className="block">
                      <span className="text-[11px] text-gray-500 mb-1 block">Meeting Date *</span>
                      <input className="w-full h-9 rounded-md border border-gray-200 px-3 text-xs text-gray-600" placeholder="Select Date" />
                    </label>
                    <label className="block">
                      <span className="text-[11px] text-gray-500 mb-1 block">Start Time*</span>
                      <input className="w-full h-9 rounded-md border border-gray-200 px-3 text-xs text-gray-600" placeholder="--:--" />
                    </label>
                    <label className="block">
                      <span className="text-[11px] text-gray-500 mb-1 block">End Time*</span>
                      <input className="w-full h-9 rounded-md border border-gray-200 px-3 text-xs text-gray-600" placeholder="--:--" />
                    </label>
                  </div>
                  <label className="block mt-3">
                    <span className="text-[11px] text-gray-500 mb-1 block">Meeting Location</span>
                    <input className="w-full h-9 rounded-md border border-gray-200 px-3 text-xs text-gray-600" placeholder="Enter Meeting Location" />
                  </label>
                  <label className="block mt-3">
                    <span className="text-[11px] text-gray-500 mb-1 block">Meeting Agenda</span>
                    <textarea className="w-full h-20 rounded-md border border-gray-200 px-3 py-2 text-xs text-gray-600 resize-none" placeholder="Agenda..." />
                  </label>
                  <div className="mt-4 flex justify-end gap-3">
                    <button type="button" onClick={() => setShowAddMeetingForm(false)} className="h-8 px-6 rounded-md border border-[#b28a44] text-[#b28a44] text-xs">Cancel</button>
                    <button className="h-8 px-6 rounded-md bg-[#b28a44] text-white text-xs">Add to Calendar</button>
                  </div>
                </section>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-8">
                      <h2 className="text-3xl font-bold text-[#2f3150]">Meeting</h2>
                      <div className="flex items-center gap-3 text-xs">
                        <label className="text-gray-500 flex items-center gap-2">
                          <span>Project Name</span>
                          <select className="h-8 rounded-md border border-gray-200 bg-white px-2 text-[11px] text-gray-500">
                            <option>All</option>
                          </select>
                        </label>
                        <button className="h-7 px-3 rounded-full border border-[#d8c9ad] text-[10px] text-[#b28a44] bg-white">Today</button>
                        <button className="h-7 px-3 rounded-full border border-gray-200 text-[10px] text-gray-500 bg-white">June, 20,2022</button>
                        <button className="h-8 px-4 rounded-md border border-[#d8c9ad] text-[11px] text-[#b28a44] bg-white">MOM</button>
                      </div>
                    </div>
                    <button type="button" onClick={() => setShowAddMeetingForm(true)} className="h-9 px-4 rounded-md bg-[#b28a44] text-white text-xs font-semibold">+ New Meeting</button>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-[1fr_240px] gap-4">
                    <section className="bg-white rounded-xl p-3">
                      <div className="grid grid-cols-[44px_1fr]">
                        <div className="text-[10px] text-gray-300 space-y-8 pt-2">
                          {['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'].map((time) => (
                            <p key={time}>{time}</p>
                          ))}
                        </div>
                        <div className="relative h-[410px] rounded-lg border border-gray-100 bg-[repeating-linear-gradient(to_right,#f6f7fb_0,#f6f7fb_1px,transparent_1px,transparent_16.66%)]">
                          {[15, 73, 139, 205, 271, 337].map((x) => (
                            <div key={x} className="absolute top-0 bottom-0 w-px bg-gray-100" style={{ left: x }} />
                          ))}
                          {[
                            { title: 'Meeting Title 1', top: 56, left: 54, color: '#17c983' },
                            { title: 'Meeting Title 2', top: 220, left: 2, color: '#2563eb' },
                            { title: 'Meeting Title 3', top: 140, left: 180, color: '#f6be00' },
                            { title: 'Meeting Title 4', top: 258, left: 275, color: '#2563eb' },
                            { title: 'Meeting Title 5', top: 96, left: 398, color: '#21c784' },
                            { title: 'Meeting Title 6', top: 140, left: 340, color: '#d35b66' },
                            { title: 'Meeting Title 8', top: 304, left: 331, color: '#f6be00' },
                            { title: 'New', top: 312, left: 78, color: '#474d7f' },
                          ].map((item) => (
                            <div key={item.title + item.top} className="absolute h-8 rounded-full px-4 text-white text-[9px] font-semibold flex items-center" style={{ top: item.top, left: item.left, backgroundColor: item.color }}>
                              {item.title}
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>

                    <section className="bg-white rounded-xl p-3">
                      <p className="text-[9px] text-gray-400 uppercase">Current Month</p>
                      <h3 className="text-sm font-semibold text-[#2f3150] mb-2">Scheduled Meetings</h3>
                      <div className="space-y-2">
                        {[
                          ['Standup', '20 HRS', '11', '#c9f4e4', '#138f6f'],
                          ['Requirements Gathering', '12 HRS', '12', '#e9edff', '#4c64bf'],
                          ['Technical Discussion', '22 HRS', '10', '#f7eed8', '#b8872e'],
                          ['Brain Storm Session', '24 HRS', '12', '#eef0ff', '#4d5bb7'],
                          ['Training Sessions', '10 HRS', '5', '#fdf4dd', '#b4882a'],
                          ['Quality Assurance', '22 HRS', '2', '#ffe6e8', '#cb4e59'],
                          ['Documents Review', '20 HRS', '3', '#e9e4ff', '#6958bb'],
                          ['Technical Discussion', '12 HRS', '4', '#e2f7ef', '#2f9879'],
                          ['Interview', '22 HRS', '8', '#ffe6e6', '#ca5454'],
                          ['Others', '22 HRS', '6', '#f5eedf', '#9a7a35'],
                        ].map(([name, hrs, count, bg, text]) => (
                          <div key={String(name) + String(count)} className="rounded-full px-3 py-1.5 flex items-center justify-between" style={{ backgroundColor: String(bg) }}>
                            <div>
                              <p className="text-[10px] font-semibold" style={{ color: String(text) }}>{name}</p>
                              <p className="text-[9px] text-gray-400">{hrs}</p>
                            </div>
                            <span className="w-5 h-5 rounded-full bg-white/80 text-[10px] font-semibold flex items-center justify-center" style={{ color: String(text) }}>{count}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                </>
              )}
            </section>
          ) : activeNav === 'Deliverables' ? (
            <section className="bg-[#eef0f6] rounded-xl p-4">
              {showAddDeliverableForm ? (
                <section className="bg-white rounded-xl p-5 shadow-sm max-w-5xl mx-auto">
                  <p className="text-[11px] text-gray-400 mb-4">
                    <button className="underline text-gray-500" onClick={() => setShowAddDeliverableForm(false)}>Deliverables</button>
                    {' > '}Add New Deliverables
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 mb-4">
                    {[
                      ['Project Name', 'Select Project Name', true],
                      ['Project Category', 'Select Project Category', true],
                      ['Project Manager', 'Select Project Manager', true],
                      ['Project Goal', 'Enter Project Goal', false],
                    ].map(([label, placeholder, selectField]) => (
                      <label key={String(label)} className="block">
                        <span className="text-[11px] text-gray-500 mb-1 block">{String(label)}</span>
                        {selectField ? (
                          <select className="w-full h-10 rounded-md border border-gray-200 bg-white px-3 text-xs text-gray-500">
                            <option>{String(placeholder)}</option>
                          </select>
                        ) : (
                          <input className="w-full h-10 rounded-md border border-gray-200 px-3 text-xs text-gray-600" placeholder={String(placeholder)} />
                        )}
                      </label>
                    ))}
                  </div>
                  <p className="text-[11px] font-semibold text-gray-600 mb-2">The deliverables include:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                    {[
                      'Hardware', 'Licenses', 'Phase1', 'Phase2', 'Design', 'Business Requirements', 'Design Document', 'User Manual Document',
                      'UAT', 'Production Link', 'Training', 'Knowledge Transfer', 'Professional Services', 'Consultation', 'Scope Document', 'Report',
                    ].map((item, idx) => (
                      <label key={item} className="flex items-center gap-2 text-xs text-gray-600">
                        <input type="checkbox" defaultChecked={[0, 2, 4, 8, 10, 12].includes(idx)} className="rounded border-gray-300 text-[#b28a44] focus:ring-[#b28a44]" />
                        {item}
                      </label>
                    ))}
                  </div>
                  <label className="block">
                    <span className="text-[11px] text-gray-500 mb-1 block">Notes</span>
                    <textarea className="w-full h-20 rounded-md border border-gray-200 px-3 py-2 text-xs text-gray-600 resize-none" placeholder="Notes..." />
                  </label>
                  <div className="mt-5 flex justify-end gap-3">
                    <button type="button" onClick={() => setShowAddDeliverableForm(false)} className="h-9 px-7 rounded-md border border-[#b28a44] text-[#b28a44] text-xs font-semibold">Cancel</button>
                    <button className="h-9 px-7 rounded-md bg-[#b28a44] text-white text-xs font-semibold">+ Save</button>
                  </div>
                </section>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-3xl font-bold text-[#2f3150]">Display List Of Deliverables</h2>
                    <button type="button" onClick={() => setShowAddDeliverableForm(true)} className="h-9 px-4 rounded-md bg-[#b28a44] text-white text-xs font-semibold">+ New List</button>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-[1fr_250px] gap-4">
                    <section className="bg-white rounded-xl shadow-sm overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-100">
                          <tr className="text-[10px] text-gray-400 text-left">
                            <th className="px-3 py-2">Project Name</th>
                            <th className="px-3 py-2">Project Sponsor</th>
                            <th className="px-3 py-2">Deliverables List</th>
                            <th className="px-3 py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            ['DP Factor', 'HR', 'Design, Development, Training, Report, Document', 'COMPLETED'],
                            ['CodeTech', 'Sales', 'Document, Report, Attachments, Project Plan', 'SLIGHTLY DELAYED'],
                            ['Ex-Process', 'Operation', 'Document, Report, Attachments, Hardware', 'ON TRACK'],
                            ['Scaling', 'Marketing', 'Design, Report, License, Training, Project Plan', 'DELAYED'],
                            ['Digital Retail', 'IT', 'UAT link, Production Link, Attachments, Knowledge Transfer', 'DELAYED'],
                            ['DP Factor', 'HR', 'Design, Development, Training, Report, Document', 'COMPLETED'],
                            ['CodeTech', 'Sales', 'Document, Report, Attachments, Project Plan', 'SLIGHTLY DELAYED'],
                            ['Ex-Process', 'Operation', 'Document, Report, Attachments, Hardware', 'ON TRACK'],
                            ['Scaling', 'Marketing', 'Design, Report, License, Training, Project Plan', 'DELAYED'],
                            ['Digital Retail', 'IT', 'UAT link, Production Link, Attachments, Knowledge Transfer', 'DELAYED'],
                          ].map((row, idx) => (
                            <tr key={idx} className="border-b border-gray-100 text-[10px] text-gray-700">
                              <td className="px-3 py-2 text-indigo-700 underline">{row[0]}</td>
                              <td className="px-3 py-2">{row[1]}</td>
                              <td className="px-3 py-2">{row[2]}</td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-0.5 rounded-full text-[8px] font-semibold ${
                                  row[3] === 'COMPLETED'
                                    ? 'bg-blue-100 text-blue-700'
                                    : row[3] === 'ON TRACK'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : row[3] === 'SLIGHTLY DELAYED'
                                        ? 'bg-amber-100 text-amber-700'
                                        : 'bg-rose-100 text-rose-700'
                                }`}
                                >
                                  {row[3]}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="px-3 py-3 text-xs text-gray-500 flex items-center justify-end gap-6">
                        <span>1-10 of 15</span>
                        <div className="flex items-center gap-2 text-lg leading-none">
                          <button className="text-gray-400">{'<'}</button>
                          <button className="text-gray-400">{'>'}</button>
                        </div>
                      </div>
                    </section>

                    <section className="space-y-3">
                      <div className="bg-white rounded-xl p-3 shadow-sm">
                        <h3 className="text-2xl font-semibold text-[#2f3150] mb-2">Deliverables Status</h3>
                        <svg viewBox="0 0 230 120" className="w-full h-28 chart-svg">
                          {[0, 20, 40, 60].map((v) => (
                            <g key={v}>
                              <line x1="16" x2="220" y1={92 - v} y2={92 - v} stroke="#eef2f7" />
                              <text x="4" y={95 - v} fontSize="7" fill="#9ca3af">{v}</text>
                            </g>
                          ))}
                          <polygon points="16,48 62,62 102,30 154,50 220,20 220,92 16,92" fill="#ef4444" opacity="0.9" />
                          <polygon points="16,42 62,38 102,28 154,58 220,32 220,92 16,92" fill="#2563eb" opacity="0.9" />
                          <polygon points="16,66 62,40 102,58 154,26 220,58 220,92 16,92" fill="#f6be00" opacity="0.95" />
                          {['Jan', 'Feb', 'Mar', 'Apr', 'May'].map((m, i) => (
                            <text key={m} x={24 + i * 44} y="106" fontSize="7" fill="#9ca3af">{m}</text>
                          ))}
                          <circle cx="24" cy="114" r="2.4" fill="#ef4444" />
                          <text x="30" y="116" fontSize="7" fill="#6b7280">Total</text>
                          <circle cx="68" cy="114" r="2.4" fill="#2563eb" />
                          <text x="74" y="116" fontSize="7" fill="#6b7280">Delivered</text>
                          <circle cx="130" cy="114" r="2.4" fill="#f6be00" />
                          <text x="136" y="116" fontSize="7" fill="#6b7280">To Be Delivered</text>
                        </svg>
                      </div>

                      <div className="bg-white rounded-xl p-3 shadow-sm">
                        <h3 className="text-2xl font-semibold text-[#2f3150] mb-2">Deliverables via Projects</h3>
                        <svg viewBox="0 0 230 140" className="w-full h-32 chart-svg">
                          {[0, 10, 20, 30, 40, 50].map((v) => (
                            <g key={v}>
                              <line x1="24" x2="220" y1={108 - v * 1.8} y2={108 - v * 1.8} stroke="#eef2f7" />
                              <text x="6" y={111 - v * 1.8} fontSize="7" fill="#9ca3af">{v}</text>
                            </g>
                          ))}
                          {[
                            ['Corporate', 14, '#6b7280'],
                            ['Global Access', 36, '#d4a759'],
                            ['Insight', 22, '#b8872e'],
                            ['Project A', 42, '#6ea3ef'],
                            ['Enjaz Management', 28, '#d35b66'],
                          ].map(([name, val, color], i) => (
                            <g key={String(name)}>
                              <rect x={34 + i * 36} y={108 - Number(val) * 1.8} width="12" height={Number(val) * 1.8} rx="3" className="chart-bar" fill={String(color)} />
                              <text x={38 + i * 36} y="126" textAnchor="middle" fontSize="6.5" fill="#9ca3af" transform={`rotate(-60 ${38 + i * 36} 126)`}>{name}</text>
                            </g>
                          ))}
                          <text x="212" y="129" fontSize="7" fill="#9ca3af">Projects</text>
                        </svg>
                      </div>
                    </section>
                  </div>
                </>
              )}
            </section>
          ) : activeNav === 'Issues' ? (
            <section className="bg-[#eef0f6] rounded-xl p-4">
              {showAddIssueForm ? (
                <section className="bg-white rounded-xl p-5 shadow-sm max-w-4xl mx-auto">
                  <p className="text-[11px] text-gray-400 mb-4">
                    <button className="underline text-gray-500" onClick={() => setShowAddIssueForm(false)}>Issue</button>
                    {' > '}Add New Issue
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                    {[
                      ['Issue Title', 'Enter Issue Title', false],
                      ['Issue owner', 'Select', true],
                      ['Issue Severity', 'Low', true],
                      ['Assign to team member', 'Select member', true],
                      ['Project Name', '', false],
                      ['Project Sponsor', 'Select', true],
                      ['Issue Status', 'Solved', true],
                      ['Raised Issue', 'Select', true],
                    ].map(([label, placeholder, selectField]) => (
                      <label key={String(label)} className="block">
                        <span className="text-[11px] text-gray-500 mb-1 block">{String(label)}</span>
                        {selectField ? (
                          <select className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-xs text-gray-500">
                            <option>{String(placeholder)}</option>
                          </select>
                        ) : (
                          <input className="w-full h-9 rounded-md border border-gray-200 px-3 text-xs text-gray-600" placeholder={String(placeholder)} />
                        )}
                      </label>
                    ))}
                  </div>
                  <label className="block mt-3">
                    <span className="text-[11px] text-gray-500 mb-1 block">Progress</span>
                    <textarea className="w-full h-14 rounded-md border border-gray-200 px-3 py-2 text-xs text-gray-600 resize-none" />
                  </label>
                  <label className="block mt-3">
                    <span className="text-[11px] text-gray-500 mb-1 block">Issue Response</span>
                    <textarea className="w-full h-14 rounded-md border border-gray-200 px-3 py-2 text-xs text-gray-600 resize-none" />
                  </label>
                  <label className="block mt-3">
                    <span className="text-[11px] text-gray-500 mb-1 block">Issue Description</span>
                    <textarea className="w-full h-14 rounded-md border border-gray-200 px-3 py-2 text-xs text-gray-600 resize-none" />
                  </label>
                  <div className="mt-4 flex justify-end gap-3">
                    <button type="button" onClick={() => setShowAddIssueForm(false)} className="h-8 px-6 rounded-md border border-[#b28a44] text-[#b28a44] text-xs">Cancel</button>
                    <button className="h-8 px-6 rounded-md bg-[#b28a44] text-white text-xs">Save</button>
                  </div>
                </section>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-3xl font-bold text-[#2f3150]">Issue Tracking Dashboard</h2>
                    <button type="button" onClick={() => setShowAddIssueForm(true)} className="h-9 px-4 rounded-md bg-[#b28a44] text-white text-xs font-semibold">+ Create Issue</button>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap mb-4">
                    {[
                      ['Project', 'All'],
                      ['Impacted Area', 'All'],
                      ['Issue Owner', 'All'],
                      ['Severity', 'All'],
                      ['Date', 'Select'],
                      ['Status', 'All'],
                    ].map(([label, option]) => (
                      <label key={label} className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{label}</span>
                        <select className="h-8 rounded-md border border-gray-200 bg-white px-2 text-[11px] text-gray-500">
                          <option>{option}</option>
                        </select>
                      </label>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    {[
                      ['Total Issues', '104', 'border-[#d4a759]'],
                      ['Opened Issues', '108', 'border-[#ef4444]'],
                      ['Solved Issues', '71', 'border-[#2563eb]'],
                    ].map(([label, value, border]) => (
                      <div key={String(label)} className={`bg-white rounded-2xl border-2 ${border} p-4 text-center`}>
                        <p className="text-xs text-gray-400">{label}</p>
                        <p className="text-5xl font-bold text-[#2f3150] mt-1">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-white rounded-xl p-3 shadow-sm">
                      <h3 className="text-2xl font-semibold text-[#2f3150] mb-2">Issues Severity</h3>
                      <svg viewBox="0 0 220 140" className="w-full h-32 chart-svg">
                        <circle cx="102" cy="72" r="50" fill="#f3f4f6" />
                        <path d="M102 72 L102 22 A50 50 0 0 1 150 94 Z" fill="#e77070" />
                        <path d="M102 72 L150 94 A50 50 0 0 1 62 104 Z" fill="#efb4b8" />
                        <path d="M102 72 L62 104 A50 50 0 0 1 80 26 Z" fill="#d69ea4" />
                        <circle cx="102" cy="72" r="6" fill="#fff" />
                        <text x="150" y="26" fontSize="8" fill="#ef6b6b">27</text>
                        <text x="150" y="34" fontSize="7" fill="#ef6b6b">Medium</text>
                        <text x="162" y="95" fontSize="8" fill="#ef6b6b">21</text>
                        <text x="162" y="103" fontSize="7" fill="#ef6b6b">High</text>
                        <text x="34" y="102" fontSize="8" fill="#d4a759">46</text>
                        <text x="34" y="110" fontSize="7" fill="#d4a759">Low</text>
                      </svg>
                    </div>

                    <div className="bg-white rounded-xl p-3 shadow-sm">
                      <h3 className="text-2xl font-semibold text-[#2f3150] mb-2">Issues vs Projects</h3>
                      <svg viewBox="0 0 220 140" className="w-full h-32 chart-svg">
                        {[0, 10, 20, 30, 40, 50].map((v) => (
                          <g key={v}>
                            <line x1="24" x2="210" y1={108 - v * 1.6} y2={108 - v * 1.6} stroke="#eef2f7" />
                            <text x="6" y={111 - v * 1.6} fontSize="7" fill="#9ca3af">{v}</text>
                          </g>
                        ))}
                        {[
                          ['Enjaz Management', 14, '#6b7280'],
                          ['Global Access', 42, '#d4a759'],
                          ['DP Factor', 24, '#b8872e'],
                          ['Ex Process', 46, '#6ea3ef'],
                          ['Digital Retail', 31, '#d35b66'],
                        ].map(([name, val, color], i) => (
                          <g key={String(name)}>
                            <rect x={34 + i * 34} y={108 - Number(val) * 1.6} width="12" height={Number(val) * 1.6} rx="3" className="chart-bar" fill={String(color)} />
                            <text x={40 + i * 34} y="126" textAnchor="middle" fontSize="6.5" fill="#9ca3af" transform={`rotate(-60 ${40 + i * 34} 126)`}>{name}</text>
                          </g>
                        ))}
                      </svg>
                    </div>

                    <div className="bg-white rounded-xl p-3 shadow-sm">
                      <h3 className="text-2xl font-semibold text-[#2f3150] mb-2">Issues Progress</h3>
                      <svg viewBox="0 0 220 140" className="w-full h-32 chart-svg">
                        <circle cx="108" cy="74" r="50" fill="#eef2f7" />
                        <path d="M108 74 L108 24 A50 50 0 1 1 70 106 Z" fill="#dc4f56" />
                        <path d="M108 74 L70 106 A50 50 0 0 1 128 26 Z" fill="#1f67e0" />
                        <circle cx="108" cy="74" r="6" fill="#fff" />
                        <text x="155" y="37" fontSize="8" fill="#1f67e0">20</text>
                        <text x="155" y="45" fontSize="7" fill="#1f67e0">Resolved</text>
                        <text x="54" y="114" fontSize="8" fill="#dc4f56">80</text>
                        <text x="40" y="122" fontSize="7" fill="#dc4f56">Opened</text>
                      </svg>
                    </div>
                  </div>

                  <section className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr className="text-[10px] text-gray-400 text-left">
                          <th className="px-3 py-2">Issue ID</th>
                          <th className="px-3 py-2">Issue Title</th>
                          <th className="px-3 py-2">Severity</th>
                          <th className="px-3 py-2">Project Name</th>
                          <th className="px-3 py-2">Project Sponsor</th>
                          <th className="px-3 py-2">Raised by</th>
                          <th className="px-3 py-2">Issue owner</th>
                          <th className="px-3 py-2">Issue description</th>
                          <th className="px-3 py-2">Issue response</th>
                          <th className="px-3 py-2">Impacted areas</th>
                          <th className="px-3 py-2">Progress</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Date Raised</th>
                          <th className="px-3 py-2">Date Resolved</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ['1133', 'DP Factor', 'High', 'XX', 'HR', 'Ali', 'ERP Team', 'Text', 'Text', 'Schedule', 'Text', 'IN-QUEUE'],
                          ['1133', 'Code Tech', 'Medium', 'XX', 'Legal', 'Omar', 'Yousef', 'Text', 'Text', 'Scope', 'Text', 'OPENED'],
                          ['1133', 'Ex Process', 'Medium', 'YY', 'Sales', 'Waleed', 'Wael', 'Text', 'Text', 'Quality', 'Text', 'OPENED'],
                          ['1133', 'Scaling', 'Low', 'YY', 'IT', 'Amr', 'ERP Team', 'Text', 'Text', 'Resources', 'Text', 'IN-QUEUE'],
                          ['1133', 'DP Factor', 'High', 'ZZ', 'IT', 'Fahmi', 'Self', 'Text', 'Text', 'Budget', 'Text', 'IN-QUEUE'],
                        ].map((row, idx) => (
                          <tr key={idx} className="border-b border-gray-100 text-[10px] text-gray-700">
                            <td className="px-3 py-2">{row[0]}</td>
                            <td className="px-3 py-2 text-indigo-700 underline">{row[1]}</td>
                            <td className="px-3 py-2">{row[2]}</td>
                            <td className="px-3 py-2">{row[3]}</td>
                            <td className="px-3 py-2">{row[4]}</td>
                            <td className="px-3 py-2">{row[5]}</td>
                            <td className="px-3 py-2">{row[6]}</td>
                            <td className="px-3 py-2">{row[7]}</td>
                            <td className="px-3 py-2">{row[8]}</td>
                            <td className="px-3 py-2">{row[9]}</td>
                            <td className="px-3 py-2">{row[10]}</td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-0.5 rounded-full text-[8px] font-semibold ${row[11] === 'OPENED' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`}>
                                {row[11]}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <p>Date Raised</p>
                              <p className="text-gray-400">Feb 09, 2024</p>
                            </td>
                            <td className="px-3 py-2">
                              <p>Date Resolved</p>
                              <p className="text-gray-400">May 24, 2024</p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                </>
              )}
            </section>
          ) : activeNav === 'Team Management' ? (
            <section className="bg-[#eef0f6] rounded-xl p-4">
              {showAddTeamMemberForm ? (
                <section className="bg-white rounded-xl p-5 shadow-sm max-w-5xl mx-auto">
                  <p className="text-[11px] text-gray-400 mb-4">
                    <button className="underline text-gray-500" onClick={() => setShowAddTeamMemberForm(false)}>Team Member</button>
                    {' > '}Add New Team Member
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 mb-4">
                    {[
                      ['Full Name', 'Enter First Name'],
                      ['Specialize', 'Select Specialize'],
                      ['Project Category', 'Select Project Category'],
                      ['Project Name', 'Select Project Name'],
                      ['KPI', 'Enter KPI'],
                      ['Score', 'Select score rate'],
                    ].map(([label, placeholder], i) => (
                      <label key={label} className="block">
                        <span className="text-[11px] text-gray-500 mb-1 block">{label}</span>
                        {i % 2 === 1 || label.includes('Category') || label === 'Project Name' || label === 'Score' ? (
                          <select className="w-full h-10 rounded-md border border-gray-200 bg-white px-3 text-xs text-gray-500">
                            <option>{placeholder}</option>
                          </select>
                        ) : (
                          <input className="w-full h-10 rounded-md border border-gray-200 px-3 text-xs text-gray-600" placeholder={placeholder} />
                        )}
                      </label>
                    ))}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-[11px] text-gray-500 mb-1">Photo</p>
                      <button className="w-full h-20 rounded-md border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-400">
                        <span className="font-semibold text-gray-600">Choose a file</span> or drag it here
                      </button>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-500 mb-1">Resume</p>
                      <button className="w-full h-20 rounded-md border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-400">
                        <span className="font-semibold text-gray-600">Choose a file</span> or drag it here
                      </button>
                    </div>
                  </div>
                  <div className="mt-5 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowAddTeamMemberForm(false)}
                      className="h-9 px-7 rounded-md border border-[#b28a44] text-[#b28a44] text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button className="h-9 px-7 rounded-md bg-[#b28a44] text-white text-xs font-semibold">+ Save</button>
                  </div>
                </section>
              ) : (
                <>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-3xl font-bold text-[#2f3150]">Team Management Dashboard</h2>
                <button
                  type="button"
                  onClick={() => setShowAddTeamMemberForm(true)}
                  className="h-8 px-3 rounded-md bg-[#b28a44] text-white text-xs font-semibold"
                >
                  + Add New Member
                </button>
              </div>

              <section className="bg-white rounded-xl p-4 shadow-sm mb-4">
                <div className="grid grid-cols-1 xl:grid-cols-[1fr_220px] gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-[#2f3150]">{teamTab === 'Evaluation' ? 'Team Evaluation' : 'Team Workload'}</h3>
                      <button className="text-[10px] text-gray-400">{teamTab === 'Workload' ? 'Day/week/months' : teamTab}</button>
                    </div>
                    {teamTab === 'Performance' ? (
                      <svg viewBox="0 0 640 240" className="w-full h-44 chart-svg">
                        {[0, 2, 4, 6, 8, 10].map((v) => (
                          <g key={v}>
                            <line x1="40" y1={194 - v * 16} x2="622" y2={194 - v * 16} stroke="#ecedf2" />
                            <text x="28" y={197 - v * 16} fontSize="9" fill="#a1a1aa">0.{v}</text>
                          </g>
                        ))}
                        {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', '11', '12'].map((m, i) => (
                          <text key={m} x={52 + i * 48} y="214" fontSize="8" fill="#9ca3af">{m}</text>
                        ))}
                        {[
                          ['#ef4444', [140, 96, 152, 126, 118, 170, 124, 166, 154, 136, 172, 94]],
                          ['#2563eb', [108, 164, 102, 170, 172, 120, 116, 168, 92, 104, 170, 128]],
                        ].map(([stroke, values]) => (
                          <polyline
                            key={String(stroke)}
                            fill="none"
                            stroke={String(stroke)}
                            strokeWidth="2"
                            points={(values as number[]).map((v, i) => `${52 + i * 48},${v}`).join(' ')}
                          />
                        ))}
                      </svg>
                    ) : (
                      <svg viewBox="0 0 640 240" className="w-full h-44 chart-svg">
                        {[0, 10, 20, 30, 40, 50].map((v) => (
                          <g key={v}>
                            <line x1="46" y1={190 - v * 3} x2="620" y2={190 - v * 3} stroke="#ecedf2" />
                            <text x="36" y={194 - v * 3} fontSize="9" fill="#a1a1aa">{v}</text>
                          </g>
                        ))}
                        {workloadBars.map((bar) => {
                          const x = 56 + Number(bar.name.split(' ')[1] ?? 1 - 1) * 48;
                          const h = bar.value * 3;
                          return (
                            <g key={bar.name}>
                              <rect x={x} y={190 - h} width="24" height={h} rx="4" className="chart-bar" fill={bar.color} />
                              <text x={x + 12} y="210" fontSize="8" textAnchor="middle" fill="#6b7280" transform={`rotate(-90 ${x + 12} 210)`}>{bar.name}</text>
                            </g>
                          );
                        })}
                      </svg>
                    )}
                  </div>
                  <div className="rounded-xl border border-gray-100 p-3">
                    <h3 className="text-sm font-semibold text-[#2f3150] mb-2">{teamTab === 'Evaluation' ? 'Evaluation Category' : 'Utilization Category'}</h3>
                    <DonutChart
                      className="w-full h-40 chart-svg"
                      ringWidth={46}
                      slices={[
                        { label: teamTab === 'Evaluation' ? 'Qualified' : teamTab === 'Performance' ? 'Strong' : 'Optimal', value: 27, color: '#1667de' },
                        { label: teamTab === 'Evaluation' ? 'Weak' : teamTab === 'Performance' ? 'Weak' : 'High', value: 21, color: '#d3525a' },
                        { label: teamTab === 'Evaluation' ? 'Medium' : teamTab === 'Performance' ? 'Avg' : 'Low', value: 46, color: '#3b3a80' },
                      ]}
                    />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-[#2f3150] mt-3 mb-3">
                  {teamTab === 'Evaluation' ? 'Team Member Evaluation' : teamTab === 'Performance' ? 'Team Performance Overview' : 'Team Member Utilization'}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                  {(teamTab === 'Evaluation'
                    ? [
                        ['KPI', '32', '#b28a44'],
                        ['Qualified Rate', '34', '#22c55e'],
                        ['Weak Rate', '10', '#ef4444'],
                        ['Medium Rate', '42', '#2563eb'],
                        ['Review Scale', '75%', '#f6be00'],
                        ['Efficiency', '25', '#64748b'],
                      ]
                    : teamTab === 'Performance'
                      ? [
                          ['KPI', '44', '#b28a44'],
                          ['Rating', '34', '#22c55e'],
                          ['Feedback', '10', '#ef4444'],
                          ['Plaining', '42', '#2563eb'],
                          ['Evalution', '75%', '#f6be00'],
                          ['Improvement', '25', '#64748b'],
                        ]
                    : [
                        ['Total', '43', '#b28a44'],
                        ['Utilized Team', '34', '#22c55e'],
                        ['Unutilized', '10', '#ef4444'],
                        ['Over Utilized', '42', '#2563eb'],
                        ['Tasks', '250', '#f6be00'],
                        ['Deliverables', '53', '#64748b'],
                      ]).map(([label, value, color]) => (
                    <div key={String(label)} className="rounded-xl border bg-white px-4 py-3" style={{ borderColor: `${color}99` }}>
                      <p className="text-xs text-gray-400">{String(label)}</p>
                      <p className="text-4xl font-bold text-[#373a50] mt-1">{String(value)}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-white rounded-xl shadow-sm overflow-hidden">
                {teamTab === 'Performance' ? (
                  <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                      {performanceMembers.map((member, idx) => (
                        <div key={member[0] + idx} className="border border-gray-100 rounded-lg p-3 bg-white">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-orange-200 text-[8px] text-orange-700 flex items-center justify-center">{member[0][0]}</div>
                              <div>
                                <p className="text-xs font-semibold text-[#2f3150]">{member[0]}</p>
                                <p className="text-[9px] text-gray-400">{member[1]}</p>
                              </div>
                            </div>
                            <span className="text-gray-300">:</span>
                          </div>
                          <div className="space-y-1 text-[9px] text-gray-500">
                            <p><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />Done on time</p>
                            <p><span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1" />Open and test</p>
                            <p><span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-1" />Completed</p>
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[9px] text-gray-400">
                            <span>{member[2]}</span>
                            <span>Completion rate</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-gray-200 mt-1 overflow-hidden">
                            <div className="h-full bg-blue-600 rounded-full" style={{ width: member[2] }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="py-4 flex items-center justify-center gap-2 text-gray-300">
                      <span className="w-2 h-2 rounded-full bg-gray-300" />
                      <span className="w-2 h-2 rounded-full bg-gray-300" />
                      <span className="w-2 h-2 rounded-full bg-[#b28a44]" />
                      <span className="w-2 h-2 rounded-full bg-gray-300" />
                    </div>
                    <div className="px-1 text-xs text-gray-500 flex items-center justify-end gap-6">
                      <span>1-10 of 15</span>
                      <div className="flex items-center gap-2 text-lg leading-none">
                        <button className="text-gray-400">{'<'}</button>
                        <button className="text-gray-400">{'>'}</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        {teamTab === 'Evaluation' ? (
                          <tr className="text-[11px] text-gray-400 text-left">
                            <th className="px-4 py-3">Name</th>
                            <th className="px-4 py-3">Project Name</th>
                            <th className="px-4 py-3">Specialize</th>
                            <th className="px-4 py-3">Evolution</th>
                            <th className="px-4 py-3">Last Activity</th>
                            <th className="px-4 py-3" />
                          </tr>
                        ) : (
                          <tr className="text-[11px] text-gray-400 text-left">
                            <th className="px-4 py-3">Active Team Member</th>
                            <th className="px-4 py-3">Productivity (Hrs/Days)</th>
                            <th className="px-4 py-3">Goal Productivity</th>
                            <th className="px-4 py-3">Total Assigned Tasks (Hrs)</th>
                            <th className="px-4 py-3">Worked days</th>
                            <th className="px-4 py-3">Member Capacity</th>
                            <th className="px-4 py-3">Utilization</th>
                          </tr>
                        )}
                      </thead>
                      <tbody>
                        {teamTab === 'Evaluation'
                          ? evaluationRows.map((row) => (
                              <tr key={row[0]} className="border-b border-gray-100 text-xs text-gray-700">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-orange-200 text-[8px] text-orange-700 flex items-center justify-center">{row[0][0]}</div>
                                    <span>{row[0]}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-indigo-700 font-semibold">{row[1]}</td>
                                <td className="px-4 py-3 text-gray-500">{row[2]}</td>
                                <td className="px-4 py-3">{row[3]}</td>
                                <td className="px-4 py-3 text-gray-500">{row[4]}</td>
                                <td className="px-4 py-3 text-gray-400 text-lg leading-none">:</td>
                              </tr>
                            ))
                          : teamRows.map((row) => (
                              <tr key={row[0]} className="border-b border-gray-100 text-xs text-gray-700">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-orange-200 text-[8px] text-orange-700 flex items-center justify-center">{row[0][0]}</div>
                                    <span>{row[0]}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-20 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                                      <div className="h-full w-1/2 bg-blue-600 rounded-full" />
                                    </div>
                                    <span className="text-[10px] text-gray-400">{row[1]}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3">{row[2]}</td>
                                <td className="px-4 py-3">{row[3]}</td>
                                <td className="px-4 py-3">{row[4]}</td>
                                <td className="px-4 py-3">{row[5]}</td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] ${
                                    row[6] === 'Low' ? 'bg-emerald-100 text-emerald-700' : row[6] === 'High' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'
                                  }`}>
                                    {row[6]}
                                  </span>
                                </td>
                              </tr>
                            ))}
                      </tbody>
                    </table>
                    <div className="px-4 py-3 text-xs text-gray-500 flex items-center justify-end gap-6">
                      <span>1-10 of 15</span>
                      <div className="flex items-center gap-2 text-lg leading-none">
                        <button className="text-gray-400">{'<'}</button>
                        <button className="text-gray-400">{'>'}</button>
                      </div>
                    </div>
                  </>
                )}
              </section>
                </>
              )}
            </section>
          ) : activeNav === 'Projects' ? (
            <section className="bg-[#eef0f6] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-3xl font-bold text-[#2f3150]">Projects</h2>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
                {projectColumns.map((column) => (
                  <div key={column.name} className="space-y-3">
                    <div className="bg-white rounded-xl border border-gray-100 px-3 py-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-[#2f3150]">{column.name}</p>
                      <button className="text-[10px] text-[#b28a44]">View All</button>
                    </div>
                    {column.cards.map((card, idx) => (
                      <div key={`${column.name}-${idx}`} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-semibold" style={{ color: column.accent }}>{card.title}</p>
                          <span className="text-[9px] text-gray-400">{card.progress}%</span>
                        </div>
                        <div className="h-1 bg-gray-100 rounded-full mb-2 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${card.progress}%`, backgroundColor: column.accent }} />
                        </div>
                        <p className="text-[10px] text-[#2f3150] font-medium">Project Description</p>
                        <p className="text-[9px] text-gray-400 mb-2">Project Sponsor: {card.sponsor}</p>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[9px] text-gray-400 mb-2">
                          <p>Category: <span className="text-gray-500">{card.category}</span></p>
                          <p>Approach: <span className="text-gray-500">{card.approach}</span></p>
                          <p className="flex items-center gap-1"><Calendar size={10} /> {card.start}</p>
                          <p className="flex items-center gap-1">{card.end}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="w-4 h-4 rounded-full bg-orange-200 text-[8px] text-orange-700 flex items-center justify-center">E</div>
                          <p className="text-[9px] text-gray-400">1 File</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <>
          <section className="bg-white rounded-xl p-4 shadow-sm">
            <h2 className="text-sm font-bold text-gray-900 mb-3">Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 mb-3">
              {overview.map((item) => (
                <div key={item.label} className="border rounded-lg px-3 py-2" style={{ borderColor: `${item.color}88` }}>
                  <p className="text-[10px] text-gray-400">{item.label}</p>
                  <p className="text-3xl font-bold text-[#2f3150]">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <h3 className="text-[11px] text-gray-500 mb-1">Actual Vs Planned</h3>
                <svg viewBox="0 0 500 120" className="w-full h-28 chart-svg">
                  {[35, 72, 45, 88, 54, 60, 50, 66, 58, 79, 61, 52].map((v, i) => (
                    <g key={i}>
                      <rect x={22 + i * 38} y={100 - v} width="10" height={v} className="chart-bar" fill="#2563eb" />
                      <rect x={34 + i * 38} y={100 - (v - 8)} width="10" height={v - 8} className="chart-bar" fill="#ef4444" />
                    </g>
                  ))}
                </svg>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <h3 className="text-[11px] text-gray-500 mb-1">Deviation</h3>
                <svg viewBox="0 0 500 120" className="w-full h-28 chart-svg">
                  <line x1="10" y1="60" x2="490" y2="60" stroke="#d1d5db" />
                  {[-12, 18, -20, 14, -16, 22, -14, 20, -10, 17, -9, 21].map((v, i) => (
                    <rect key={i} x={24 + i * 38} y={v >= 0 ? 60 - v * 2 : 60} width="12" height={Math.abs(v * 2)} className="chart-bar" fill={i % 2 ? '#ef4444' : '#2563eb'} />
                  ))}
                </svg>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Insights</h2>
              <div className="flex items-center gap-4 text-[10px] text-gray-400">
                <span>Projects</span>
                <span>This Month</span>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="flex flex-col min-h-[300px] rounded-lg border border-gray-100 bg-gray-50/40 p-4">
                <h3 className="text-xs font-semibold text-gray-600 mb-3 shrink-0">Projects Progress</h3>
                <div className="flex-1 flex flex-col justify-center gap-2.5">
                  {[
                    ['ON TRACK', 70, '#34d399'],
                    ['COMPLETED', 64, '#60a5fa'],
                    ['SLIGHTLY DELAYED', 53, '#f6be00'],
                    ['DELAYED', 38, '#ef4444'],
                  ].map(([label, value, color]) => (
                    <div key={String(label)} className="flex items-center gap-2">
                      <div className="flex-1 h-5 bg-gray-100 rounded-sm overflow-hidden flex items-center">
                        <div className="h-full flex items-center px-2 text-[8px] text-white font-semibold tracking-wide" style={{ width: `${value}%`, backgroundColor: String(color) }}>{label}</div>
                      </div>
                      <span className="text-[10px] text-gray-500 w-8 text-right">{String(value)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col min-h-[300px] rounded-lg border border-gray-100 bg-gray-50/40 p-4">
                <h3 className="text-xs font-semibold text-gray-600 mb-3 shrink-0">Tasks</h3>
                <div className="flex-1 flex items-end justify-around gap-2 px-1">
                  {[
                    ['IN PROGRESS', 70, '#34d399'],
                    ['NEW TASKS', 64, '#9adfd2'],
                    ['COMPLETED', 53, '#4f46e5'],
                    ['DELAYED', 38, '#ef4444'],
                  ].map(([label, v, color], i) => (
                    <div key={i} className="flex flex-col items-center gap-1 flex-1 max-w-[72px]">
                      <span className="text-[9px] text-gray-500">{Number(v)}%</span>
                      <div className="w-full max-w-[44px] rounded-t chart-bar flex items-center justify-center" style={{ height: `${Number(v) * 1.55}px`, backgroundColor: String(color) }}>
                        <span className="text-[7px] text-white font-semibold -rotate-90 whitespace-nowrap">{String(label)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col min-h-[300px] rounded-lg border border-gray-100 bg-gray-50/40 p-4">
                <h3 className="text-xs font-semibold text-gray-600 mb-3 shrink-0">Projects Category</h3>
                <div className="flex-1 flex items-center justify-center min-h-[220px]">
                  <DonutChart
                    className="w-full max-w-[320px] h-56 chart-svg"
                    slices={[
                      { label: 'Application', value: 43, color: '#1667de' },
                      { label: 'Security', value: 59, color: '#d3525a' },
                      { label: 'Support', value: 36, color: '#3b3a80' },
                      { label: 'Infrastructure', value: 23, color: '#f6be00' },
                    ]}
                    ringWidth={50}
                  />
                </div>
              </div>

              <div className="flex flex-col min-h-[300px] rounded-lg border border-gray-100 bg-gray-50/40 p-4">
                <h3 className="text-xs font-semibold text-gray-600 mb-3 shrink-0">Deliverables</h3>
                <div className="flex-1 flex flex-col justify-center min-h-[220px]">
                  <svg viewBox="0 0 280 200" className="w-full max-w-[320px] mx-auto h-56 chart-svg">
                    {[0, 5, 10, 15, 20].map((v) => (
                      <g key={v}>
                        <line x1="32" x2="268" y1={150 - v * 5.2} y2={150 - v * 5.2} stroke="#e5e7eb" />
                        <text x="8" y={153 - v * 5.2} fontSize="9" fill="#94a3b8">{v}</text>
                      </g>
                    ))}
                    <polygon points="32,118 88,124 114,94 162,102 202,72 268,84 268,150 32,150" fill="#2563eb" />
                    <polygon points="32,150 88,140 114,88 162,68 196,94 268,66 268,150 32,150" fill="#ef4444" opacity="0.85" />
                    <polygon points="32,118 88,150 114,148 162,146 200,70 268,124 268,150 32,150" fill="#f6be00" opacity="0.95" />
                    {['Jan', 'Feb', 'Mar', 'Apr', 'May'].map((m, i) => (
                      <text key={m} x={40 + i * 56} y="172" fontSize="9" fill="#94a3b8">{m}</text>
                    ))}
                    <circle cx="40" cy="188" r="3.5" fill="#ef4444" />
                    <text x="48" y="192" fontSize="9" fill="#6b7280">Total</text>
                    <circle cx="100" cy="188" r="3.5" fill="#2563eb" />
                    <text x="108" y="192" fontSize="9" fill="#6b7280">Delivered</text>
                    <circle cx="172" cy="188" r="3.5" fill="#f6be00" />
                    <text x="180" y="192" fontSize="9" fill="#6b7280">To Be delivered</text>
                  </svg>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Projects List</h3>
              <button className="text-xs text-[#b28a44]">View All</button>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50 border-y border-gray-100">
                <tr className="text-[10px] text-gray-400 uppercase text-left">
                  <th className="px-3 py-2">Project Name</th>
                  <th className="px-3 py-2">Strag. Obj</th>
                  <th className="px-3 py-2">Project Sponsor</th>
                  <th className="px-3 py-2">Budget</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Schedule</th>
                  <th className="px-3 py-2">Progress Level</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Pinnacle', 'Time Bound', 'Sales', '$42', 'Support', '40%', 'IN WORK'],
                  ['Road Map', 'Time Bound', 'Sales', '$18', 'Infrastructure', '42%', 'IN WORK'],
                  ['Growth', 'Time Bound', 'Sales', '$42', 'Application', '40%', 'SLIGHTLY DELAYED'],
                  ['Primate', 'Time Bound', 'Sales', '$42', 'Support', '40%', 'IN WORK'],
                  ['Road Map', 'Time Bound', 'Sales', '$42', 'Infrastructure', '40%', 'DELAYED'],
                ].map((row, i) => (
                  <tr key={i} className="border-b border-gray-100 text-xs text-gray-700">
                    <td className="px-3 py-2 text-indigo-700 underline">{row[0]}</td>
                    <td className="px-3 py-2">{row[1]}</td>
                    <td className="px-3 py-2">{row[2]}</td>
                    <td className="px-3 py-2 text-rose-500 font-semibold">{row[3]}</td>
                    <td className="px-3 py-2">{row[4]}</td>
                    <td className="px-3 py-2">{row[5]}</td>
                    <td className="px-3 py-2"><div className="w-20 h-1.5 bg-gray-200 rounded-full"><div className="h-full bg-blue-500 rounded-full w-2/5" /></div></td>
                    <td className="px-3 py-2"><span className="px-2 py-0.5 rounded-full text-[9px] bg-emerald-100 text-emerald-700">{row[6]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function PlaceholderRoleDashboard({ role, onLogout }: { role: AppRole; onLogout: () => void }) {
  return (
    <div className="h-screen overflow-hidden bg-[#f5f6fb] flex flex-col">
      <header className="bg-white border-b border-gray-100 px-6 h-14 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-800">{ROLE_LABELS[role]} workspace</span>
        <button
          type="button"
          onClick={onLogout}
          className="text-sm font-medium text-indigo-600 hover:underline"
        >
          Sign out
        </button>
      </header>
      <main className="flex-1 flex items-center justify-center p-8">
        <p className="text-gray-500 text-center max-w-md">
          Signed in as <span className="font-semibold text-gray-800">{ROLE_LABELS[role]}</span>.
          A dedicated dashboard for this role can be added next.
        </p>
      </main>
    </div>
  );
}

function RoleDashboard({ role, onLogout }: { role: AppRole; onLogout: () => void }) {
  if (role === 'admin') return <AdminDashboard onLogout={onLogout} />;
  if (role === 'team') return <TeamDashboard onLogout={onLogout} />;
  if (role === 'business') return <BusinessDashboard onLogout={onLogout} />;
  if (role === 'program') return <ProgramDashboard onLogout={onLogout} />;
  if (role === 'project') return <ProjectDashboard onLogout={onLogout} />;
  return <PlaceholderRoleDashboard role={role} onLogout={onLogout} />;
}

// ─── App (login page — unchanged) ─────────────────────────────────────────────
export default function App() {
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginRole, setLoginRole] = useState<AppRole>('business');

  if (isLoggedIn) {
    return (
      <div className="relative h-screen">
        <RoleDashboard role={loginRole} onLogout={() => setIsLoggedIn(false)} />
        <p className="fixed inset-x-0 bottom-0 z-50 bg-white/90 py-2 text-center text-[11px] text-gray-500 backdrop-blur-sm">
          Copyright c2026 Enjaz Management Tool. All rights reserved.
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-screen">
      <main className="flex h-screen flex-col md:flex-row w-full overflow-hidden">
        {/* Left Side: Login Form */}
        <section className="w-full md:w-1/2 flex flex-col justify-center items-center bg-surface-container-lowest p-6 md:p-10 z-10">
        <div className="w-full max-w-sm flex flex-col">
          {/* Brand Anchor */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-7"
          >
            <div className="shadow-sm rounded-md">
              <LogoMark sizeClass="w-12 h-12" />
            </div>
          </motion.div>

          {/* Form Heading */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-6"
          >
            <h1 className="text-3xl font-headline font-extrabold text-primary tracking-tight mb-1">Login</h1>
            <p className="text-on-surface-variant font-sans text-sm">Login to access your project management workspace</p>
          </motion.div>

          {/* Form */}
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setIsLoggedIn(true); }}>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="space-y-2"
            >
              <label className="text-[10px] font-headline font-bold uppercase tracking-widest text-primary" htmlFor="role">
                Role
              </label>
              <select
                id="role"
                value={loginRole}
                onChange={(e) => setLoginRole(e.target.value as AppRole)}
                className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant/15 rounded-lg focus:outline-none focus:border-primary text-primary text-sm font-sans cursor-pointer"
              >
                {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-2"
            >
              <label className="text-[10px] font-headline font-bold uppercase tracking-widest text-primary" htmlFor="email">
                Email
              </label>
              <input
                className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant/15 rounded-lg focus:outline-none focus:border-primary focus:ring-0 text-primary transition-all duration-200 placeholder:text-on-surface-variant/50"
                id="email"
                name="email"
                placeholder="name@example.com"
                type="email"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-2"
            >
              <label className="text-[10px] font-headline font-bold uppercase tracking-widest text-primary" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  className="w-full px-3 py-2.5 bg-surface-container-low border border-outline-variant/15 rounded-lg focus:outline-none focus:border-primary focus:ring-0 text-primary transition-all duration-200 placeholder:text-on-surface-variant/50"
                  id="password"
                  name="password"
                  placeholder="••••••••"
                  type={showPassword ? 'text' : 'password'}
                />
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex items-center justify-between py-2"
            >
              <label className="flex items-center space-x-3 cursor-pointer group">
                <div className="relative" onClick={() => setRememberMe(!rememberMe)}>
                  <input className="peer hidden" type="checkbox" checked={rememberMe} readOnly />
                  <div className={`w-5 h-5 border-2 rounded transition-all ${rememberMe ? 'bg-primary border-primary' : 'border-outline-variant/30 bg-transparent'}`}></div>
                  {rememberMe && (
                    <Check className="absolute inset-0 text-white p-0.5" />
                  )}
                </div>
                <span className="text-sm font-sans text-on-surface-variant group-hover:text-primary transition-colors">Remember me</span>
              </label>
              <a className="text-sm font-headline font-semibold text-error hover:opacity-80 transition-opacity" href="#">
                Forgot Password
              </a>
            </motion.div>

            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full py-2.5 bg-secondary text-white font-headline font-bold text-base rounded-lg shadow-lg hover:brightness-110 transition-all duration-200 flex items-center justify-center gap-2"
              type="submit"
            >
              Login
              <ArrowRight size={16} />
            </motion.button>
          </form>

        </div>
      </section>

      {/* Right Side: Editorial Illustration */}
      <section className="hidden md:flex md:w-1/2 bg-surface-container-low relative overflow-hidden">
        <div className="absolute inset-0 opacity-40">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-secondary/5 to-transparent"></div>
        </div>

        <div className="relative w-full h-full flex items-center justify-center p-8 lg:p-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="relative w-full h-full max-w-xl bg-white/30 backdrop-blur-md rounded-3xl overflow-hidden shadow-2xl border border-white/20 flex flex-col"
          >
            <div className="h-2 w-full bg-gradient-to-r from-primary via-secondary to-primary-container"></div>

            <div className="flex-1 relative group">
              <img
                alt="Man and woman in traditional Saudi clothing looking forward"
                className="w-full h-full object-cover object-center grayscale group-hover:grayscale-0 transition-all duration-1000 ease-in-out"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuADnKpfYEMWHZPSnjmOga49jDPPaAFq3HUIpaRuktPOt07szMnsMDVc_0R3R1PNjqYwgp7-15fqC01Wu9MfGut_Y26tWS6mvMFzgT_-NkLbb28lzUAwNzjPqw4FsmFS5iHW8VFx3q5VM2u2D2AGKfsk2pjqr4yorXydQEstErw7ur4xesMqliJy09RntosX9hrAHJe8UFkCUbAiNUTK9e_fARd1y8Sa9NYBFqJiHfAOU3zI2pDI9gORWjIhWT6poQvoNtG_gwNyc9Y"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/20 to-transparent"></div>

              <div className="absolute bottom-8 left-8 right-8">
                <div className="flex flex-col space-y-4">
                  <motion.span
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="text-secondary font-headline font-extrabold uppercase tracking-widest text-xs"
                  >
                    Project Management Platform
                  </motion.span>
                  <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9 }}
                    className="text-3xl lg:text-4xl font-headline font-black text-white leading-tight"
                  >
                    Plan Better. <br /> Deliver Faster.
                  </motion.h2>
                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.0 }}
                    className="text-white/80 font-sans text-sm max-w-sm"
                  >
                    One workspace for programs, projects, teams, tasks, issues, meetings, and delivery tracking.
                  </motion.p>
                </div>
              </div>
            </div>
          </motion.div>

          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full border-[1px] border-secondary/20 pointer-events-none"></div>
          <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full border-[1px] border-primary/10 pointer-events-none"></div>
        </div>
        </section>
      </main>
      <p className="fixed inset-x-0 bottom-0 z-50 bg-white/90 py-2 text-center text-[11px] text-gray-500 backdrop-blur-sm">
        Copyright c2026 Enjaz Management Tool. All rights reserved.
      </p>
    </div>
  );
}
