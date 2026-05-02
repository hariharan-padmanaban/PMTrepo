import { useEffect, useMemo, useRef, useState } from 'react';
import { New_meetingdetailsService } from './generated/services/New_meetingdetailsService';
import { New_projectsService } from './generated/services/New_projectsService';
import { New_vendorsService } from './generated/services/New_vendorsService';
import { EnjazMasterDataService } from './services/EnjazMasterDataService';
import { postMeetingRequestToFlow } from './services/powerAutomateMeeting';
import { NewUsersService, type NewUserRow } from './services/NewUsersService';
import type { ToastType } from './NotificationToast';
import { enj } from './ui/enjForm';

type AddMeetingFormPanelProps = {
  parentLabel: string;
  onCancel: () => void;
  onCreated?: () => void | Promise<void>;
  onNotify: (type: ToastType, message: string) => void;
};

const DEPARTMENT_OPTIONS = ['Team', 'Business', 'Program', 'Project'] as const;
const MEETING_REPEAT_OPTIONS = ['Does not Repeat', 'Repeat'] as const;

const MEETING_DEPARTMENT_CODE: Record<(typeof DEPARTMENT_OPTIONS)[number], number> = {
  Team: 100000000,
  Business: 100000001,
  Project: 100000002,
  Program: 100000003,
};

function distinctSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

function userDepartmentLabel(row: NewUserRow): (typeof DEPARTMENT_OPTIONS)[number] | '' {
  const name = String(row.new_rolename ?? '').trim().toLowerCase();
  if (name === 'team') return 'Team';
  if (name === 'business') return 'Business';
  if (name === 'program') return 'Program';
  if (name === 'project') return 'Project';
  const code = String(row.new_role ?? '').trim();
  if (code === '100000004') return 'Team';
  if (code === '100000001') return 'Business';
  if (code === '100000002') return 'Program';
  if (code === '100000003') return 'Project';
  return '';
}

