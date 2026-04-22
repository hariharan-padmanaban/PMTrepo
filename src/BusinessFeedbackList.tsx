/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { ChevronDown, Pencil, RefreshCw } from 'lucide-react';
import { DonutChart } from './DonutChart';

type Satisfaction = 'Very Satisfied' | 'Satisfied' | 'Unsatisfied';
type Phase = 'UAT' | 'Live';

interface FeedbackRow {
  id: number;
  projectName: string;
  sponsor: string;
  pmInitials: string;
  pmEmail: string;
  satisfaction: Satisfaction;
  date: string;
  phase: Phase;
  startDateIso?: string;
  businessOwnerName?: string;
  recommendations?: string;
  challenges?: string;
  feedbackNote?: string;
}

type FeedbackFormState = {
  projectName: string;
  sponsor: string;
  projectManager: string;
  startDate: string;
  businessOwnerName: string;
  satisfaction: Satisfaction | '';
  phase: Phase | '';
  recommendations: string;
  challenges: string;
  feedback: string;
};

type FeedbackScreen = 'list' | 'add' | 'edit';

const INITIAL_ROWS: FeedbackRow[] = [
  {
    id: 1,
    projectName: 'test project',
    sponsor: 'Sales',
    pmInitials: 'HA',
    pmEmail: 'h.abdelgaffar@almajles.gov.ae',
    satisfaction: 'Satisfied',
    date: '10/24/2025',
    phase: 'Live',
    startDateIso: '2025-10-24',
    businessOwnerName: 'pms admin',
    recommendations: 'Test Recommendations',
    challenges: 'Challenges123',
    feedbackNote: 'Test333 Feedback',
  },
  {
    id: 2,
    projectName: 'Ror test',
    sponsor: 'Sales',
    pmInitials: 'P4',
    pmEmail: 'project.lead@company.com',
    satisfaction: 'Very Satisfied',
    date: '10/22/2025',
    phase: 'UAT',
    startDateIso: '2025-10-22',
  },
  {
    id: 3,
    projectName: 'HR Wallet',
    sponsor: 'IT',
    pmInitials: 'PN',
    pmEmail: 'pm.wallet@company.com',
    satisfaction: 'Satisfied',
    date: '10/20/2025',
    phase: 'UAT',
    startDateIso: '2025-10-20',
  },
  {
    id: 4,
    projectName: 'Portal Revamp',
    sponsor: 'IT',
    pmInitials: 'HR',
    pmEmail: 'hr.manager@company.com',
    satisfaction: 'Satisfied',
    date: '10/18/2025',
    phase: 'UAT',
    startDateIso: '2025-10-18',
  },
  {
    id: 5,
    projectName: 'Analytics Hub',
    sponsor: 'Sales',
    pmInitials: 'P4',
    pmEmail: 'project.lead@company.com',
    satisfaction: 'Satisfied',
    date: '10/15/2025',
    phase: 'Live',
    startDateIso: '2025-10-15',
  },
];

function satisfactionClass(s: Satisfaction): string {
  if (s === 'Very Satisfied') return 'bg-amber-100 text-amber-900 font-medium';
  if (s === 'Unsatisfied') return 'bg-rose-100 text-rose-800 font-medium';
  return 'bg-emerald-100 text-emerald-900 font-medium';
}

function phaseClass(p: Phase): string {
  return p === 'Live' ? 'bg-emerald-100 text-emerald-900 font-medium' : 'bg-orange-100 text-orange-900 font-medium';
}

