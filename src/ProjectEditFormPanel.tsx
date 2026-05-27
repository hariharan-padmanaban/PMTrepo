import type { RefObject } from 'react';
import { Download, Paperclip, Trash2 } from 'lucide-react';
import { DatePickerField } from './EnjDatePicker';
import { enj } from './ui/enjForm';
import type { AttachmentFile } from './services/attachmentService';

export type EditProjectFormState = {
  projectName: string;
  programName: string;
  vendorName: string;
  projectPriority: string;
  projectCategory: string;
  projectType: string;
  strategicGoal: string;
  budget: string;
  assignToProjectManager: string;
  risks: string;
  kpi: string;
  methodology: string;
  startDate: string;
  endDate: string;
  department: string;
  projectStatus: string;
  milestone: string[];
  projectSponsor: string;
  note: string;
  attachments: File[];
  existingAttachments: AttachmentFile[];
  description: string;
  progress: string;
};

export function createEmptyEditProjectForm(): EditProjectFormState {
  return {
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
    startDate: '',
    endDate: '',
    department: '',
    projectStatus: '',
    milestone: [],
    projectSponsor: '',
    note: '',
    attachments: [],
    existingAttachments: [],
    description: '',
    progress: '',
  };
}

function FieldLabel({ label, required = false }: { label: string; required?: boolean }) {
  return (
    <label className="mb-1 block text-[13px] font-normal leading-normal text-gray-600">
      {label}
      {required ? <span className="text-rose-500"> *</span> : null}
    </label>
  );
}

type ChoiceOption = { label: string; value: number };
type VendorOption = { value: string; label: string };