function joinDateAndTimeToIso(dateText: string, timeText: string) {
  if (!dateText || !timeText) return undefined;
  const d = new Date(`${dateText}T${timeText}:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function hourDiff(start: string, end: string) {
  if (!start || !end) return undefined;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if (![sh, sm, eh, em].every(Number.isFinite)) return undefined;
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  if (e <= s) return undefined;
  return Math.round(((e - s) / 60) * 100) / 100;
}

type MultiSelectComboProps = {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  disabled?: boolean;
};

function MultiSelectCombo({ label, options, selected, onChange, placeholder, disabled }: MultiSelectComboProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const hostRef = useRef<HTMLDivElement>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = useMemo(
    () => (normalizedQuery ? options.filter((v) => v.toLowerCase().includes(normalizedQuery)) : options),
    [options, normalizedQuery],
  );

  useEffect(() => {
    const onDocClick = (ev: MouseEvent) => {
      const target = ev.target as Node | null;
      if (!target) return;
      if (!hostRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const toggle = (value: string) => {
    if (selected.includes(value)) onChange(selected.filter((v) => v !== value));
    else onChange([...selected, value]);
  };

  return (
    <label className="block">
      <span className="text-[11px] text-gray-500 mb-1 block">{label}</span>
      <div ref={hostRef} className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className={`${enj.btnDefault} h-auto min-h-9 w-full justify-start px-3 text-left text-sm font-normal text-gray-700 disabled:opacity-60`}
        >
          {selected.length === 0 ? (
            <span className="text-gray-400">{placeholder}</span>
          ) : (
            <span className="flex flex-wrap gap-1">
              {selected.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] text-gray-700"
                >
                  {item}
                </span>
              ))}
            </span>
          )}
        </button>
        {open && !disabled && (
          <div className="absolute z-30 mt-1 w-full rounded-md border border-gray-200 bg-white p-2 shadow-lg">
            <input
              className={`${enj.control} mb-2`}
              placeholder="Search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="max-h-40 overflow-auto space-y-1">
              {filteredOptions.length === 0 ? (
                <p className="px-2 py-1 text-[11px] text-gray-400">No options</p>
              ) : (
                filteredOptions.map((opt) => (
                  <label key={opt} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={selected.includes(opt)}
                      onChange={() => toggle(opt)}
                      className="h-3.5 w-3.5 rounded border-gray-300"
                    />
                    <span className="text-xs text-gray-700">{opt}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </label>
  );
}

export function AddMeetingFormPanel({ parentLabel, onCancel, onCreated, onNotify }: AddMeetingFormPanelProps) {
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);

  const [meetingTitle, setMeetingTitle] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);
  const [meetingCategory, setMeetingCategory] = useState('');
  const [projectName, setProjectName] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [projectManager, setProjectManager] = useState('');
  const [inviteMembers, setInviteMembers] = useState<string[]>([]);
  const [meetingRepeat, setMeetingRepeat] = useState<(typeof MEETING_REPEAT_OPTIONS)[number]>('Does not Repeat');
  const [meetingDate, setMeetingDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [meetingLocation, setMeetingLocation] = useState('');
  const [agenda, setAgenda] = useState('');

  const [meetingCategoryOptions, setMeetingCategoryOptions] = useState<string[]>([]);
  const [projectRows, setProjectRows] = useState<Array<Record<string, unknown>>>([]);
  const [projectOptions, setProjectOptions] = useState<string[]>([]);
  const [vendorOptions, setVendorOptions] = useState<string[]>([]);
  const [usersRows, setUsersRows] = useState<NewUserRow[]>([]);
  const [formErrors, setFormErrors] = useState<{
    meetingTitle?: string;
    departments?: string;
    meetingCategory?: string;
    meetingDate?: string;
    startTime?: string;
    endTime?: string;
    inviteMembers?: string;
  }>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingOptions(true);
      try {
        const [masterRes, projectsRes, vendorsRes, usersRes] = await Promise.all([
          EnjazMasterDataService.getAll({ top: 2000, orderBy: ['new_enjazmasterdata1 asc'] }),
          New_projectsService.getAll({ top: 2000, orderBy: ['createdon desc'] }),
          New_vendorsService.getAll({ top: 1000, orderBy: ['createdon desc'] }),
          NewUsersService.getAll({ top: 2000, orderBy: ['createdon desc'] }),
        ]);
        if (cancelled) return;

        const categories = (masterRes.success ? masterRes.data ?? [] : [])
          .filter((r) => {
            const cType = String(r.new_categorytype ?? '').trim().toLowerCase();
            const cName = String(r.new_categoryname ?? '').trim().toLowerCase();
            const cCode = Number(r.new_category ?? NaN);
            const statusCode = Number(r.new_status ?? NaN);
            const statusName = String(r.new_statusname ?? '').trim().toLowerCase();
            const isMeetingCategory = cType === 'meeting category' || cType === 'meetingcategory' || cName === 'meeting category' || cCode === 100000008;
            const isActive = statusCode === 100000000 || statusName === 'active';
            return isMeetingCategory && isActive;
          })
          .map((r) => String(r.new_enjazmasterdata1 ?? '').trim());
        setMeetingCategoryOptions(distinctSorted(categories));

        const pRows = projectsRes.success ? ((projectsRes.data ?? []) as unknown as Array<Record<string, unknown>>) : [];
        setProjectRows(pRows);
        setProjectOptions(distinctSorted(pRows.map((r) => String(r.new_projectname ?? r.new_name ?? '').trim())));

        const vRows = vendorsRes.success ? ((vendorsRes.data ?? []) as unknown as Array<Record<string, unknown>>) : [];
        const activeVendors = vRows.filter((r) => {
          const appStatus = String(r.new_appstatus ?? '').trim().toLowerCase();
          const statusCode = Number(r.new_status ?? NaN);
          const statusName = String(r.new_statusname ?? '').trim().toLowerCase();
          return appStatus === 'active' || statusCode === 100000000 || statusName === 'active';
        });
        const source = activeVendors.length > 0 ? activeVendors : vRows;
        setVendorOptions(distinctSorted(source.map((r) => String(r.new_vendorname ?? '').trim())));

        setUsersRows(usersRes.success ? usersRes.data ?? [] : []);
      } catch {
        if (!cancelled) {
          setMeetingCategoryOptions([]);
          setProjectRows([]);
          setProjectOptions([]);
          setVendorOptions([]);
          setUsersRows([]);
        }
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const selectedProject = projectRows.find(
      (r) => String(r.new_projectname ?? r.new_name ?? '').trim().toLowerCase() === projectName.trim().toLowerCase(),
    );
    const pm = String(
      selectedProject?.crcf8_projectmanager
        ?? selectedProject?.new_projectmanagername
        ?? selectedProject?.new_programmanager
        ?? selectedProject?.new_programmanagername
        ?? '',
    ).trim();
    setProjectManager(pm);
  }, [projectName, projectRows]);

  const inviteOptions = useMemo(() => {
    if (departments.length === 0) return [];
    return distinctSorted(
      usersRows
        .filter((u) => departments.includes(userDepartmentLabel(u)))
        .map((u) => String(u.new_newcolumn ?? u.new_userid ?? '').trim())
        .filter((v) => v.includes('@')),
    );
  }, [usersRows, departments]);

  useEffect(() => {
    setInviteMembers((prev) => prev.filter((v) => inviteOptions.includes(v)));
  }, [inviteOptions]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: {
      meetingTitle?: string;
      departments?: string;
      meetingCategory?: string;
      meetingDate?: string;
      startTime?: string;
      endTime?: string;
      inviteMembers?: string;
    } = {};
    if (!meetingTitle.trim()) nextErrors.meetingTitle = 'Meeting Title is required';
    if (departments.length === 0) nextErrors.departments = 'Select at least one department';
    if (!meetingCategory.trim()) nextErrors.meetingCategory = 'Meeting Category is required';
    if (!meetingDate) nextErrors.meetingDate = 'Meeting Date is required';
    if (!startTime) nextErrors.startTime = 'Start Time is required';
    if (!endTime) nextErrors.endTime = 'End Time is required';
    if (departments.length > 0 && inviteMembers.length === 0) nextErrors.inviteMembers = 'Select at least one invite member';
    if (startTime && endTime && hourDiff(startTime, endTime) === undefined) {
      nextErrors.endTime = 'End Time must be later than Start Time';
    }
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      const hasFlowUrl = Boolean((import.meta.env.VITE_POWER_AUTOMATE_TEAMS_MEETING_URL as string | undefined)?.trim());
      const flowRes = hasFlowUrl
        ? await postMeetingRequestToFlow({
            meetingTitle: meetingTitle.trim(),
            meetingCategory: meetingCategory.trim() || undefined,
            projectName: projectName.trim() || undefined,
            vendorName: vendorName.trim() || undefined,
            projectManager: projectManager.trim() || undefined,
            inviteMembers,
            department: departments,
            repeat: meetingRepeat,
            meetingDate,
            startTime,
            endTime,
            meetingLocation: meetingLocation.trim() || undefined,
            agenda: agenda.trim() || undefined,
          })
        : { ok: true as const, teamsJoinUrl: undefined, teamsMeetingId: undefined };
      if (!flowRes.ok) throw new Error(flowRes.error);

      const payload: Record<string, unknown> = {
        new_meetingtitle: meetingTitle.trim(),
        new_meetingcategory: meetingCategory.trim(),
        new_projectname: projectName.trim() || undefined,
        new_vendorname: vendorName.trim() || undefined,
        new_programmanager: projectManager.trim() || undefined,
        new_invitememberemails: inviteMembers.join('; ') || undefined,
        new_department:
          departments.length > 0
            ? (MEETING_DEPARTMENT_CODE[departments[0] as keyof typeof MEETING_DEPARTMENT_CODE] as 100000000 | 100000001 | 100000002 | 100000003)
            : undefined,
        new_meetingtype: meetingRepeat,
        new_meetingdate: new Date(`${meetingDate}T00:00:00`).toISOString(),
        new_starttime: startTime,
        new_endtime: endTime,
        new_meetingdatetime: joinDateAndTimeToIso(meetingDate, startTime),
        new_durationhours: hourDiff(startTime, endTime),
        new_meetinglocation: meetingLocation.trim() || undefined,
        new_meetingagenda: agenda.trim() || undefined,
        new_meetinglink: flowRes.teamsJoinUrl,
        new_meetingtitle_1: flowRes.teamsMeetingId,
        statecode: 0,
      };
      const res = await New_meetingdetailsService.create(
        payload as unknown as Parameters<typeof New_meetingdetailsService.create>[0],
      );
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to create meeting');
      if (flowRes.teamsJoinUrl) {
        onNotify('success', 'Meeting added and Teams invite created.');
      } else if (hasFlowUrl) {
        onNotify('success', 'Meeting added successfully.');
      } else {
        onNotify('success', 'Meeting added successfully. (Flow URL not configured, so Teams invite was skipped.)');
      }
      if (onCreated) await onCreated();
      onCancel();
    } catch (error) {
      onNotify('error', error instanceof Error ? error.message : 'Failed to create meeting');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-white rounded-xl p-5 shadow-sm max-w-5xl mx-auto">
      <p className="text-[16px] font-bold text-primary mb-4">
        <button className="underline text-primary font-semibold" onClick={onCancel}>
          {parentLabel}
        </button>
        {' > '}Add New Meeting
      </p>
      <form onSubmit={onSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3">
          <label className="block">
            <span className="text-[11px] text-gray-500 mb-1 block">Meeting Title *</span>
            <input
              className={`${enj.control} text-gray-700`}
              placeholder="Enter Meeting Title"
              value={meetingTitle}
              onChange={(e) => {
                setMeetingTitle(e.target.value);
                setFormErrors((prev) => ({ ...prev, meetingTitle: undefined }));
              }}
            />
            {formErrors.meetingTitle && <p className="mt-1 text-[11px] text-rose-600">{formErrors.meetingTitle}</p>}
          </label>
          <MultiSelectCombo
            label="Department"
            options={[...DEPARTMENT_OPTIONS]}
            selected={departments}
            onChange={(next) => {
              setDepartments(next);
              setFormErrors((prev) => ({ ...prev, departments: undefined }));
            }}
            placeholder="Select department(s)"
            disabled={loadingOptions}
          />
          {formErrors.departments && <p className="-mt-2 text-[11px] text-rose-600">{formErrors.departments}</p>}
          <label className="block">
            <span className="text-[11px] text-gray-500 mb-1 block">Meeting Category *</span>
            <select
              className={`${enj.control} text-gray-700`}
              value={meetingCategory}
              onChange={(e) => {
                setMeetingCategory(e.target.value);
                setFormErrors((prev) => ({ ...prev, meetingCategory: undefined }));
              }}
            >
              <option value="">{loadingOptions ? 'Loading...' : 'Select Category'}</option>
              {meetingCategoryOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            {formErrors.meetingCategory && <p className="mt-1 text-[11px] text-rose-600">{formErrors.meetingCategory}</p>}
          </label>
          <label className="block">
            <span className="text-[11px] text-gray-500 mb-1 block">Project Name</span>
            <select
              className={`${enj.control} text-gray-700`}
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            >
              <option value="">{loadingOptions ? 'Loading...' : 'Select Project Name'}</option>
              {projectOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] text-gray-500 mb-1 block">Vendor Name</span>
            <select
              className={`${enj.control} text-gray-700`}
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
            >
              <option value="">{loadingOptions ? 'Loading...' : 'Select Vendor Name'}</option>
              {vendorOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] text-gray-500 mb-1 block">Project Manager</span>
            <input
              readOnly
              className={`${enj.control} cursor-default bg-gray-50 text-gray-700`}
              placeholder="Auto Fetch"
              value={projectManager}
            />
          </label>
          <MultiSelectCombo
            label="Invite Members"
            options={inviteOptions}
            selected={inviteMembers}
            onChange={(next) => {
              setInviteMembers(next);
              setFormErrors((prev) => ({ ...prev, inviteMembers: undefined }));
            }}
            placeholder={departments.length > 0 ? 'Select member(s)' : 'Select department first'}
            disabled={departments.length === 0}
          />
          {formErrors.inviteMembers && <p className="-mt-2 text-[11px] text-rose-600">{formErrors.inviteMembers}</p>}
          <label className="block">
            <span className="text-[11px] text-gray-500 mb-1 block">Repeat</span>
            <select
              className={`${enj.control} text-gray-700`}
              value={meetingRepeat}
              onChange={(e) => setMeetingRepeat(e.target.value as (typeof MEETING_REPEAT_OPTIONS)[number])}
            >
              {MEETING_REPEAT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] text-gray-500 mb-1 block">Meeting Date *</span>
            <input
              type="date"
              className={`${enj.control} text-gray-700`}
              value={meetingDate}
              onChange={(e) => {
                setMeetingDate(e.target.value);
                setFormErrors((prev) => ({ ...prev, meetingDate: undefined }));
              }}
            />
            {formErrors.meetingDate && <p className="mt-1 text-[11px] text-rose-600">{formErrors.meetingDate}</p>}
          </label>
          <label className="block">
            <span className="text-[11px] text-gray-500 mb-1 block">Start Time *</span>
            <input
              type="time"
              className={`${enj.control} text-gray-700`}
              value={startTime}
              onChange={(e) => {
                setStartTime(e.target.value);
                setFormErrors((prev) => ({ ...prev, startTime: undefined }));
              }}
            />
            {formErrors.startTime && <p className="mt-1 text-[11px] text-rose-600">{formErrors.startTime}</p>}
          </label>
          <label className="block">
            <span className="text-[11px] text-gray-500 mb-1 block">End Time *</span>
            <input
              type="time"
              className={`${enj.control} text-gray-700`}
              value={endTime}
              onChange={(e) => {
                setEndTime(e.target.value);
                setFormErrors((prev) => ({ ...prev, endTime: undefined }));
              }}
            />
            {formErrors.endTime && <p className="mt-1 text-[11px] text-rose-600">{formErrors.endTime}</p>}
          </label>
        </div>
        <label className="block mt-3">
          <span className="text-[11px] text-gray-500 mb-1 block">Meeting Location</span>
          <input
            className={`${enj.control} text-gray-700`}
            placeholder="Enter Meeting Location"
            value={meetingLocation}
            onChange={(e) => setMeetingLocation(e.target.value)}
          />
        </label>
        <label className="block mt-3">
          <span className="text-[11px] text-gray-500 mb-1 block">Meeting Agenda</span>
          <textarea
            className={`${enj.textarea} h-20 min-h-[5rem] resize-none text-gray-700`}
            placeholder="Agenda..."
            value={agenda}
            onChange={(e) => setAgenda(e.target.value)}
          />
        </label>
        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className={`${enj.btnOutline} min-w-[5.5rem] px-6 font-semibold`}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className={`${enj.btnPrimary} min-w-[5.5rem] px-6 font-semibold`}
          >
            {saving ? 'Saving...' : 'Add to Calendar'}
          </button>
        </div>
      </form>
    </section>
  );
}