function initialsFromEmail(email: string): string {
  const local = email.split('@')[0]?.trim() || '';
  const parts = local.split(/[._\s-]+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase().slice(0, 4);
  return local.slice(0, 2).toUpperCase() || 'PM';
}

function formatUsDate(isoDate: string): string {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  if (!m || !d) return isoDate;
  return `${m}/${d}/${y}`;
}

function parseUsDateToIso(us: string): string {
  const parts = us.trim().split('/');
  if (parts.length !== 3) return '';
  const [m, d, y] = parts;
  if (!y || !m || !d) return '';
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function rowToForm(row: FeedbackRow): FeedbackFormState {
  const startDate = row.startDateIso ?? parseUsDateToIso(row.date);
  return {
    projectName: row.projectName,
    sponsor: row.sponsor,
    projectManager: row.pmEmail,
    startDate,
    businessOwnerName: row.businessOwnerName ?? '',
    satisfaction: row.satisfaction,
    phase: row.phase,
    recommendations: row.recommendations ?? '',
    challenges: row.challenges ?? '',
    feedback: row.feedbackNote ?? '',
  };
}

const PROJECT_OPTIONS = ['HR Wallet', 'test project', 'Ror test', 'Portal Revamp', 'Analytics Hub'];

const EMPTY_FORM: FeedbackFormState = {
  projectName: '',
  sponsor: '',
  projectManager: '',
  startDate: '',
  businessOwnerName: '',
  satisfaction: '',
  phase: '',
  recommendations: '',
  challenges: '',
  feedback: '',
};

const ctl =
  'rounded-md border border-gray-200 bg-white text-sm text-gray-800 shadow-sm placeholder:text-gray-400 focus:border-[#b28a44] focus:outline-none focus:ring-2 focus:ring-[#b28a44]/25';
const fieldInputCls = `w-full ${ctl} h-9 px-3`;
const fieldSelectCls = `w-full ${ctl} h-9 appearance-none px-3 pr-10`;
const fieldTextareaShortCls = `w-full ${ctl} min-h-[88px] resize-y px-3 py-2 leading-snug`;
const fieldTextareaFeedbackCls = `w-full ${ctl} min-h-[140px] resize-y px-3 py-2 leading-relaxed`;

function RequiredLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-xs font-medium text-gray-700">
      {children}
      <span className="text-red-500"> *</span>
    </span>
  );
}

