import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ChevronDown, Pencil, Search, Trash2, X } from 'lucide-react';
import { ClientsService, type ClientRow } from './services/ClientsService';
import { NotificationToast, type ToastType } from './NotificationToast';
import { PagerBar } from './PagerBar';
import { CLIENT_BUSINESS_TYPES } from './AddClientScreen';
import { clientAuditLines, clientDisplayId, isClientRowActive } from './clientRecordHelpers';
import { enj } from './ui/enjForm';

const PAGE_SIZE = 9;

type EditForm = {
  companyName: string;
  email: string;
  industrySector: string;
  primaryContact: string;
  businessType: string;
  phone: string;
};

const EMPTY: EditForm = {
  companyName: '',
  email: '',
  industrySector: '',
  primaryContact: '',
  businessType: '',
  phone: '',
};

function rowToForm(r: ClientRow): EditForm {
  return {
    companyName: String(r.new_clientname ?? ''),
    email: String(r.new_clientemail ?? ''),
    industrySector: String(r.new_industrysector ?? ''),
    primaryContact: String(r.new_primarycontactname ?? ''),
    businessType: String(r.new_businesstype ?? ''),
    phone: String(r.new_phonenumber ?? ''),
  };
}

function validate(f: EditForm): Partial<Record<keyof EditForm, string>> {
  const e: Partial<Record<keyof EditForm, string>> = {};
  if (!f.companyName.trim()) e.companyName = 'Required';
  if (!f.email.trim()) e.email = 'Required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Invalid email';
  if (!f.industrySector.trim()) e.industrySector = 'Required';
  if (!f.primaryContact.trim()) e.primaryContact = 'Required';
  if (!f.businessType.trim()) e.businessType = 'Required';
  if (!f.phone.trim()) e.phone = 'Required';
  return e;
}

type ManageClientScreenProps = {
  onAddNew?: () => void;
};

