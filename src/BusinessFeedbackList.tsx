/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { ChevronDown, Pencil, RefreshCw } from 'lucide-react';
import { DonutChart } from './DonutChart';
import { PagerBar } from './PagerBar';
import { New_feedbacksService } from './generated/services/New_feedbacksService';
import { New_projectsService } from './generated/services/New_projectsService';
import { NewUsersService } from './services/NewUsersService';
import type { New_feedbacks } from './generated/models/New_feedbacksModel';
import { ScreenLoader } from './ScreenLoader';
import { displayNameFromXrmString } from './sessionUser';
import { enj } from './ui/enjForm';

type Satisfaction = 'Very Satisfied' | 'Satisfied' | 'Unsatisfied';
type Phase = 'UAT' | 'Live';

const SATISFACTION_TO_CHOICE: Record<Satisfaction, number> = {
  'Very Satisfied': 100000000,
  Satisfied: 100000001,
  Unsatisfied: 100000002,
};

const PHASE_TO_CHOICE: Record<Phase, number> = {
  UAT: 100000000,
  Live: 100000001,
};

const CHOICE_TO_SATISFACTION = (n: number | undefined): Satisfaction | null => {
  if (n === 100000000) return 'Very Satisfied';
  if (n === 100000001) return 'Satisfied';
  if (n === 100000002) return 'Unsatisfied';
  return null;
};

const CHOICE_TO_PHASE = (n: number | undefined): Phase | null => {
  if (n === 100000000) return 'UAT';
  if (n === 100000001) return 'Live';
  return null;
};

type ProjectRow = Record<string, unknown>;

function clip(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : t.slice(0, max);
}

function readProjectName(row: ProjectRow): string {
  return String(row.new_projectname ?? row.new_name ?? '').trim();
}

function readProjectSponsorLabel(row: ProjectRow): string {
  const named = String(row.new_projectsponsorname ?? row.crcf8_projectsponsorname ?? '').trim();
  if (named) return clip(named, 100);
  return '';
}

/**
 * Project.ProjectSponsor from new_project — Project Creation uses crcf8_projectsponsor;
 * standard column is new_projectsponsor (option set) with new_projectsponsorname.
 */
function readProjectSponsorFromProject(row: ProjectRow): string {
  const t = (v: unknown) => String(v ?? '').trim();

  const crcf8n = t(row.crcf8_projectsponsorname);
  if (crcf8n) return clip(crcf8n, 100);

  return readProjectSponsorLabel(row);
}

function readAssignToProjectManager(row: ProjectRow): string {
  return String(
    row.crcf8_projectmanager ?? row.new_programmanager ?? row.new_projectmanagername ?? '',
  ).trim();
}

function readProjectManagerDisplay(row: ProjectRow): string {
  return String(row.new_projectmanagername ?? readAssignToProjectManager(row)).trim();
}

function parseProjectStartDateIso(row: ProjectRow): string {
  const raw = String(row.new_startdate ?? '').trim();
  if (!raw) return '';
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

function formatUsFromIso(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!m || !d) return iso;
  return `${m}/${d}/${y}`;
}

