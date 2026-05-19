import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ChevronDown, Download, Paperclip, Pencil, Search, Trash2, X } from 'lucide-react';
import { NewUsersService, type NewUserRow } from './services/NewUsersService';
import { fetchAttachments, uploadAttachments, type AttachmentFile } from './services/attachmentService';
import { NotificationToast, type ToastType } from './NotificationToast';
import { PagerBar } from './PagerBar';
import { enj } from './ui/enjForm';

export type OnboardingForm = {
  fullName: string;
  email: string;
  userId: string;
  gender: 'Male' | 'Female' | 'Other';
  department: '100000000' | '100000001' | '100000002' | '100000003' | '100000004';
  resume: File | null;
};

const EMPTY_FORM: OnboardingForm = {
  fullName: '',
  email: '',
  userId: '',
  gender: 'Male',
  department: '100000001',
  resume: null,
};

function extractFirstNameFromEmail(email: string): string {
  const trimmed = email.trim();
  if (!trimmed) return '';
  const prefix = trimmed.split('@')[0] ?? '';
  const parts = prefix.split('.');
  return parts[parts.length - 1] ?? prefix;
}

export const roleLabel: Record<OnboardingForm['department'], string> = {
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
  if (!form.email.trim()) next.email = 'Email ID is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Enter a valid email';
  if (!form.userId.trim()) next.userId = 'Employee ID is required';
  return next;
}

const USER_CARD_PAGE_SIZE = 9;

function lastLoggedLabel(row: NewUserRow): string {
  const raw = String(row.new_lastloggedapp ?? '').trim();
  if (!raw) return 'Never logged in';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString();
}

function sameGuid(a: string, b: string): boolean {
  return a.trim().toLowerCase().replace(/[{}]/g, '') === b.trim().toLowerCase().replace(/[{}]/g, '');
}