export function ManageClientScreen({ onAddNew }: ManageClientScreenProps = {}) {
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<ClientRow | null>(null);
  const [form, setForm] = useState<EditForm>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof EditForm, string>>>({});
  const [saveBusy, setSaveBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(null);
  const [auditRow, setAuditRow] = useState<ClientRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ClientRow | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ClientsService.getAll({ top: 500, orderBy: ['createdon desc'] });
      if (res.success) setRows((res.data ?? []) as ClientRow[]);
      else setRows([]);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const blob = [
        r.new_clientname,
        r.new_clientemail,
        r.new_industrysector,
        r.new_primarycontactname,
        r.new_businesstype,
        r.new_phonenumber,
        r.new_clientid,
        r.new_appstatus,
      ]
        .map((x) => String(x ?? '').toLowerCase())
        .join(' ');
      return blob.includes(q);
    });
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const pagedRows = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, pageSafe]);
  const fill3x3Page = pagedRows.length === PAGE_SIZE;

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const openEdit = (r: ClientRow) => {
    const id = String(r.new_clientid ?? '').trim();
    if (!id) return;
    setEditingId(id);
    setEditingRow(r);
    setForm(rowToForm(r));
    setErrors({});
    setEditOpen(true);
  };

  const saveEdit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingId) return;
    const next = validate(form);
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setSaveBusy(true);
    try {
      const res = await ClientsService.update(editingId, {
        new_clientname: form.companyName.trim(),
        new_clientemail: form.email.trim(),
        new_industrysector: form.industrySector.trim(),
        new_primarycontactname: form.primaryContact.trim(),
        new_businesstype: form.businessType.trim(),
        new_phonenumber: form.phone.trim(),
      });
      if (!res.success) throw new Error(res.error?.message ?? 'Update failed');
      setToast({ type: 'success', message: 'Client updated.' });
      setEditOpen(false);
      setEditingRow(null);
      await load();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Update failed' });
    } finally {
      setSaveBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!id) return;
    setDeleteBusy(id);
    try {
      await ClientsService.delete(id);
      setToast({ type: 'success', message: 'Client removed.' });
      await load();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Delete failed' });
    } finally {
      setDeleteBusy(null);
      setPendingDelete(null);
    }
  };

  const inputBase = `mt-1 ${enj.control}`;
  const label = (t: string, req?: boolean) => (
    <span className="text-sm text-gray-900">
      {t}
      {req && <span className="text-red-500"> *</span>}
    </span>
  );

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
      {toast && <NotificationToast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="enj-screen-subheader">Clients</h1>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5 sm:max-w-md sm:flex-1 md:max-w-lg">
          <div className="relative min-w-0 flex-1 sm:min-w-[160px]">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className={`${enj.control} pl-8 text-sm`}
              placeholder="Search name, email, ID, phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {onAddNew && (
            <button
              type="button"
              onClick={onAddNew}
              className={`${enj.btnPrimary} shrink-0 px-3 text-xs`}
            >
              Add new
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="mt-2 text-xs text-gray-500">Loading clients…</p>
      ) : filtered.length === 0 ? (
        <p className="mt-2 text-xs text-gray-500">No clients found.</p>
      ) : (
        <div className="mt-1.5 flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
          <div className="min-h-0 flex-1 max-md:overflow-y-auto max-md:overflow-x-hidden md:overflow-hidden pr-0.5 [scrollbar-gutter:stable]">
            <div
              className={`grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 ${
                fill3x3Page ? 'md:h-full md:min-h-0 md:grid-rows-3' : ''
              }`}
            >
              {pagedRows.map((r) => {
                const id = String(r.new_clientid ?? '');
                const active = isClientRowActive(r);
                const code = clientDisplayId(r);
                return (
                  <article
                    key={id}
                    className={`flex min-h-0 min-w-0 flex-col rounded-md border border-gray-100 bg-white p-2 shadow-sm ${
                      fill3x3Page ? 'md:h-full md:min-h-0' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-xs font-semibold leading-snug text-primary">{r.new_clientname ?? '—'}</p>
                        <p className="mt-0.5 line-clamp-1 break-all text-[10px] leading-tight text-gray-500">{r.new_clientemail ?? '—'}</p>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-1">
                        <span className={`${enj.badge} ${active ? enj.badgeSuccess : enj.badgeDanger}`}>
                          {active ? 'Active' : 'InActive'}
                        </span>
                        <button
                          type="button"
                          onClick={() => openEdit(r)}
                          className="h-6 w-6 rounded-md border border-gray-200 inline-flex items-center justify-center text-gray-600 hover:bg-gray-50"
                          title="Edit"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          type="button"
                          disabled={deleteBusy === id}
                          onClick={() => setPendingDelete(r)}
                          className="h-6 w-6 rounded-md border border-rose-200 inline-flex items-center justify-center text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 space-y-0.5 border-t border-gray-100 py-1 text-[10px] leading-snug text-gray-800">
                      <p className="line-clamp-1">
                        <span className="font-semibold">Client ID :</span> <span className="text-gray-700">{code}</span>
                      </p>
                      <p className="line-clamp-1">
                        <span className="font-semibold">Business type :</span>{' '}
                        <span className="text-gray-700">{r.new_businesstype ?? '—'}</span>
                      </p>
                      <p className="line-clamp-1">
                        <span className="font-semibold">Contact :</span>{' '}
                        <span className="text-gray-700">{r.new_phonenumber ? String(r.new_phonenumber) : '—'}</span>
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
              pageSize={PAGE_SIZE}
              total={filtered.length}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={loading}
            />
          </div>
        </div>
      )}

      {editOpen && editingRow && (
        <div
          className="fixed inset-0 z-[220] flex items-center justify-center bg-black/40 p-4 overflow-y-auto"
          onClick={() => {
            setEditOpen(false);
            setEditingRow(null);
          }}
          role="presentation"
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-gray-200 bg-white p-5 shadow-xl my-4"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="enj-screen-subheader">Edit Client</h3>
              <button
                type="button"
                onClick={() => {
                  setEditOpen(false);
                  setEditingRow(null);
                }}
                className="h-8 w-8 rounded-md hover:bg-gray-100 inline-flex items-center justify-center"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-gray-600 mb-1">
              <span className="font-semibold">Client ID :</span>{' '}
              <span className="font-mono text-gray-800">{clientDisplayId(editingRow)}</span>
            </p>
            <p className="text-[11px] text-gray-400 font-mono break-all mb-3">System ID: {editingId}</p>
            <form onSubmit={saveEdit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label>
                {label('Company Name', true)}
                <input className={inputBase} value={form.companyName} onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))} />
                {errors.companyName && <p className="text-[11px] text-red-600 mt-1">{errors.companyName}</p>}
              </label>
              <label>
                {label('Email', true)}
                <input className={inputBase} type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                {errors.email && <p className="text-[11px] text-red-600 mt-1">{errors.email}</p>}
              </label>
              <label>
                {label('Industry / Sector', true)}
                <input className={inputBase} value={form.industrySector} onChange={(e) => setForm((f) => ({ ...f, industrySector: e.target.value }))} />
                {errors.industrySector && <p className="text-[11px] text-red-600 mt-1">{errors.industrySector}</p>}
              </label>
              <label>
                {label('Primary Contact Name', true)}
                <input className={inputBase} value={form.primaryContact} onChange={(e) => setForm((f) => ({ ...f, primaryContact: e.target.value }))} />
                {errors.primaryContact && <p className="text-[11px] text-red-600 mt-1">{errors.primaryContact}</p>}
              </label>
              <label>
                {label('Business Type', true)}
                <div className="relative mt-1">
                  <select
                    className={`${inputBase} appearance-none pr-9`}
                    value={form.businessType}
                    onChange={(e) => setForm((f) => ({ ...f, businessType: e.target.value }))}
                  >
                    <option value="">Select…</option>
                    {CLIENT_BUSINESS_TYPES.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
                {errors.businessType && <p className="text-[11px] text-red-600 mt-1">{errors.businessType}</p>}
              </label>
              <label>
                {label('Phone Number', true)}
                <input className={inputBase} type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                {errors.phone && <p className="text-[11px] text-red-600 mt-1">{errors.phone}</p>}
              </label>
              <div className="md:col-span-2 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditOpen(false);
                    setEditingRow(null);
                  }}
                  className={enj.btnOutline}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveBusy}
                  className={enj.btnPrimary}
                >
                  {saveBusy ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {auditRow && (
        <div
          className="fixed inset-0 z-[225] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setAuditRow(null)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="enj-screen-subheader">Client audit</h3>
              <button type="button" onClick={() => setAuditRow(null)} className="h-8 w-8 rounded-md hover:bg-gray-100 inline-flex items-center justify-center" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm font-medium text-gray-900 mb-1">{String(auditRow.new_clientname ?? '—')}</p>
            <p className="text-xs text-gray-500 mb-3">{String(auditRow.new_clientemail ?? '')}</p>
            <ul className="space-y-2 text-sm">
              {clientAuditLines(auditRow).map((line) => (
                <li key={line.label} className="flex flex-col sm:flex-row sm:gap-2">
                  <span className="text-gray-500 font-medium shrink-0">{line.label}:</span>
                  <span className="text-gray-800 break-all">{line.value}</span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-gray-400 mt-4">Connect your admin audit table or Flow here for a full change history if needed.</p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setAuditRow(null)}
                className={enj.btnPrimary}
              >
                Close
              </button>
            </div>
          </div>
        </div>
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
            <p className="mt-2 text-sm text-gray-600">Do you want to delete this client?</p>
            <p className="mt-1 text-sm text-gray-500">{String(pendingDelete.new_clientname ?? 'Record')}</p>
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
                onClick={() => void remove(String(pendingDelete.new_clientid ?? ''))}
                disabled={deleteBusy !== null}
                className={enj.btnPrimary}
              >
                {deleteBusy ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
