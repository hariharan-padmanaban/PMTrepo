import { DatePickerField } from './EnjDatePicker';
import { enj } from './ui/enjForm';

export type ProgramFormState = {
  programName: string;
  benefits: string;
  programManager: string;
  budget: string;
  startDate: string;
  endDate: string;
  roi: string;
  kpi: string;
  status: string;
  progress: string;
};

function FieldLabel({ label, required = false }: { label: string; required?: boolean }) {
  return (
    <label className="mb-1 block text-[13px] font-normal leading-normal text-gray-600">
      {label}
      {required ? <span className="text-rose-500"> *</span> : null}
    </label>
  );
}

type StatusOption = { label: string; value: number };

export function ProgramFormPanel({
  mode,
  form,
  setForm,
  errors,
  busy,
  formMsg,
  todayIso,
  benefitsOptions,
  kpiOptions,
  programManagerEmailOptions,
  statusOptions,
  onCancel,
  onClear,
  onSave,
}: {
  mode: 'add' | 'edit';
  form: ProgramFormState;
  setForm: React.Dispatch<React.SetStateAction<ProgramFormState>>;
  errors: Partial<Record<keyof ProgramFormState, string>>;
  busy: boolean;
  formMsg?: string;
  todayIso: string;
  benefitsOptions: string[];
  kpiOptions: string[];
  programManagerEmailOptions: string[];
  statusOptions: StatusOption[];
  onCancel: () => void;
  onClear: () => void;
  onSave: () => void;
}) {
  const title = mode === 'edit' ? 'Edit Program' : 'Add New Program';
  const managerOptions = Array.from(
    new Set([...programManagerEmailOptions, form.programManager].filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));

  return (
    <div className="enj-add-project-root">
      <div className="enj-add-project-scroll">
        <div className="enj-add-project-shell">
          <section className="enj-add-project-card">
            <p className="enj-add-project-breadcrumb">
              <button type="button" onClick={onCancel}>Program</button>
              {' > '}{title}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <FieldLabel label="Program Name" required />
                <input
                  className={`enj-add-project-field mt-1 ${enj.control}`}
                  placeholder="Enter Program Name"
                  value={form.programName}
                  onChange={(e) => setForm((f) => ({ ...f, programName: e.target.value }))}
                />
                {errors.programName && <p className={`mt-1 ${enj.fieldError}`}>{errors.programName}</p>}
              </div>
              <div>
                <FieldLabel label="Benefits" required />
                <select
                  className={`enj-add-project-field mt-1 ${enj.control}`}
                  value={form.benefits}
                  onChange={(e) => setForm((f) => ({ ...f, benefits: e.target.value }))}
                >
                  <option value="">Select Benefits</option>
                  {benefitsOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                {errors.benefits && <p className={`mt-1 ${enj.fieldError}`}>{errors.benefits}</p>}
              </div>
              <div>
                <FieldLabel label="Project Manager" required />
                <select
                  className={`enj-add-project-field mt-1 ${enj.control}`}
                  value={form.programManager}
                  onChange={(e) => setForm((f) => ({ ...f, programManager: e.target.value }))}
                >
                  <option value="">Select Project Manager</option>
                  {managerOptions.map((email) => <option key={email} value={email}>{email}</option>)}
                </select>
                {errors.programManager && <p className={`mt-1 ${enj.fieldError}`}>{errors.programManager}</p>}
              </div>
              <div>
                <FieldLabel label="Budget" required />
                <div className="enj-add-project-budget-wrap mt-1 flex h-9 overflow-hidden rounded-md border border-[#ADACB4] bg-white">
                  <input
                    className="enj-add-project-budget-input h-full min-h-0 flex-1 border-0 bg-transparent px-3 outline-none focus:outline-none focus:ring-0"
                    placeholder="Enter Budget"
                    value={form.budget}
                    inputMode="decimal"
                    onChange={(e) => {
                      const next = e.target.value;
                      if (/^\d*\.?\d*$/.test(next)) setForm((f) => ({ ...f, budget: next }));
                    }}
                  />
                  <span className="enj-add-project-muted w-12 border-l border-[#ADACB4] flex items-center justify-center">AED</span>
                </div>
                {errors.budget && <p className={`mt-1 ${enj.fieldError}`}>{errors.budget}</p>}
              </div>
              <div>
                <FieldLabel label="Start Date" required />
                <DatePickerField
                  min={mode === 'add' ? todayIso : undefined}
                  className={`enj-add-project-field mt-1 ${enj.control}`}
                  value={form.startDate}
                  onChange={(v) => setForm((f) => ({ ...f, startDate: v }))}
                />
                {errors.startDate && <p className={`mt-1 ${enj.fieldError}`}>{errors.startDate}</p>}
              </div>
              <div>
                <FieldLabel label="End Date" required />
                <DatePickerField
                  min={form.startDate || (mode === 'add' ? todayIso : undefined)}
                  className={`enj-add-project-field mt-1 ${enj.control}`}
                  value={form.endDate}
                  onChange={(v) => setForm((f) => ({ ...f, endDate: v }))}
                />
                {errors.endDate && <p className={`mt-1 ${enj.fieldError}`}>{errors.endDate}</p>}
              </div>
              <div>
                <FieldLabel label="ROI" required />
                <input
                  className={`enj-add-project-field mt-1 ${enj.control}`}
                  placeholder="Enter ROI Value"
                  value={form.roi}
                  onChange={(e) => setForm((f) => ({ ...f, roi: e.target.value }))}
                />
                {errors.roi && <p className={`mt-1 ${enj.fieldError}`}>{errors.roi}</p>}
              </div>
              <div>
                <FieldLabel label="KPI" required />
                <select
                  className={`enj-add-project-field mt-1 ${enj.control}`}
                  value={form.kpi}
                  onChange={(e) => setForm((f) => ({ ...f, kpi: e.target.value }))}
                >
                  <option value="">Select KPI</option>
                  {kpiOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                {errors.kpi && <p className={`mt-1 ${enj.fieldError}`}>{errors.kpi}</p>}
              </div>
              <div>
                <FieldLabel label="Program Status" required />
                <select
                  className={`enj-add-project-field mt-1 ${enj.control}`}
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="">Select Program Status</option>
                  {statusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {errors.status && <p className={`mt-1 ${enj.fieldError}`}>{errors.status}</p>}
              </div>
              <div>
                <FieldLabel label="Progress (%)" />
                <input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="Enter Progress"
                  className={`enj-add-project-field mt-1 ${enj.control}`}
                  value={form.progress}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '' || /^\d{0,3}$/.test(raw)) {
                      setForm((f) => ({ ...f, progress: raw }));
                    }
                  }}
                  onBlur={() => {
                    const n = Number(form.progress);
                    if (form.progress !== '' && (n < 0 || n > 100)) {
                      setForm((f) => ({ ...f, progress: String(Math.max(0, Math.min(100, n))) }));
                    }
                  }}
                />
                {errors.progress && <p className={`mt-1 ${enj.fieldError}`}>{errors.progress}</p>}
              </div>
            </div>

            {formMsg && <p className="enj-add-project-muted mt-4">{formMsg}</p>}

            <div className="enj-add-project-actions mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                className={`${enj.btn} ${enj.btnOutline} px-8 font-semibold`}
                onClick={onCancel}
                disabled={busy}
              >
                Cancel
              </button>
              {mode === 'add' && (
                <button
                  type="button"
                  className={`${enj.btn} ${enj.btnOutline} px-8 font-semibold`}
                  onClick={onClear}
                  disabled={busy}
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                className={`${enj.btn} ${enj.btnPrimary} px-8 font-semibold disabled:opacity-50`}
                onClick={onSave}
                disabled={busy}
              >
                {busy ? 'Saving...' : mode === 'edit' ? 'Save' : '+ Save'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