interface FeedbackRow {
  id: string;
  projectName: string;
  sponsor: string;
  pmInitials: string;
  pmEmail: string;
  satisfaction: Satisfaction;
  date: string;
  phase: Phase;
  startDateIso: string;
  /** `new_name`: business owner (free text); legacy rows may store an email. */
  businessOwnerName: string;
  recommendations: string;
  challenges: string;
  feedbackNote: string;
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

function satisfactionClass(s: Satisfaction): string {
  if (s === 'Very Satisfied') return `${enj.badge} ${enj.badgeWarning}`;
  if (s === 'Unsatisfied') return `${enj.badge} ${enj.badgeDanger}`;
  return `${enj.badge} ${enj.badgeSuccess}`;
}

function phaseClass(p: Phase): string {
  return p === 'Live' ? `${enj.badge} ${enj.badgeSuccess}` : `${enj.badge} ${enj.badgeWarning}`;
}

function initialsFromEmailOrName(s: string): string {
  if (!s) return 'PM';
  if (s.includes('@')) {
    const local = s.split('@')[0]?.trim() || '';
    const parts = local.split(/[._\s-]+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase().slice(0, 4);
    return local.slice(0, 2).toUpperCase() || 'PM';
  }
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase().slice(0, 4);
  return s.slice(0, 2).toUpperCase() || 'PM';
}

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

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

/** Shared enj form tokens — see `index.css` / `ui/enjForm`. */
const fieldInputReadonlyCls = `w-full ${enj.control} cursor-default bg-slate-50/90 text-sm text-gray-700`;
const fieldSelectCls = `w-full ${enj.control} text-sm`;
const fieldTextareaShortCls = `w-full ${enj.textarea} min-h-[72px] resize-y text-xs leading-snug`;
const fieldTextareaFeedbackCls = `w-full ${enj.textarea} min-h-[120px] text-xs leading-relaxed`;
const fieldErrorCls = enj.fieldError;

function RequiredLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[11px] font-medium text-gray-600">
      {children}
      <span className="text-red-500"> *</span>
    </span>
  );
}

function dataverseRowToFeedbackRow(
  r: New_feedbacks & Record<string, unknown>,
  nameByEmail: Map<string, string>,
): FeedbackRow | null {
  const id = String(r.new_feedbackid ?? '').trim();
  if (!id) return null;
  const projectName = String((r as { new_feedback2?: string }).new_feedback2 ?? '').trim() || '—';
  const satN = Number(r.new_satisfactionlevel);
  const phN = Number(r.new_projectphase);
  const sat = CHOICE_TO_SATISFACTION(satN) ?? 'Satisfied';
  const ph = CHOICE_TO_PHASE(phN) ?? 'UAT';
  const startRaw = String(r.new_date ?? '').trim();
  let startDateIso = '';
  if (startRaw) {
    const m = startRaw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    startDateIso = m ? `${m[1]}-${m[2]}-${m[3]}` : startRaw;
  }
  const pm = String(r.new_projectmanager ?? '').trim();
  const rawName = String(r.new_name ?? '').trim();
  const nameIsEmail = isValidEmail(rawName);
  const fromUsers = nameIsEmail ? nameByEmail.get(rawName.toLowerCase()) : '';
  const fromEmailShape = nameIsEmail ? displayNameFromXrmString(rawName) : '';
  const owneridname = String((r as New_feedbacks & { owneridname?: string }).owneridname ?? '').trim();
  const createdBy = String((r as New_feedbacks & { createdbyname?: string }).createdbyname ?? '').trim();
  const businessOwnerName =
    (nameIsEmail
      ? fromUsers || fromEmailShape
      : rawName) ||
    owneridname ||
    createdBy ||
    '—';
  return {
    id,
    projectName,
    sponsor: String(r.new_projectsponsor ?? '').trim() || '—',
    pmInitials: initialsFromEmailOrName(pm),
    pmEmail: pm,
    satisfaction: sat,
    date: startDateIso ? formatUsFromIso(startDateIso) : '—',
    phase: ph,
    startDateIso: startDateIso || startRaw,
    businessOwnerName: businessOwnerName || '—',
    recommendations: String(r.new_recommendations ?? '').trim(),
    challenges: String(r.new_challenges ?? '').trim(),
    feedbackNote: String(r.new_feedback1 ?? '').trim(),
  };
}

function rowToForm(row: FeedbackRow): FeedbackFormState {
  const bo = row.businessOwnerName === '—' ? '' : row.businessOwnerName;
  return {
    projectName: row.projectName === '—' ? '' : row.projectName,
    sponsor: row.sponsor === '—' ? '' : row.sponsor,
    projectManager: row.pmEmail,
    startDate: row.startDateIso,
    businessOwnerName: bo.trim(),
    satisfaction: row.satisfaction,
    phase: row.phase,
    recommendations: row.recommendations,
    challenges: row.challenges,
    feedback: row.feedbackNote,
  };
}