export function ProjectEditFormPanel({
  form,
  setForm,
  errors,
  budgetProgramError,
  metaLoading,
  busy,
  onCancel,
  onSave,
  milestoneOpen,
  setMilestoneOpen,
  milestoneOptions,
  programOptions,
  vendorOptions,
  projectPriorityOptions,
  projectCategoryOptions,
  projectTypeOptions,
  strategicGoalOptions,
  projectStatusOptions,
  kpiOptions,
  methodologyOptions,
  departmentOptions,
  projectManagerEmails,
  projectSponsorOptions,
  fileInputRef,
}: {
  form: EditProjectFormState;
  setForm: React.Dispatch<React.SetStateAction<EditProjectFormState>>;
  errors: Record<string, string>;
  budgetProgramError?: string;
  metaLoading: boolean;
  busy: boolean;
  onCancel: () => void;
  onSave: () => void;
  milestoneOpen: boolean;
  setMilestoneOpen: React.Dispatch<React.SetStateAction<boolean>>;
  milestoneOptions: string[];
  programOptions: string[];
  vendorOptions: VendorOption[];
  projectPriorityOptions: ChoiceOption[];
  projectCategoryOptions: string[];
  projectTypeOptions: ChoiceOption[];
  strategicGoalOptions: ChoiceOption[];
  projectStatusOptions: ChoiceOption[];
  kpiOptions: string[];
  methodologyOptions: string[];
  departmentOptions: string[];
  projectManagerEmails: string[];
  projectSponsorOptions: VendorOption[];
  fileInputRef: RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="enj-add-project-root flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
      <div className="enj-add-project-scroll">
        <div className="enj-add-project-shell">
          <section className="enj-add-project-card">
            <p className="enj-add-project-breadcrumb">
              <button type="button" onClick={onCancel}>Projects</button>
              {' > '}Edit Project
            </p>
            {metaLoading && <p className="enj-add-project-muted mb-3">Loading dropdown values...</p>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <FieldLabel label="Project Name" required />
                <input
                  className={`enj-add-project-field mt-1 ${enj.control}`}
                  placeholder="Enter Project Name"
                  value={form.projectName}
                  onChange={(e) => setForm((f) => ({ ...f, projectName: e.target.value }))}
                />
                {errors.projectName && <p className={`mt-1 ${enj.fieldError}`}>{errors.projectName}</p>}
              </div>
              <div>
                <FieldLabel label="Program Name" required />
                <select
                  className={`enj-add-project-field mt-1 ${enj.control}`}
                  value={form.programName}
                  onChange={(e) => setForm((f) => ({ ...f, programName: e.target.value }))}
                >
                  <option value="">Select Program Name</option>
                  {programOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                {errors.programName && <p className={`mt-1 ${enj.fieldError}`}>{errors.programName}</p>}
              </div>
              <div>
                <FieldLabel label="Vendor Name" required />
                <select
                  className={`enj-add-project-field mt-1 ${enj.control}`}
                  value={form.vendorName}
                  onChange={(e) => setForm((f) => ({ ...f, vendorName: e.target.value }))}
                >
                  <option value="">Select Vendor Name</option>
                  {form.vendorName && !vendorOptions.some((o) => o.value === form.vendorName) && (
                    <option value={form.vendorName}>{form.vendorName}</option>
                  )}
                  {vendorOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
                {errors.vendorName && <p className={`mt-1 ${enj.fieldError}`}>{errors.vendorName}</p>}
              </div>
              <div>
                <FieldLabel label="Project Priority" required />
                <select
                  className={`enj-add-project-field mt-1 ${enj.control}`}
                  value={form.projectPriority}
                  onChange={(e) => setForm((f) => ({ ...f, projectPriority: e.target.value }))}
                >
                  <option value="">Select Project Priority</option>
                  {projectPriorityOptions.map((opt) => (
                    <option key={opt.value} value={String(opt.value)}>{opt.label}</option>
                  ))}
                </select>
                {errors.projectPriority && <p className={`mt-1 ${enj.fieldError}`}>{errors.projectPriority}</p>}
              </div>
              <div>
                <FieldLabel label="Project Category" required />
                <select
                  className={`enj-add-project-field mt-1 ${enj.control}`}
                  value={form.projectCategory}
                  onChange={(e) => setForm((f) => ({ ...f, projectCategory: e.target.value }))}
                >
                  <option value="">Select Project Category</option>
                  {projectCategoryOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                {errors.projectCategory && <p className={`mt-1 ${enj.fieldError}`}>{errors.projectCategory}</p>}
              </div>
              <div>
                <FieldLabel label="Project Type" required />
                <select
                  className={`enj-add-project-field mt-1 ${enj.control}`}
                  value={form.projectType}
                  onChange={(e) => setForm((f) => ({ ...f, projectType: e.target.value }))}
                >
                  <option value="">Select Project Type</option>
                  {projectTypeOptions.map((opt) => (
                    <option key={opt.value} value={String(opt.value)}>{opt.label}</option>
                  ))}
                </select>
                {errors.projectType && <p className={`mt-1 ${enj.fieldError}`}>{errors.projectType}</p>}
              </div>
              <div>
                <FieldLabel label="Strategic Goal" required />
                <select
                  className={`enj-add-project-field mt-1 ${enj.control}`}
                  value={form.strategicGoal}
                  onChange={(e) => setForm((f) => ({ ...f, strategicGoal: e.target.value }))}
                >
                  <option value="">Select Strategic Goal</option>
                  {strategicGoalOptions.map((opt) => (
                    <option key={opt.value} value={String(opt.value)}>{opt.label}</option>
                  ))}
                </select>
                {errors.strategicGoal && <p className={`mt-1 ${enj.fieldError}`}>{errors.strategicGoal}</p>}
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
                {(errors.budget || budgetProgramError) && (
                  <p className={`mt-1 ${enj.fieldError}`}>{errors.budget || budgetProgramError}</p>
                )}
              </div>
              <div>
                <FieldLabel label="Assign to Project Manager" required />
                <select
                  className={`enj-add-project-field mt-1 ${enj.control}`}
                  value={form.assignToProjectManager}
                  onChange={(e) => setForm((f) => ({ ...f, assignToProjectManager: e.target.value }))}
                >
                  <option value="">Select Project Manager</option>
                  {projectManagerEmails.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                {errors.assignToProjectManager && (
                  <p className={`mt-1 ${enj.fieldError}`}>{errors.assignToProjectManager}</p>
                )}
              </div>
              <div>
                <FieldLabel label="Risks" required />
                <input
                  className={`enj-add-project-field mt-1 ${enj.control}`}
                  placeholder="Enter Risks"
                  value={form.risks}
                  onChange={(e) => setForm((f) => ({ ...f, risks: e.target.value }))}
                />
                {errors.risks && <p className={`mt-1 ${enj.fieldError}`}>{errors.risks}</p>}
              </div>
              <div>
                <FieldLabel label="KPI" />
                <select
                  className={`enj-add-project-field mt-1 ${enj.control}`}
                  value={form.kpi}
                  onChange={(e) => setForm((f) => ({ ...f, kpi: e.target.value }))}
                >
                  <option value="">Select KPI</option>
                  {kpiOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel label="Methodology" required />
                <select
                  className={`enj-add-project-field mt-1 ${enj.control}`}
                  value={form.methodology}
                  onChange={(e) => setForm((f) => ({ ...f, methodology: e.target.value }))}
                >
                  <option value="">Select Methodology</option>
                  {methodologyOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                {errors.methodology && <p className={`mt-1 ${enj.fieldError}`}>{errors.methodology}</p>}
              </div>
              <div>
                <FieldLabel label="Start Date" required />
                <DatePickerField
                  className={`enj-add-project-field mt-1 ${enj.control}`}
                  value={form.startDate}
                  onChange={(v) => setForm((f) => ({ ...f, startDate: v }))}
                />
                {errors.startDate && <p className={`mt-1 ${enj.fieldError}`}>{errors.startDate}</p>}
              </div>
              <div>
                <FieldLabel label="End Date" required />
                <DatePickerField
                  min={form.startDate || undefined}
                  className={`enj-add-project-field mt-1 ${enj.control}`}
                  value={form.endDate}
                  onChange={(v) => setForm((f) => ({ ...f, endDate: v }))}
                />
                {errors.endDate && <p className={`mt-1 ${enj.fieldError}`}>{errors.endDate}</p>}
              </div>
              <div>
                <FieldLabel label="Department" required />
                <select
                  className={`enj-add-project-field mt-1 ${enj.control}`}
                  value={form.department}
                  onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                >
                  <option value="">Select Department</option>
                  {departmentOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                {errors.department && <p className={`mt-1 ${enj.fieldError}`}>{errors.department}</p>}
              </div>
              <div>
                <FieldLabel label="Project Status" required />
                <select
                  className={`enj-add-project-field mt-1 ${enj.control}`}
                  value={form.projectStatus}
                  onChange={(e) => setForm((f) => ({ ...f, projectStatus: e.target.value }))}
                >
                  <option value="">Select Project Status</option>
                  {projectStatusOptions.map((opt) => (
                    <option key={opt.value} value={String(opt.value)}>{opt.label}</option>
                  ))}
                </select>
                {errors.projectStatus && <p className={`mt-1 ${enj.fieldError}`}>{errors.projectStatus}</p>}
              </div>
              <div>
                <FieldLabel label="Milestone" required />
                <div className="mt-1 relative">
                  <button
                    type="button"
                    className={`enj-add-project-combo ${enj.btn} ${enj.btnDefault} w-full max-w-full justify-start text-left font-normal ${form.milestone.length === 0 ? 'enj-add-project-combo--empty' : ''}`}
                    onClick={() => setMilestoneOpen((v) => !v)}
                  >
                    {form.milestone.length > 0 ? form.milestone.join(', ') : 'Select Milestone(s)'}
                  </button>
                  {milestoneOpen && (
                    <div className="enj-add-project-milestone-menu absolute z-20 mt-1 w-full max-h-44 overflow-auto rounded-md p-2">
                      {milestoneOptions.length === 0 ? (
                        <p className="enj-add-project-muted px-1 py-1">No milestones available.</p>
                      ) : (
                        milestoneOptions.map((opt) => {
                          const checked = form.milestone.includes(opt);
                          return (
                            <label key={opt} className="flex items-center gap-2 py-1 font-normal text-gray-700">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setForm((f) => ({
                                    ...f,
                                    milestone: checked ? f.milestone.filter((m) => m !== opt) : [...f.milestone, opt],
                                  }));
                                  setMilestoneOpen(false);
                                }}
                              />
                              <span>{opt}</span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
                {errors.milestone && <p className={`mt-1 ${enj.fieldError}`}>{errors.milestone}</p>}
              </div>
              <div>
                <FieldLabel label="Project Sponsor" required />
                <select
                  className={`enj-add-project-field mt-1 ${enj.control}`}
                  value={form.projectSponsor}
                  onChange={(e) => setForm((f) => ({ ...f, projectSponsor: e.target.value }))}
                >
                  <option value="">Select Project Sponsor</option>
                  {form.projectSponsor && !projectSponsorOptions.some((o) => o.value === form.projectSponsor) && (
                    <option value={form.projectSponsor}>{form.projectSponsor}</option>
                  )}
                  {projectSponsorOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {errors.projectSponsor && <p className={`mt-1 ${enj.fieldError}`}>{errors.projectSponsor}</p>}
              </div>
              <div>
                <FieldLabel label="Progress (%)" required />
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={`enj-add-project-field mt-1 ${enj.control}`}
                  placeholder="Enter Progress"
                  value={form.progress}
                  onChange={(e) => setForm((f) => ({ ...f, progress: e.target.value }))}
                />
                {errors.progress && <p className={`mt-1 ${enj.fieldError}`}>{errors.progress}</p>}
              </div>
              <div className="md:col-span-2">
                <FieldLabel label="Attachments" />
                <input
                  ref={fileInputRef}
                  type="file"
                  className="sr-only"
                  multiple
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files && files.length > 0) {
                      const newFiles = Array.from(files);
                      setForm((f) => ({ ...f, attachments: [...f.attachments, ...newFiles] }));
                      e.target.value = '';
                    }
                  }}
                />
                <div className="enj-add-project-attachments rounded-lg border border-[#ADACB4] bg-white p-4">
                  {form.existingAttachments.length === 0 && form.attachments.length === 0 ? (
                    <div className="text-center">
                      <p className="enj-add-project-muted mb-3">There is nothing attached.</p>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={busy}
                        className="inline-flex items-center gap-2 font-normal hover:opacity-80 disabled:opacity-50"
                        style={{ color: '#A08149' }}
                      >
                        <Paperclip size={16} />
                        Attach file
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {form.existingAttachments.length > 0 && (
                        <div>
                          <p className="enj-add-project-muted mb-2 font-normal text-gray-600">Existing attachments</p>
                          <ul className="space-y-1">
                            {form.existingAttachments.map((file) => (
                              <li key={file.id} className="flex items-center justify-between gap-2 font-normal text-gray-700">
                                <span className="truncate">{file.name}</span>
                                <div className="flex items-center gap-2 shrink-0">
                                  <a
                                    href={file.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#A08149] hover:opacity-80"
                                    title="Download"
                                  >
                                    <Download size={16} />
                                  </a>
                                  <button
                                    type="button"
                                    className="text-rose-600 hover:opacity-80"
                                    disabled={busy}
                                    onClick={() => setForm((f) => ({
                                      ...f,
                                      existingAttachments: f.existingAttachments.filter((x) => x.id !== file.id),
                                    }))}
                                    title="Remove"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {form.attachments.length > 0 && (
                        <div className={form.existingAttachments.length > 0 ? 'pt-2 border-t border-gray-200' : ''}>
                          <p className="enj-add-project-muted mb-2 font-normal text-gray-600">Files to upload</p>
                          <ul className="space-y-1">
                            {form.attachments.map((file) => (
                              <li key={file.name} className="flex items-center justify-between gap-2 font-normal text-gray-700">
                                <span className="truncate">{file.name}</span>
                                <button
                                  type="button"
                                  className="enj-add-project-muted shrink-0 hover:underline text-rose-600"
                                  disabled={busy}
                                  onClick={() => setForm((f) => ({
                                    ...f,
                                    attachments: f.attachments.filter((x) => x.name !== file.name),
                                  }))}
                                >
                                  Remove
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className={form.existingAttachments.length > 0 || form.attachments.length > 0 ? 'pt-2 border-t border-gray-200' : ''}>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={busy}
                          className="inline-flex items-center gap-2 font-normal hover:opacity-80 disabled:opacity-50"
                          style={{ color: '#A08149' }}
                        >
                          <Paperclip size={14} />
                          Attach more
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4">
              <FieldLabel label="Note / Remark" />
              <textarea
                className={`enj-add-project-field ${enj.textarea} mt-1 h-24 min-h-24 resize-y font-normal`}
                placeholder="Enter Note / Remark"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              />
            </div>

            <div className="mt-4">
              <FieldLabel label="Project Description" />
              <textarea
                className={`enj-add-project-field ${enj.textarea} mt-1 min-h-20 resize-y font-normal`}
                placeholder="Enter Project Description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="enj-add-project-actions mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                className={`${enj.btn} ${enj.btnOutline} px-8 font-semibold`}
                onClick={onCancel}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${enj.btn} ${enj.btnPrimary} px-8 font-semibold disabled:opacity-50`}
                onClick={onSave}
                disabled={busy || metaLoading}
              >
                {busy ? 'Saving...' : 'Save'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