type ManageUsersScreenProps = {
  rows: NewUserRow[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  ownUserRecordId: string | null;
  /** When true, hide back affordance; used inside Manage Data. */
  embeddedInManageData?: boolean;
  /** Back to parent screen; ignored when `embeddedInManageData` is true. */
  onBack?: () => void;
};

export function ManageUsersScreen({
  rows,
  loading,
  onRefresh,
  ownUserRecordId,
  embeddedInManageData = false,
  onBack = () => {},
}: ManageUsersScreenProps) {

  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<OnboardingForm>(EMPTY_FORM);
  const [editErrors, setEditErrors] = useState<Partial<Record<keyof OnboardingForm, string>>>({});
  const [editBusy, setEditBusy] = useState(false);
  const [editAttachments, setEditAttachments] = useState<File[]>([]);
  const [editExistingAttachments, setEditExistingAttachments] = useState<AttachmentFile[]>([]);
  const [editAttachLoading, setEditAttachLoading] = useState(false);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<NewUserRow | null>(null);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const name = (r.new_name ?? '').toLowerCase();
      const emailId = (r.new_newcolumn ?? '').toLowerCase();
      const userIdField = (r.new_userid ?? '').toLowerCase();
      const deptCode = String(r.new_role) as OnboardingForm['department'];
      const deptName = (r.new_rolename ?? roleLabel[deptCode] ?? '').toLowerCase();
      if (searchText.trim()) {
        const q = searchText.trim().toLowerCase();
        if (!name.includes(q) && !emailId.includes(q) && !userIdField.includes(q) && !deptName.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [rows, searchText]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / USER_CARD_PAGE_SIZE));
  const pageSafe = Math.min(Math.max(1, page), pageCount);
  const pageRows = useMemo(() => {
    const start = (pageSafe - 1) * USER_CARD_PAGE_SIZE;
    return filtered.slice(start, start + USER_CARD_PAGE_SIZE);
  }, [filtered, pageSafe]);
  const fill3x3Page = pageRows.length === USER_CARD_PAGE_SIZE;

  useEffect(() => {
    setPage(1);
  }, [searchText, rows.length]);

  useEffect(() => {
    setPage((p) => Math.min(p, pageCount));
  }, [pageCount]);

  const openEdit = async (row: NewUserRow) => {
    const userId = row.new_usersid ?? null;
    setEditingId(userId);
    setEditForm({
      fullName: row.new_name ?? '',
      email: (row.new_newcolumn as string | undefined) ?? '',
      userId: row.new_userid ?? '',
      gender: 'Male',
      department: (String(row.new_role) as OnboardingForm['department']) || '100000001',
      resume: null,
    });
    setEditErrors({});
    setEditAttachments([]);
    setEditExistingAttachments([]);

    if (userId) {
      setEditAttachLoading(true);
      try {
        const attachments = await fetchAttachments(userId);
        setEditExistingAttachments(attachments);
      } catch (error) {
        console.error('Error fetching attachments:', error);
      } finally {
        setEditAttachLoading(false);
      }
    }

    setEditOpen(true);
  };

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    const next = validateUserForm(editForm);
    setEditErrors(next);
    if (Object.keys(next).length > 0) return;
    setEditBusy(true);
    try {
      const payload = {
        new_name: editForm.fullName.trim(),
        new_userid: editForm.userId.trim(),
        new_role: Number(editForm.department),
        new_newcolumn: editForm.email.trim(),
      };
      const res = await NewUsersService.update(editingId, payload);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to update user');

      if (editAttachments.length > 0) {
        await uploadAttachments(editingId, editAttachments);
      }

      setToast({ type: 'success', message: 'User updated successfully.' });
      setEditOpen(false);
      await onRefresh();
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Failed to update user' });
    } finally {
      setEditBusy(false);
    }
  };

  const deleteUser = async (id: string) => {
    if (!id) return;
    if (ownUserRecordId && sameGuid(id, ownUserRecordId)) return;
    setDeleteBusyId(id);
    try {
      await NewUsersService.delete(id);
      setToast({ type: 'success', message: 'User removed.' });
      await onRefresh();
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Failed to delete user' });
    } finally {
      setDeleteBusyId(null);
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden gap-2">
      {toast && <NotificationToast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {!embeddedInManageData && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50"
              aria-label="Back to dashboard"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          {embeddedInManageData ? (
            <h1 className="enj-screen-subheader">Users</h1>
          ) : (
            <>
              <h1 className="enj-screen-subheader">Manage</h1>
              <div className="relative">
                <select
                  className="h-7 appearance-none rounded-md border border-gray-200 bg-gray-50 pl-2 pr-7 text-xs text-gray-800"
                  value="users"
                  disabled
                  aria-label="Manage section"
                >
                  <option value="users">Users</option>
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            </>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5 sm:max-w-md sm:flex-1 md:max-w-lg">
          <div className="relative min-w-0 flex-1 sm:min-w-[160px]">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search users..."
              className="h-7 w-full rounded-md border border-gray-200 pl-8 pr-2 text-xs"
            />
          </div>
          <button
            type="button"
            onClick={() => setOnboardOpen(true)}
            className={`${enj.btnPrimary} !h-7 shrink-0 px-3 text-xs`}
          >
            Add new
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-gray-500">Loading users...</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-gray-500">No users found.</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
          <div className="min-h-0 flex-1 max-md:overflow-y-auto max-md:overflow-x-hidden md:overflow-hidden pr-0.5 [scrollbar-gutter:stable]">
            <div
              className={`grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 ${
                fill3x3Page ? 'md:h-full md:min-h-0 md:grid-rows-3' : ''
              }`}
            >
              {pageRows.map((r) => {
                const id = String(r.new_usersid ?? '');
                const isSelf = Boolean(ownUserRecordId && id && sameGuid(id, ownUserRecordId));
                const active = statusName(r.new_status) === 'Active';
                const dept = r.new_rolename ?? roleLabel[String(r.new_role) as OnboardingForm['department']] ?? '—';
                return (
                  <article
                    key={id}
                    className={`flex min-h-0 min-w-0 flex-col rounded-md border border-gray-100 bg-white p-2 shadow-sm ${fill3x3Page ? 'md:h-full md:min-h-0' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-xs font-semibold leading-snug text-primary">{r.new_name ?? '—'}</p>
                        <p className="mt-0.5 line-clamp-1 break-all text-[10px] leading-tight text-gray-500">{r.new_newcolumn ?? '—'}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <span className={`${enj.badge} ${active ? enj.badgeSuccess : enj.badgeDanger}`}>
                          {active ? 'Active' : 'InActive'}
                        </span>
                        <button
                          type="button"
                          onClick={() => openEdit(r)}
                          className="h-6 w-6 rounded-md border border-gray-200 inline-flex items-center justify-center text-gray-600 hover:bg-gray-50"
                          aria-label="Edit user"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          type="button"
                          disabled={isSelf || deleteBusyId === id}
                          onClick={() => {
                            if (!isSelf) setPendingDelete(r);
                          }}
                          title={isSelf ? 'You cannot remove your own account' : 'Delete user'}
                          className="h-6 w-6 rounded-md border border-rose-200 inline-flex items-center justify-center text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Delete user"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 space-y-0.5 border-t border-gray-100 py-1 text-[10px] leading-snug text-gray-800">
                      <p className="line-clamp-1">
                        <span className="font-semibold">Department :</span>{' '}
                        <span className="font-medium text-blue-600">{dept}</span>
                      </p>
                      <p>
                        <span className="font-semibold">Role :</span> User
                      </p>
                      <p className="line-clamp-1 text-gray-600">
                        <span className="font-semibold text-gray-800">Last logged :</span> {lastLoggedLabel(r)}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
          <div className="shrink-0 rounded-md border border-gray-200 bg-white px-3 py-2 shadow-sm">
            <PagerBar
              page={pageSafe}
              pageSize={USER_CARD_PAGE_SIZE}
              total={filtered.length}
              onPrev={() => setPage((x) => Math.max(1, x - 1))}
              onNext={() => setPage((x) => Math.min(pageCount, x + 1))}
              disabled={loading}
            />
          </div>
        </div>
      )}

      {onboardOpen && (
        <div
          className="fixed inset-0 z-[220] flex items-center justify-center bg-black/40 p-4 overflow-y-auto"
          role="presentation"
          onClick={() => setOnboardOpen(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-gray-100 bg-white p-5 shadow-xl my-4"
            role="dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="enj-screen-subheader">User Onboard</h2>
              <button
                type="button"
                onClick={() => setOnboardOpen(false)}
                className="h-8 w-8 rounded-md hover:bg-gray-100 inline-flex items-center justify-center"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="pr-0">
              <UserOnboardFormContent
                onSuccess={async () => {
                  setOnboardOpen(false);
                  await onRefresh();
                }}
              />
            </div>
          </div>
        </div>
      )}

      {editOpen && (
        <EditUserModal
          editForm={editForm}
          editErrors={editErrors}
          editBusy={editBusy}
          editAttachments={editAttachments}
          editExistingAttachments={editExistingAttachments}
          editAttachLoading={editAttachLoading}
          onEmailChange={(email) => setEditForm((f) => ({ ...f, email }))}
          onFullNameChange={(fullName) => setEditForm((f) => ({ ...f, fullName }))}
          onUserIdChange={(userId) => setEditForm((f) => ({ ...f, userId }))}
          onGenderChange={(gender) => setEditForm((f) => ({ ...f, gender }))}
          onDepartmentChange={(department) => setEditForm((f) => ({ ...f, department }))}
          onAttachFile={(files) => setEditAttachments((prev) => [...prev, ...files])}
          onRemoveAttachment={(fileName) => setEditAttachments((prev) => prev.filter((a) => a.name !== fileName))}
          onRemoveExistingAttachment={(id) => setEditExistingAttachments((prev) => prev.filter((a) => a.id !== id))}
          onDownloadAttachment={(file) => {
            const link = document.createElement('a');
            link.href = file.url;
            link.download = file.name;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }}
          onSave={saveEdit}
          onClose={() => setEditOpen(false)}
        />
      )}

      {pendingDelete && (
        <div
          className="fixed inset-0 z-[250] flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => setPendingDelete(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-gray-100 bg-white p-5 shadow-xl"
            role="dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="enj-screen-subheader">Confirm Delete</h3>
            <p className="mt-2 text-sm text-gray-600">Do you want to remove this user?</p>
            <p className="mt-1 text-sm text-gray-500">{String(pendingDelete.new_name ?? 'User')}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className={enj.btnDefault}
              >
                No
              </button>
              <button
                type="button"
                onClick={() => {
                  void deleteUser(String(pendingDelete.new_usersid ?? ''));
                  setPendingDelete(null);
                }}
                disabled={deleteBusyId !== null}
                className={enj.btnPrimary}
              >
                {deleteBusyId ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type EditUserModalProps = {
  editForm: OnboardingForm;
  editErrors: Partial<Record<keyof OnboardingForm, string>>;
  editBusy: boolean;
  editAttachments: File[];
  editExistingAttachments: AttachmentFile[];
  editAttachLoading: boolean;
  onEmailChange: (email: string) => void;
  onFullNameChange: (fullName: string) => void;
  onUserIdChange: (userId: string) => void;
  onGenderChange: (gender: OnboardingForm['gender']) => void;
  onDepartmentChange: (department: OnboardingForm['department']) => void;
  onAttachFile: (files: File[]) => void;
  onRemoveAttachment: (fileName: string) => void;
  onRemoveExistingAttachment: (id: string) => void;
  onDownloadAttachment: (file: AttachmentFile) => void;
  onSave: (e: FormEvent) => Promise<void>;
  onClose: () => void;
};

function EditUserModal({
  editForm,
  editErrors,
  editBusy,
  editAttachments,
  editExistingAttachments,
  editAttachLoading,
  onEmailChange,
  onFullNameChange,
  onUserIdChange,
  onGenderChange,
  onDepartmentChange,
  onAttachFile,
  onRemoveAttachment,
  onRemoveExistingAttachment,
  onDownloadAttachment,
  onSave,
  onClose,
}: EditUserModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files) return;
    const newFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file) newFiles.push(file);
    }
    onAttachFile(newFiles);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onAttachFileClick = () => {
    fileInputRef.current?.click();
  };

  const inputCls = `mt-1 ${enj.control}`;

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/40 p-4" role="presentation" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-gray-100 bg-white p-5 shadow-xl" role="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="enj-screen-subheader">Edit User</h3>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-md hover:bg-gray-100 inline-flex items-center justify-center">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={onSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label>
            <span className="text-xs text-gray-600">Email ID *</span>
            <input className={inputCls} type="email" autoComplete="email" value={editForm.email} onChange={(e) => onEmailChange(e.target.value)} />
            {editErrors.email && <p className={`mt-1 ${enj.fieldError}`}>{editErrors.email}</p>}
          </label>
          <label>
            <span className="text-xs text-gray-600">Full Name *</span>
            <input className={inputCls} value={editForm.fullName} onChange={(e) => onFullNameChange(e.target.value)} />
            {editErrors.fullName && <p className={`mt-1 ${enj.fieldError}`}>{editErrors.fullName}</p>}
          </label>
          <label>
            <span className="text-xs text-gray-600">Employee ID *</span>
            <input className={inputCls} value={editForm.userId} onChange={(e) => onUserIdChange(e.target.value)} />
            {editErrors.userId && <p className={`mt-1 ${enj.fieldError}`}>{editErrors.userId}</p>}
          </label>
          <label>
            <span className="text-xs text-gray-600">Gender *</span>
            <select className={inputCls} value={editForm.gender} onChange={(e) => onGenderChange(e.target.value as OnboardingForm['gender'])}>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <label className="md:col-span-2">
            <span className="text-xs text-gray-600">Department *</span>
            <select className={inputCls} value={editForm.department} onChange={(e) => onDepartmentChange(e.target.value as OnboardingForm['department'])}>
              {Object.entries(roleLabel).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-600 mb-2">Resume</label>
            {editAttachLoading ? (
              <p className="text-xs text-gray-500">Loading attachments...</p>
            ) : (
              <div className="space-y-3">
                {editExistingAttachments.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-gray-700">Existing Files</p>
                    {editExistingAttachments.map((file) => (
                      <div key={file.id} className="flex items-center justify-between gap-2 rounded-md bg-blue-50 p-2 border border-blue-200">
                        <span className="text-xs text-gray-700 truncate">{file.name}</span>
                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => onDownloadAttachment(file)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Download"
                          >
                            <Download size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveExistingAttachment(file.id)}
                            className="text-gray-400 hover:text-gray-600"
                            title="Remove"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={onAttachFileClick}
                  className={`${enj.btnDefault} inline-flex items-center gap-1.5 text-xs`}
                >
                  <Paperclip size={14} />
                  {editAttachments.length === 0 && editExistingAttachments.length === 0 ? 'Attach file' : 'Attach more'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={onFileSelected}
                  className="hidden"
                  aria-hidden="true"
                />
                {editAttachments.length > 0 && (
                  <div className="space-y-1.5 mt-2">
                    <p className="text-xs font-medium text-gray-700">New Files</p>
                    {editAttachments.map((file) => (
                      <div key={file.name} className="flex items-center justify-between gap-2 rounded-md bg-gray-50 p-2 border border-gray-200">
                        <span className="text-xs text-gray-700 truncate">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => onRemoveAttachment(file.name)}
                          className="shrink-0 text-gray-400 hover:text-gray-600"
                          title="Remove"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="md:col-span-2 flex justify-end gap-2 mt-1">
            <button type="button" onClick={onClose} className={enj.btnOutline}>
              Cancel
            </button>
            <button type="submit" disabled={editBusy} className={enj.btnPrimary}>
              {editBusy ? 'Updating...' : 'Update User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UserOnboardFormContent({ onSuccess }: { onSuccess: () => Promise<void> }) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<OnboardingForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof OnboardingForm, string>>>({});
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validate = useCallback(() => {
    const next = validateUserForm(form);
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [form]);

  const onEmailChange = useCallback((email: string) => {
    setForm((f) => ({ ...f, email }));
    setErrors((e) => ({ ...e, email: '' }));
    const firstName = extractFirstNameFromEmail(email);
    if (firstName) {
      setForm((f) => ({ ...f, fullName: firstName }));
    }
  }, []);

  const onAttachFile = () => {
    fileInputRef.current?.click();
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file) {
        setAttachments((prev) => [...prev, file]);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onRemoveAttachment = (fileName: string) => {
    setAttachments((prev) => prev.filter((a) => a.name !== fileName));
  };

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setMessage('');
      if (!validate()) return;
      setSubmitting(true);
      try {
        const today = new Date().toISOString().slice(0, 10);
        const userId = globalThis.crypto?.randomUUID?.() ?? fallbackGuid();
        const payload = {
          new_usersid: userId,
          new_name: form.fullName.trim(),
          new_userid: form.userId.trim(),
          new_role: Number(form.department),
          new_status: 100000000,
          new_onboardeddate: today,
          new_newcolumn: form.email.trim(),
        };
        const res = await NewUsersService.create(payload);
        if (!res.success) throw new Error(res.error?.message ?? 'Failed to create user');

        if (attachments.length > 0) {
          await uploadAttachments(userId, attachments);
        }

        setMessage('User created successfully.');
        setForm(EMPTY_FORM);
        setAttachments([]);
        setErrors({});
        await onSuccess();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Failed to create user');
      } finally {
        setSubmitting(false);
      }
    },
    [form, attachments, onSuccess, validate],
  );

  const inputCls = `mt-1 ${enj.control}`;

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <label>
        <span className="text-xs text-gray-600">Email ID *</span>
        <input className={inputCls} type="email" autoComplete="email" value={form.email} onChange={(e) => onEmailChange(e.target.value)} />
        {errors.email && <p className="text-[11px] text-red-600 mt-1">{errors.email}</p>}
      </label>
      <label>
        <span className="text-xs text-gray-600">Full Name *</span>
        <input className={inputCls} value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
        {errors.fullName && <p className="text-[11px] text-red-600 mt-1">{errors.fullName}</p>}
      </label>
      <label>
        <span className="text-xs text-gray-600">Employee ID *</span>
        <input className={inputCls} value={form.userId} onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))} />
        {errors.userId && <p className="text-[11px] text-red-600 mt-1">{errors.userId}</p>}
      </label>
      <label>
        <span className="text-xs text-gray-600">Gender *</span>
        <select className={inputCls} value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value as OnboardingForm['gender'] }))}>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
        </select>
      </label>
      <label className="md:col-span-2">
        <span className="text-xs text-gray-600">Department *</span>
        <select className={inputCls} value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value as OnboardingForm['department'] }))}>
          {Object.entries(roleLabel).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <div className="md:col-span-2">
        <label className="block text-xs text-gray-600 mb-2">Resume</label>
        <div className="space-y-2">
          <button
            type="button"
            onClick={onAttachFile}
            className={`${enj.btnDefault} inline-flex items-center gap-1.5 text-xs`}
          >
            <Paperclip size={14} />
            {attachments.length === 0 ? 'Attach file' : 'Attach more'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.txt"
            onChange={onFileSelected}
            className="hidden"
            aria-hidden="true"
          />
          {attachments.length > 0 && (
            <div className="space-y-1.5 mt-2">
              {attachments.map((file) => (
                <div key={file.name} className="flex items-center justify-between gap-2 rounded-md bg-gray-50 p-2 border border-gray-200">
                  <span className="text-xs text-gray-700 truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment(file.name)}
                    className="shrink-0 text-gray-400 hover:text-gray-600"
                    title="Remove"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-500 md:col-span-2">Onboarded Date and Status are set on submit (Today, Active).</p>
      <div className="md:col-span-2 flex justify-end">
        <button type="submit" disabled={submitting} className={`${enj.btnPrimary} px-6`}>
          {submitting ? 'Submitting...' : 'Submit'}
        </button>
      </div>
      {message && <p className="text-sm text-gray-700 md:col-span-2">{message}</p>}
    </form>
  );
}