export default function BusinessFeedbackList() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [screen, setScreen] = useState<FeedbackScreen>('list');
  const [editRowId, setEditRowId] = useState<string | null>(null);
  const [form, setForm] = useState<FeedbackFormState>(EMPTY_FORM);
  const [listLoading, setListLoading] = useState(true);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [saveBusy, setSaveBusy] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [projectRows, setProjectRows] = useState<ProjectRow[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const projectNameOptions = useMemo(() => {
    const names = projectRows.map(readProjectName).filter(Boolean);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [projectRows]);

  const loadProjects = useCallback(async () => {
    setProjectsLoading(true);
    try {
      const res = await New_projectsService.getAll({ top: 5000, orderBy: ['new_projectname asc'] });
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to load projects');
      setProjectRows((res.data ?? []) as unknown as ProjectRow[]);
    } catch {
      setProjectRows([]);
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  const loadFeedbacks = useCallback(async () => {
    setListLoading(true);
    try {
      const usersRes = await NewUsersService.getAll({ top: 2000, orderBy: ['createdon desc'] });
      const nameByEmail = new Map<string, string>();
      if (usersRes.success) {
        for (const u of (usersRes.data ?? []) as Array<Record<string, unknown>>) {
          const e1 = String(u.new_newcolumn ?? '').trim().toLowerCase();
          const e2 = String(u.new_userid ?? '').trim().toLowerCase();
          const nm = String(u.new_name ?? '').trim();
          if (nm) {
            if (e1.includes('@')) nameByEmail.set(e1, nm);
            if (e2.includes('@')) nameByEmail.set(e2, nm);
          }
        }
      }
      const res = await New_feedbacksService.getAll({ top: 2000, orderBy: ['createdon desc'] });
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to load feedback');
      const list = (res.data ?? [])
        .map((r) => dataverseRowToFeedbackRow(r as New_feedbacks & Record<string, unknown>, nameByEmail))
        .filter((x): x is FeedbackRow => Boolean(x));
      setRows(list);
    } catch {
      setRows([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    void loadFeedbacks();
  }, [loadFeedbacks]);

  const applyProjectLookup = useCallback(
    (projectName: string) => {
      setFormErrors((e) => {
        const next = { ...e };
        delete next.projectName;
        delete next.sponsor;
        delete next.projectManager;
        delete next.startDate;
        return next;
      });
      const p = projectRows.find((r) => readProjectName(r) === projectName);
      if (!p) {
        setForm((f) => ({ ...f, projectName, sponsor: '', projectManager: '', startDate: '' }));
        return;
      }
      setForm((f) => ({
        ...f,
        projectName,
        sponsor: readProjectSponsorFromProject(p),
        projectManager: clip(readAssignToProjectManager(p) || readProjectManagerDisplay(p), 100),
        startDate: parseProjectStartDateIso(p),
      }));
    },
    [projectRows],
  );

  const goToList = useCallback(() => {
    setScreen('list');
    setEditRowId(null);
    setFormErrors({});
    setForm(EMPTY_FORM);
  }, []);

  const openAddFeedback = useCallback(() => {
    setEditRowId(null);
    setFormErrors({});
    setForm(EMPTY_FORM);
    setScreen('add');
  }, []);

  const openEditFeedback = useCallback((row: FeedbackRow) => {
    setEditRowId(row.id);
    setFormErrors({});
    setForm(rowToForm(row));
    setScreen('edit');
  }, []);

  const clearFormAdd = useCallback(() => {
    setFormErrors({});
    setForm(EMPTY_FORM);
  }, []);

  const buildPayload = useCallback(
    (f: FeedbackFormState): Record<string, unknown> => {
      const assignEmail = clip(readAssignToProjectManager(
        projectRows.find((r) => readProjectName(r) === f.projectName) ?? {},
      ) || f.projectManager, 100);
      const pmDisplay = clip(
        readProjectManagerDisplay(
          projectRows.find((r) => readProjectName(r) === f.projectName) ?? {},
        ) || f.projectManager,
        100,
      );
      return {
        new_name: clip(f.businessOwnerName, 100),
        new_feedback1: clip(f.feedback, 850),
        new_feedback2: clip(f.projectName, 100),
        new_date: clip(f.startDate, 100),
        new_projectsponsor: clip(f.sponsor, 100),
        new_programmanager: assignEmail,
        new_projectmanager: pmDisplay || assignEmail,
        new_satisfactionlevel: SATISFACTION_TO_CHOICE[f.satisfaction as Satisfaction],
        new_projectphase: PHASE_TO_CHOICE[f.phase as Phase],
        new_recommendations: f.recommendations.trim() || undefined,
        new_challenges: f.challenges.trim() || undefined,
        statecode: 0,
      };
    },
    [projectRows],
  );

  const runValidation = useCallback((f: FeedbackFormState) => {
    const e: Record<string, string> = {};
    if (!f.projectName.trim()) e.projectName = 'Select a project.';
    if (!f.sponsor.trim()) {
      e.sponsor = 'This project has no Project Sponsor. Update the project or pick another one.';
    }
    if (!f.projectManager.trim()) {
      e.projectManager = 'This project has no Assign To Project Manager. Update the project or pick another one.';
    }
    if (!f.startDate.trim()) {
      e.startDate = 'This project has no Start Date. Update the project or pick another one.';
    }
    if (!f.businessOwnerName.trim()) {
      e.businessOwnerName = 'Enter business owner name.';
    } else if (f.businessOwnerName.length > 100) {
      e.businessOwnerName = 'Business owner name must be 100 characters or less.';
    }
    if (!f.satisfaction) e.satisfaction = 'Select a satisfaction level.';
    if (!f.phase) e.phase = 'Select a project phase.';
    if (!f.feedback.trim()) e.feedback = 'Enter your feedback.';
    if (f.feedback.length > 850) e.feedback = 'Feedback must be 850 characters or less.';
    setFormErrors(e);
    return Object.keys(e).length === 0;
  }, []);

  useEffect(() => {
    if (Object.keys(formErrors).length === 0) return;
    setFormErrors((prev) => {
      const next = { ...prev };
      if (next.projectName && form.projectName.trim()) delete next.projectName;
      if (next.sponsor && form.sponsor.trim()) delete next.sponsor;
      if (next.projectManager && form.projectManager.trim()) delete next.projectManager;
      if (next.startDate && form.startDate.trim()) delete next.startDate;
      if (next.businessOwnerName && form.businessOwnerName.trim() && form.businessOwnerName.length <= 100) {
        delete next.businessOwnerName;
      }
      if (next.satisfaction && form.satisfaction) delete next.satisfaction;
      if (next.phase && form.phase) delete next.phase;
      if (next.feedback && form.feedback.trim() && form.feedback.length <= 850) delete next.feedback;
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
  }, [form, formErrors]);

  const submitFeedback = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!runValidation(form)) {
        setBanner({ type: 'error', message: 'Fix the highlighted fields and try again.' });
        return;
      }

      setSaveBusy(true);
      setBanner(null);
      try {
        const payload = buildPayload(form);
        const res = await New_feedbacksService.create(
          payload as unknown as Parameters<typeof New_feedbacksService.create>[0],
        );
        if (!res.success) throw new Error(res.error?.message ?? 'Failed to save feedback');
        setBanner({ type: 'success', message: 'Feedback saved.' });
        await loadFeedbacks();
        goToList();
      } catch (err) {
        setBanner({ type: 'error', message: err instanceof Error ? err.message : 'Failed to save.' });
      } finally {
        setSaveBusy(false);
      }
    },
    [form, buildPayload, loadFeedbacks, goToList, runValidation],
  );

  const submitEditFeedback = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (editRowId == null) return;
      const f = form;
      if (!runValidation(f)) {
        setBanner({ type: 'error', message: 'Fix the highlighted fields and try again.' });
        return;
      }

      setSaveBusy(true);
      setBanner(null);
      try {
        const payload = buildPayload(f);
        const res = await New_feedbacksService.update(editRowId, payload);
        if (!res.success) throw new Error(res.error?.message ?? 'Failed to update feedback');
        setBanner({ type: 'success', message: 'Feedback updated.' });
        await loadFeedbacks();
        goToList();
      } catch (err) {
        setBanner({ type: 'error', message: err instanceof Error ? err.message : 'Failed to update.' });
      } finally {
        setSaveBusy(false);
      }
    },
    [editRowId, form, buildPayload, loadFeedbacks, goToList, runValidation],
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

  const onRefresh = useCallback(async () => {
    setBanner(null);
    await loadProjects();
    await loadFeedbacks();
  }, [loadProjects, loadFeedbacks]);

  const chartH = 100;
  const chartBottom = 108;
  const maxY = 10;
  const barScale = (chartH - 16) / maxY;

  const [feedbackPage, setFeedbackPage] = useState(1);
  const FEEDBACK_PAGE_SIZE = 6;
  const feedbackTotalPages = Math.max(1, Math.ceil(rows.length / FEEDBACK_PAGE_SIZE));
  const pagedRows = rows.slice((feedbackPage - 1) * FEEDBACK_PAGE_SIZE, feedbackPage * FEEDBACK_PAGE_SIZE);

  useEffect(() => { setFeedbackPage(1); }, [rows]);

  const isFormScreen = screen === 'add' || screen === 'edit';
  const isBusy = listLoading || projectsLoading;

  const formFields = (
    <>
      {banner && !isFormScreen && (
        <div
          className={`mb-3 rounded-md px-2.5 py-1.5 text-xs ${
            banner.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
          }`}
        >
          {banner.message}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <label className="block min-w-0 space-y-1.5">
          <RequiredLabel>Project</RequiredLabel>
          <div className="relative">
            <select
              value={form.projectName}
              onChange={(e) => applyProjectLookup(e.target.value)}
              className={`${fieldSelectCls} text-gray-800 ${formErrors.projectName ? 'border-rose-400' : ''}`}
              disabled={saveBusy}
            >
              <option value="" disabled>
                Select
              </option>
              {form.projectName && !projectNameOptions.includes(form.projectName) && (
                <option value={form.projectName}>{form.projectName}</option>
              )}
              {projectNameOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          {formErrors.projectName && <p className={fieldErrorCls}>{formErrors.projectName}</p>}
        </label>
        <label className="block min-w-0 space-y-1.5">
          <RequiredLabel>Project Sponsor</RequiredLabel>
          <input
            readOnly
            type="text"
            value={form.sponsor}
            className={`${fieldInputReadonlyCls} ${formErrors.sponsor ? 'border-rose-400' : ''}`}
            title="LookUp(Project, ProjectSponsor) for the selected project"
          />
          {formErrors.sponsor && <p className={fieldErrorCls}>{formErrors.sponsor}</p>}
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        <label className="block min-w-0 space-y-1.5">
          <RequiredLabel>Project Manager</RequiredLabel>
          <input
            readOnly
            type="text"
            value={form.projectManager}
            className={`${fieldInputReadonlyCls} ${formErrors.projectManager ? 'border-rose-400' : ''}`}
            title="AssignToProjectManager from selected project"
          />
          {formErrors.projectManager && <p className={fieldErrorCls}>{formErrors.projectManager}</p>}
        </label>
        <label className="block min-w-0 space-y-1.5">
          <RequiredLabel>Start Date</RequiredLabel>
          <input
            readOnly
            type="date"
            value={form.startDate}
            className={`${fieldInputReadonlyCls} ${formErrors.startDate ? 'border-rose-400' : ''}`}
            title="Project start date from selected project"
          />
          {formErrors.startDate && <p className={fieldErrorCls}>{formErrors.startDate}</p>}
        </label>
        <label className="block min-w-0 space-y-1.5">
          <RequiredLabel>Business Owner Name</RequiredLabel>
          <input
            type="text"
            value={form.businessOwnerName}
            onChange={(e) => {
              setForm((f) => ({ ...f, businessOwnerName: e.target.value }));
              setFormErrors((x) => {
                const n = { ...x };
                delete n.businessOwnerName;
                return n;
              });
            }}
            maxLength={100}
            autoComplete="name"
            placeholder="Enter name"
            className={`w-full ${enj.control} text-sm text-gray-800 ${formErrors.businessOwnerName ? 'border-rose-400' : ''}`}
            title="Saved on the feedback record as Name (new_name)"
            disabled={saveBusy}
          />
          {formErrors.businessOwnerName && <p className={fieldErrorCls}>{formErrors.businessOwnerName}</p>}
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <label className="block min-w-0 space-y-1.5">
          <RequiredLabel>Satisfaction Level</RequiredLabel>
          <div className="relative">
            <select
              value={form.satisfaction}
              onChange={(e) => {
                setForm((f) => ({
                  ...f,
                  satisfaction: e.target.value as Satisfaction | '',
                }));
                setFormErrors((x) => {
                  const n = { ...x };
                  delete n.satisfaction;
                  return n;
                });
              }}
              className={`${fieldSelectCls} text-gray-800 ${formErrors.satisfaction ? 'border-rose-400' : ''}`}
              disabled={saveBusy}
            >
              <option value="" disabled>
                Select
              </option>
              <option value="Very Satisfied">Very Satisfied</option>
              <option value="Satisfied">Satisfied</option>
              <option value="Unsatisfied">Unsatisfied</option>
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          {formErrors.satisfaction && <p className={fieldErrorCls}>{formErrors.satisfaction}</p>}
        </label>
        <label className="block min-w-0 space-y-1.5">
          <RequiredLabel>Project Phase</RequiredLabel>
          <div className="relative">
            <select
              value={form.phase}
              onChange={(e) => {
                setForm((f) => ({ ...f, phase: e.target.value as Phase | '' }));
                setFormErrors((x) => {
                  const n = { ...x };
                  delete n.phase;
                  return n;
                });
              }}
              className={`${fieldSelectCls} ${formErrors.phase ? 'border-rose-400' : ''}`}
              disabled={saveBusy}
            >
              <option value="" disabled>
                Select
              </option>
              <option value="UAT">UAT</option>
              <option value="Live">Live</option>
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          {formErrors.phase && <p className={fieldErrorCls}>{formErrors.phase}</p>}
        </label>
      </div>

      <label className="block min-w-0 space-y-1.5">
        <RequiredLabel>Feedback</RequiredLabel>
        <textarea
          rows={5}
          value={form.feedback}
          onChange={(e) => {
            setForm((f) => ({ ...f, feedback: e.target.value }));
            setFormErrors((x) => {
              const n = { ...x };
              delete n.feedback;
              return n;
            });
          }}
          className={`${fieldTextareaFeedbackCls} ${formErrors.feedback ? 'border-rose-400' : ''}`}
          disabled={saveBusy}
        />
        {formErrors.feedback && <p className={fieldErrorCls}>{formErrors.feedback}</p>}
      </label>

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <label className="block min-w-0 space-y-1.5">
          <span className="text-[11px] font-medium text-gray-600">Challenges</span>
          <textarea
            rows={4}
            value={form.challenges}
            onChange={(e) => setForm((f) => ({ ...f, challenges: e.target.value }))}
            className={fieldTextareaShortCls}
            disabled={saveBusy}
          />
        </label>
        <label className="block min-w-0 space-y-1.5">
          <span className="text-[11px] font-medium text-gray-600">Recommendations</span>
          <textarea
            rows={4}
            value={form.recommendations}
            onChange={(e) => setForm((f) => ({ ...f, recommendations: e.target.value }))}
            className={fieldTextareaShortCls}
            disabled={saveBusy}
          />
        </label>
      </div>
    </>
  );

  if (isFormScreen) {
    const title = screen === 'edit' ? 'Edit Feedback' : 'Feedback';

    return (
      <div className="min-w-0 max-w-full xl:col-span-3 relative text-[12px] leading-normal text-gray-700">
        {(isBusy || saveBusy) && <ScreenLoader overlay />}
        <div className="mb-3">
          <h2 className={enj.sectionTitle}>{title}</h2>
        </div>

        {banner && (
          <div
            className={`mb-3 rounded-md px-2.5 py-1.5 text-xs ${
              banner.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
            }`}
          >
            {banner.message}
          </div>
        )}

        <div className={`${enj.card} ${enj.cardPad}`}>
          <form onSubmit={screen === 'add' ? submitFeedback : submitEditFeedback} className="space-y-4">
            {formFields}

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 pt-3">
              {screen === 'add' && (
                <>
                  <button
                    type="button"
                    onClick={clearFormAdd}
                    className={`${enj.btn} ${enj.btnOutline} min-w-[4.5rem] px-3 text-xs font-medium`}
                    disabled={saveBusy}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={goToList}
                    className={`${enj.btn} ${enj.btnOutline} min-w-[4.5rem] px-3 text-xs font-medium`}
                    disabled={saveBusy}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`${enj.btn} ${enj.btnPrimary} min-w-[7.5rem] px-3 text-xs font-medium shadow-sm hover:bg-[#9a7638] disabled:opacity-60`}
                    disabled={saveBusy}
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
                    className={`${enj.btn} ${enj.btnOutline} min-w-[4.5rem] px-3 text-xs font-medium`}
                    disabled={saveBusy}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`${enj.btn} ${enj.btnPrimary} min-w-[4.5rem] px-3 text-xs font-medium shadow-sm hover:bg-[#9a7638] disabled:opacity-60`}
                    disabled={saveBusy}
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
    <div className="flex flex-col gap-3 min-w-0 max-w-full text-[12px] leading-normal text-gray-700">
      {isBusy && <ScreenLoader overlay className="min-h-[200px] rounded-xl" />}

      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className={enj.sectionTitle}>Feedback list</h2>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={openAddFeedback}
            className={`${enj.btn} ${enj.btnPrimary} px-3 text-xs font-medium shadow-sm transition-colors hover:bg-[#9a7638]`}
            disabled={listLoading}
          >
            Add New Feedback
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className={`${enj.btn} ${enj.btnDefault} gap-1.5 px-2.5 text-xs font-medium`}
            disabled={listLoading}
          >
            <RefreshCw size={14} className="text-gray-500" />
            Refresh
          </button>
        </div>
      </div>

      {banner && (
        <div className={`rounded-md px-2.5 py-1.5 text-xs ${banner.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
          {banner.message}
        </div>
      )}

      {/* Charts — side by side like reports screen */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className={`${enj.card} p-3 chart-card`}>
          <h3 className={`${enj.subhead} mb-2 uppercase tracking-wide`}>Project phase</h3>
          <svg viewBox="0 0 220 130" className={enj.chartSvgSm}>
            {[0, 2, 4, 6, 8, 10].map((v) => (
              <g key={v}>
                <line x1="36" x2="200" y1={chartBottom - v * barScale} y2={chartBottom - v * barScale} stroke="#f1f5f9" strokeWidth="1" />
                <text x="30" y={4 + chartBottom - v * barScale} textAnchor="end" fontSize="9" fill="#94a3b8">{v}</text>
              </g>
            ))}
            <rect x="72" y={chartBottom - analytics.uat * barScale} width="36" height={analytics.uat * barScale} rx="4" fill="#2563eb" className="chart-bar" />
            <rect x="132" y={chartBottom - analytics.live * barScale} width="36" height={analytics.live * barScale} rx="4" fill="#14b8a6" className="chart-bar" />
            <text x="90" y="126" textAnchor="middle" fontSize="10" fill="#64748b">UAT</text>
            <text x="150" y="126" textAnchor="middle" fontSize="10" fill="#64748b">Live</text>
          </svg>
        </div>

        <div className={`${enj.card} p-3 chart-card`}>
          <h3 className={`${enj.subhead} mb-2 uppercase tracking-wide`}>Satisfaction level</h3>
          <div className="flex justify-center">
            <DonutChart
              className="h-48 w-48 chart-svg"
              slices={[
                { label: 'Satisfied', value: analytics.satisfied, color: '#1667de' },
                { label: 'Very Satisfied', value: analytics.verySatisfied, color: '#3b3a80' },
                { label: 'Unsatisfied', value: analytics.unsatisfied, color: '#d3525a' },
              ]}
              ringWidth={46}
              centerText={`${rows.length}`}
            />
          </div>
        </div>
      </div>

      {/* Table — full width with pagination */}
      <div className={`${enj.card} min-w-0`}>
        <table className={`${enj.tableBrand} table-fixed text-[11px]`}>
          <thead>
            <tr>
              <th className="min-w-0 w-[12%]"><span className="inline-block leading-tight">Project Name</span></th>
              <th className="min-w-0 w-[8%]"><span className="inline-block leading-tight">Sponsor</span></th>
              <th className="min-w-0 w-[20%]"><span className="inline-block leading-tight">Project Manager</span></th>
              <th className="min-w-0 w-[12%]"><span className="inline-block leading-tight">Business owner</span></th>
              <th className="min-w-0 w-[12%]"><span className="inline-block leading-tight">Satisfaction</span></th>
              <th className="min-w-0 w-[9%]"><span className="inline-block leading-tight">Date</span></th>
              <th className="min-w-0 w-[8%]"><span className="inline-block leading-tight">Phase</span></th>
              <th className="min-w-0 w-[9%] text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pagedRows.length === 0 && !listLoading && (
              <tr>
                <td colSpan={8} className="px-3 py-5 text-center text-xs text-gray-500">
                  No feedback yet. Add new feedback to get started.
                </td>
              </tr>
            )}
            {pagedRows.map((row) => (
              <tr key={row.id} className="text-gray-700 hover:bg-gray-50/80">
                <td className="min-w-0 break-words px-2 py-2 align-top font-medium text-primary sm:px-2.5">{row.projectName}</td>
                <td className="min-w-0 break-words px-2 py-2 align-top text-gray-600 sm:px-2.5">{row.sponsor}</td>
                <td className="min-w-0 px-2 py-2 align-top sm:px-2.5">
                  <div className="flex min-w-0 items-start gap-1.5">
                    <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-[8px] font-semibold text-gray-600">{row.pmInitials}</span>
                    <span className="min-w-0 break-words text-[10px] text-gray-600 leading-snug">{row.pmEmail}</span>
                  </div>
                </td>
                <td className="min-w-0 break-words px-2 py-2 align-top text-gray-700 sm:px-2.5">{row.businessOwnerName}</td>
                <td className="min-w-0 px-2 py-2 align-top sm:px-2.5">
                  <span className={`${satisfactionClass(row.satisfaction)} max-w-full`}>{row.satisfaction}</span>
                </td>
                <td className="min-w-0 break-words px-2 py-2 align-top text-gray-600 sm:px-2.5">{row.date}</td>
                <td className="min-w-0 px-2 py-2 align-top sm:px-2.5">
                  <span className={phaseClass(row.phase)}>{row.phase}</span>
                </td>
                <td className="px-2 py-2 text-center align-top sm:px-2.5">
                  <button type="button" onClick={() => openEditFeedback(row)} className="inline-flex rounded-md p-0.5 text-gray-400 hover:bg-gray-100 hover:text-primary" aria-label="Edit">
                    <Pencil size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-gray-100 px-4 py-3">
          <PagerBar
            page={feedbackPage}
            pageSize={FEEDBACK_PAGE_SIZE}
            total={rows.length}
            onPrev={() => setFeedbackPage((p) => Math.max(1, p - 1))}
            onNext={() => setFeedbackPage((p) => Math.min(feedbackTotalPages, p + 1))}
          />
        </div>
      </div>
    </div>
  );
}