export default function BusinessFeedbackList() {
  const [rows, setRows] = useState<FeedbackRow[]>(INITIAL_ROWS);
  const [screen, setScreen] = useState<FeedbackScreen>('list');
  const [editRowId, setEditRowId] = useState<number | null>(null);
  const [form, setForm] = useState<FeedbackFormState>(EMPTY_FORM);

  const goToList = useCallback(() => {
    setScreen('list');
    setEditRowId(null);
    setForm(EMPTY_FORM);
  }, []);

  const openAddFeedback = useCallback(() => {
    setEditRowId(null);
    setForm(EMPTY_FORM);
    setScreen('add');
  }, []);

  const openEditFeedback = useCallback((row: FeedbackRow) => {
    setEditRowId(row.id);
    setForm(rowToForm(row));
    setScreen('edit');
  }, []);

  const clearFormAdd = useCallback(() => {
    setForm(EMPTY_FORM);
  }, []);

  const submitFeedback = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!form.projectName || !form.sponsor.trim() || !form.projectManager.trim()) return;
      if (!form.startDate || !form.businessOwnerName.trim()) return;
      if (!form.satisfaction || !form.phase) return;

      const satisfaction: Satisfaction = form.satisfaction;
      const phase: Phase = form.phase;
      const pmEmail = form.projectManager.trim();

      setRows((prev) => {
        const nextId = prev.reduce((m, r) => Math.max(m, r.id), 0) + 1;
        const newRow: FeedbackRow = {
          id: nextId,
          projectName: form.projectName,
          sponsor: form.sponsor.trim(),
          pmInitials: initialsFromEmail(pmEmail),
          pmEmail,
          satisfaction,
          date: formatUsDate(form.startDate),
          phase,
          startDateIso: form.startDate,
          businessOwnerName: form.businessOwnerName.trim(),
          recommendations: form.recommendations,
          challenges: form.challenges,
          feedbackNote: form.feedback,
        };
        return [...prev, newRow];
      });
      goToList();
    },
    [form, goToList],
  );

  const submitEditFeedback = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (editRowId == null) return;
      const f = form;
      if (!f.projectName.trim() || !f.sponsor.trim() || !f.projectManager.trim()) return;
      if (!f.startDate || !f.businessOwnerName.trim()) return;
      if (!f.satisfaction || !f.phase) return;

      const satisfaction: Satisfaction = f.satisfaction;
      const phase: Phase = f.phase;
      const pmEmail = f.projectManager.trim();

      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== editRowId) return r;
          return {
            ...r,
            projectName: f.projectName.trim(),
            sponsor: f.sponsor.trim(),
            pmEmail,
            pmInitials: initialsFromEmail(pmEmail),
            satisfaction,
            phase,
            date: formatUsDate(f.startDate),
            startDateIso: f.startDate,
            businessOwnerName: f.businessOwnerName.trim(),
            recommendations: f.recommendations,
            challenges: f.challenges,
            feedbackNote: f.feedback,
          };
        }),
      );
      goToList();
    },
    [editRowId, form, goToList],
  );

  const analytics = useMemo(() => {
    let uat = 0;
    let live = 0;
    let satisfied = 0;
    let verySatisfied = 0;
    let unsatisfied = 0;
    for (const r of rows) {
      if (r.phase === 'UAT') uat += 1;
      else live += 1;
      if (r.satisfaction === 'Satisfied') satisfied += 1;
      else if (r.satisfaction === 'Very Satisfied') verySatisfied += 1;
      else unsatisfied += 1;
    }
    const total = rows.length || 1;
    return { uat, live, satisfied, verySatisfied, unsatisfied, total };
  }, [rows]);

  const onRefresh = useCallback(() => {
    setRows([...INITIAL_ROWS]);
  }, []);

  const chartH = 100;
  const chartBottom = 108;
  const maxY = 10;
  const barScale = (chartH - 16) / maxY;

  const isFormScreen = screen === 'add' || screen === 'edit';

  const formFields = (
    <>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <label className="block min-w-0 space-y-1.5">
          <RequiredLabel>Project Name</RequiredLabel>
          <div className="relative">
            <select
              required
              value={form.projectName}
              onChange={(e) => setForm((f) => ({ ...f, projectName: e.target.value }))}
              className={`${fieldSelectCls} text-gray-800`}
            >
              <option value="" disabled>
                Select
              </option>
              {form.projectName && !PROJECT_OPTIONS.includes(form.projectName) && (
                <option value={form.projectName}>{form.projectName}</option>
              )}
              {PROJECT_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
        </label>
        <label className="block min-w-0 space-y-1.5">
          <RequiredLabel>Project Sponsor</RequiredLabel>
          <input
            required
            type="text"
            value={form.sponsor}
            onChange={(e) => setForm((f) => ({ ...f, sponsor: e.target.value }))}
            className={fieldInputCls}
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <label className="block min-w-0 space-y-1.5">
          <RequiredLabel>Project Manager</RequiredLabel>
          <input
            required
            type="text"
            value={form.projectManager}
            onChange={(e) => setForm((f) => ({ ...f, projectManager: e.target.value }))}
            className={fieldInputCls}
          />
        </label>
        <label className="block min-w-0 space-y-1.5">
          <RequiredLabel>Date</RequiredLabel>
          <input
            required
            type="date"
            value={form.startDate}
            onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
            className={fieldInputCls}
          />
        </label>
        <label className="block min-w-0 space-y-1.5">
          <RequiredLabel>Name</RequiredLabel>
          <input
            required
            type="text"
            placeholder="Business owner name"
            value={form.businessOwnerName}
            onChange={(e) => setForm((f) => ({ ...f, businessOwnerName: e.target.value }))}
            className={fieldInputCls}
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <label className="block min-w-0 space-y-1.5">
          <RequiredLabel>Satisfaction Level</RequiredLabel>
          <div className="relative">
            <select
              required
              value={form.satisfaction}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  satisfaction: e.target.value as Satisfaction | '',
                }))
              }
              className={`${fieldSelectCls} text-gray-800`}
            >
              <option value="" disabled>
                Select (very satisfied, satisfied, unsatisfied)
              </option>
              <option value="Very Satisfied">Very Satisfied</option>
              <option value="Satisfied">Satisfied</option>
              <option value="Unsatisfied">Unsatisfied</option>
            </select>
            <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
        </label>
        <label className="block min-w-0 space-y-1.5">
          <RequiredLabel>Project Phase</RequiredLabel>
          <div className="relative">
            <select
              required
              value={form.phase}
              onChange={(e) => setForm((f) => ({ ...f, phase: e.target.value as Phase | '' }))}
              className={fieldSelectCls}
            >
              <option value="" disabled>
                Select (UAT, Live)
              </option>
              <option value="UAT">UAT</option>
              <option value="Live">Live</option>
            </select>
            <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
        </label>
      </div>

      <label className="block min-w-0 space-y-1.5">
        <span className="text-xs font-medium text-gray-700">Feedback</span>
        <textarea
          rows={5}
          value={form.feedback}
          onChange={(e) => setForm((f) => ({ ...f, feedback: e.target.value }))}
          className={fieldTextareaFeedbackCls}
        />
      </label>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <label className="block min-w-0 space-y-1.5">
          <span className="text-xs font-medium text-gray-700">Challenges</span>
          <textarea
            rows={4}
            value={form.challenges}
            onChange={(e) => setForm((f) => ({ ...f, challenges: e.target.value }))}
            className={fieldTextareaShortCls}
          />
        </label>
        <label className="block min-w-0 space-y-1.5">
          <span className="text-xs font-medium text-gray-700">Recommendations</span>
          <textarea
            rows={4}
            value={form.recommendations}
            onChange={(e) => setForm((f) => ({ ...f, recommendations: e.target.value }))}
            className={fieldTextareaShortCls}
          />
        </label>
      </div>
    </>
  );

  if (isFormScreen) {
    const title = screen === 'edit' ? 'Edit Feedback' : 'Feedback';

    return (
      <div className="min-w-0 max-w-full xl:col-span-3">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-[#151d5d] sm:text-2xl">{title}</h2>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
          <form
            onSubmit={screen === 'add' ? submitFeedback : submitEditFeedback}
            className="space-y-5"
          >
            {formFields}

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 pt-5">
              {screen === 'add' && (
                <>
                  <button
                    type="button"
                    onClick={clearFormAdd}
                    className="h-9 min-w-[88px] rounded-md border border-[#b28a44] bg-white px-4 text-sm font-medium text-[#b28a44] hover:bg-amber-50/80"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={goToList}
                    className="h-9 min-w-[88px] rounded-md border border-[#b28a44] bg-white px-4 text-sm font-medium text-[#b28a44] hover:bg-amber-50/80"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="h-9 min-w-[148px] rounded-md bg-[#b28a44] px-4 text-sm font-medium text-white shadow-sm hover:bg-[#9a7638]"
                  >
                    Submit Feedback
                  </button>
                </>
              )}
              {screen === 'edit' && (
                <>
                  <button
                    type="button"
                    onClick={goToList}
                    className="h-9 min-w-[88px] rounded-md border border-[#b28a44] bg-white px-4 text-sm font-medium text-[#b28a44] hover:bg-amber-50/80"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="h-9 min-w-[100px] rounded-md bg-[#b28a44] px-4 text-sm font-medium text-white shadow-sm hover:bg-[#9a7638]"
                  >
                    Update
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 items-start gap-4 min-w-0 max-w-full xl:grid-cols-3">
      <div className="xl:col-span-2 space-y-4 min-w-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-2xl font-semibold tracking-tight text-[#151d5d]">Feedback list</h2>
          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={openAddFeedback}
              className="h-9 rounded-md bg-[#b28a44] px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#9a7638]"
            >
              Add New Feedback
            </button>
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw size={16} className="text-gray-500" />
              Refresh
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm min-w-0">
          <table className="w-full table-fixed border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-[#e8eaf6] text-left text-[10px] font-semibold uppercase tracking-wide text-[#4a4f7a] sm:text-[11px]">
                <th className="min-w-0 w-[14%] px-2 py-2.5 align-top font-semibold normal-case sm:px-3 sm:uppercase">
                  <span className="inline-block leading-snug">Project Name</span>
                </th>
                <th className="min-w-0 w-[10%] px-2 py-2.5 align-top font-semibold normal-case sm:px-3 sm:uppercase">
                  <span className="inline-block leading-snug">Sponsor</span>
                </th>
                <th className="min-w-0 w-[26%] px-2 py-2.5 align-top font-semibold normal-case sm:px-3 sm:uppercase">
                  <span className="inline-block leading-snug">Project Manager</span>
                </th>
                <th className="min-w-0 w-[16%] px-2 py-2.5 align-top font-semibold normal-case sm:px-3 sm:uppercase">
                  <span className="inline-block leading-snug">Satisfaction</span>
                </th>
                <th className="min-w-0 w-[11%] px-2 py-2.5 align-top font-semibold normal-case sm:px-3 sm:uppercase">
                  <span className="inline-block leading-snug">Date</span>
                </th>
                <th className="min-w-0 w-[10%] px-2 py-2.5 align-top font-semibold normal-case sm:px-3 sm:uppercase">
                  <span className="inline-block leading-snug">Phase</span>
                </th>
                <th className="min-w-0 w-[13%] px-2 py-2.5 text-center align-top font-semibold normal-case sm:px-3 sm:uppercase">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.id} className="text-gray-700 hover:bg-gray-50/80">
                  <td className="min-w-0 break-words px-2 py-2.5 align-top font-medium text-[#2d356b] sm:px-3">
                    {row.projectName}
                  </td>
                  <td className="min-w-0 break-words px-2 py-2.5 align-top text-gray-600 sm:px-3">{row.sponsor}</td>
                  <td className="min-w-0 px-2 py-2.5 align-top sm:px-3">
                    <div className="flex min-w-0 items-start gap-2">
                      <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-[9px] font-semibold text-gray-600 sm:h-8 sm:w-8 sm:text-[10px]">
                        {row.pmInitials}
                      </span>
                      <span className="min-w-0 break-words text-[11px] text-gray-600 sm:text-xs">{row.pmEmail}</span>
                    </div>
                  </td>
                  <td className="min-w-0 px-2 py-2.5 align-top sm:px-3">
                    <span
                      className={`inline-flex max-w-full rounded-full px-2 py-1 text-[10px] leading-snug sm:text-[11px] ${satisfactionClass(row.satisfaction)}`}
                    >
                      {row.satisfaction}
                    </span>
                  </td>
                  <td className="min-w-0 break-words px-2 py-2.5 align-top text-gray-600 sm:px-3">{row.date}</td>
                  <td className="min-w-0 px-2 py-2.5 align-top sm:px-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-[10px] sm:text-[11px] ${phaseClass(row.phase)}`}
                    >
                      {row.phase}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-center align-top sm:px-3">
                    <button
                      type="button"
                      onClick={() => openEditFeedback(row)}
                      className="inline-flex rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-[#151d5d]"
                      aria-label="Edit"
                    >
                      <Pencil size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-4 xl:sticky xl:top-4">
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-[#2d356b]">Project Phase</h3>
          <svg viewBox="0 0 220 130" className="h-36 w-full">
            {[0, 2, 4, 6, 8, 10].map((v) => (
              <g key={v}>
                <line
                  x1="36"
                  x2="200"
                  y1={chartBottom - v * barScale}
                  y2={chartBottom - v * barScale}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                />
                <text x="30" y={4 + chartBottom - v * barScale} textAnchor="end" fontSize="9" fill="#94a3b8">
                  {v}
                </text>
              </g>
            ))}
            <rect
              x="72"
              y={chartBottom - analytics.uat * barScale}
              width="36"
              height={analytics.uat * barScale}
              rx="4"
              fill="#2563eb"
              className="chart-bar"
            />
            <rect
              x="132"
              y={chartBottom - analytics.live * barScale}
              width="36"
              height={analytics.live * barScale}
              rx="4"
              fill="#14b8a6"
              className="chart-bar"
            />
            <text x="90" y="126" textAnchor="middle" fontSize="10" fill="#64748b">
              UAT
            </text>
            <text x="150" y="126" textAnchor="middle" fontSize="10" fill="#64748b">
              Live
            </text>
          </svg>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-[#2d356b]">Satisfaction Level</h3>
          <div className="flex justify-center">
            <DonutChart
              className="h-44 w-full max-w-[290px]"
              slices={[
                { label: 'Satisfied', value: analytics.satisfied, color: '#1667de' },
                { label: 'Very Satisfied', value: analytics.verySatisfied, color: '#3b3a80' },
                { label: 'Unsatisfied', value: analytics.unsatisfied, color: '#d3525a' },
              ]}
              ringWidth={46}
              centerText={`${analytics.total}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
