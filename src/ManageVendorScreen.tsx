import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ChevronDown, Pencil, Search, Trash2, X } from 'lucide-react';
import { VendorsService, type VendorRow } from './services/VendorsService';
import { NotificationToast, type ToastType } from './NotificationToast';
import { PagerBar } from './PagerBar';
import { VENDOR_BUSINESS_OPTIONS } from './AddVendorScreen';
import { isVendorRowActive, vendorAuditLines, vendorDisplayId } from './vendorRecordHelpers';
import { enj } from './ui/enjForm';

const PAGE_SIZE = 9;

type EditForm = {
  vendorName: string;
  email: string;
  businessType: string;
  phone: string;
  primaryContact: string;
  sector: string;
  gender: string;
  date: string;
};

const EMPTY: EditForm = {
  vendorName: '',
  email: '',
  businessType: '',
  phone: '',
  primaryContact: '',
  sector: '',
  gender: '',
  date: '',
};

function toDateInput(v: unknown): string {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return '';
}

function rowToForm(r: VendorRow): EditForm {
  return {
    vendorName: String(r.new_vendorname ?? ''),
    email: String(r.new_vendoremail ?? ''),
    businessType: r.new_businesstype != null && r.new_businesstype !== '' ? String(r.new_businesstype) : '',
    phone: String(r.new_phonenumber ?? ''),
    primaryContact: String(r.new_primarycontactperson ?? ''),
    sector: String(r.new_sector ?? ''),
    gender: String(r.new_gender ?? ''),
    date: toDateInput(r.new_date),
  };
}

function businessTypeLabel(r: VendorRow): string {
  const n = Number(r.new_businesstype);
  const fromEnum = VENDOR_BUSINESS_OPTIONS.find((o) => o.value === n)?.label;
  if (fromEnum) return fromEnum;
  return String(r.new_businesstypename ?? r.new_businesstype ?? '—');
}

function validate(f: EditForm): Partial<Record<keyof EditForm, string>> {
  const e: Partial<Record<keyof EditForm, string>> = {};
  if (!f.vendorName.trim()) e.vendorName = 'Required';
  if (!f.email.trim()) e.email = 'Required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Invalid email';
  if (!f.businessType) e.businessType = 'Required';
  if (!f.phone.trim()) e.phone = 'Required';
  if (!f.primaryContact.trim()) e.primaryContact = 'Required';
  if (!f.sector.trim()) e.sector = 'Required';
  return e;
}

const GENDERS = ['Male', 'Female', 'Other'] as const;

type ManageVendorScreenProps = {
  onAddNew?: () => void;
};

export function ManageVendorScreen({ onAddNew }: ManageVendorScreenProps = {}) {
  const [rows, setRows] = useState<VendorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<VendorRow | null>(null);
  const [form, setForm] = useState<EditForm>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof EditForm, string>>>({});
  const [saveBusy, setSaveBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(null);
  const [auditRow, setAuditRow] = useState<VendorRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<VendorRow | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await VendorsService.getAll({ top: 500, orderBy: ['createdon desc'] });
      if (res.success) setRows((res.data ?? []) as VendorRow[]);
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
        r.new_vendorname,
        r.new_vendoremail,
        r.new_sector,
        r.new_primarycontactperson,
        r.new_phonenumber,
        r.new_businesstypename,
        r.new_vendorid,
        r.new_appstatus,
        r.new_gender,
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

  const openEdit = (r: VendorRow) => {
    const id = String(r.new_vendorid ?? '').trim();
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
      const businessNum = Number(form.businessType);
      const res = await VendorsService.update(editingId, {
        new_vendorname: form.vendorName.trim(),
        new_vendoremail: form.email.trim(),
        new_businesstype: businessNum,
        new_phonenumber: form.phone.trim(),
        new_primarycontactperson: form.primaryContact.trim(),
        new_sector: form.sector.trim(),
        new_gender: form.gender.trim() || undefined,
        new_date: form.date.trim() || undefined,
      });
      if (!res.success) throw new Error(res.error?.message ?? 'Update failed');
      setToast({ type: 'success', message: 'Vendor updated.' });
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
      await VendorsService.delete(id);
      setToast({ type: 'success', message: 'Vendor removed.' });
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
        <h1 className={enj.sectionTitle}>Vendors</h1>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5 sm:max-w-md sm:flex-1 md:max-w-lg">
          <div className="relative min-w-0 flex-1 sm:min-w-[160px]">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className={`${enj.control} pl-8 text-sm`}
              placeholder="Search name, email, ID, sector, phone…"
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
        <p className="mt-2 text-xs text-gray-500">Loading vendors…</p>
      ) : filtered.length === 0 ? (
        <p className="mt-2 text-xs text-gray-500">No vendors found.</p>
      ) : (
        <div className="mt-1.5 flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
          <div className="min-h-0 flex-1 max-md:overflow-y-auto max-md:overflow-x-hidden md:overflow-hidden pr-0.5 [scrollbar-gutter:stable]">
            <div
              className={`grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 ${
                fill3x3Page ? 'md:h-full md:min-h-0 md:grid-rows-3' : ''
              }`}
            >
              {pagedRows.map((r) => {
                const id = String(r.new_vendorid ?? '');
                const active = isVendorRowActive(r);
                const code = vendorDisplayId(r);
                return (
                  <article
                    key={id}
                    className={`flex min-h-0 min-w-0 flex-col rounded-md border border-gray-100 bg-white p-2 shadow-sm ${
                      fill3x3Page ? 'md:h-full md:min-h-0' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-xs font-semibold leading-snug text-primary">{r.new_vendorname ?? '—'}</p>
                        <p className="mt-0.5 line-clamp-1 break-all text-[10px] leading-tight text-gray-500">
                          {r.new_vendoremail ?? '—'}
                        </p>
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
                        <span className="font-semibold">Vendor ID :</span> <span className="text-gray-700">{code}</span>
                      </p>
                      <p className="line-clamp-1">
                        <span className="font-semibold">Business type :</span>{' '}
                        <span className="text-gray-700">{businessTypeLabel(r)}</span>
                      </p>
                      <p className="line-clamp-1">
                        <span className="font-semibold">Contact :</span>{' '}
                        <span className="text-gray-700">
                          {r.new_phonenumber ? String(r.new_phonenumber) : '—'}
                        </span>
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
          className="fixed inset-0 z-[220] flex items-center justify-center overflow-y-auto bg-black/40 p-4"
          onClick={() => {
            setEditOpen(false);
            setEditingRow(null);
          }}
          role="presentation"
        >
          <div
            className="my-4 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-gray-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className={enj.sectionTitle}>Edit Vendor</h3>
              <button
                type="button"
                onClick={() => {
                  setEditOpen(false);
                  setEditingRow(null);
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-gray-100"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mb-1 text-xs text-gray-600">
              <span className="font-semibold">Vendor ID :</span>{' '}
              <span className="font-mono text-gray-800">{vendorDisplayId(editingRow)}</span>
            </p>
            <p className="mb-3 break-all font-mono text-[11px] text-gray-400">System ID: {editingId}</p>
            <form onSubmit={saveEdit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label>
                {label('Vendor name', true)}
                <input
                  className={inputBase}
                  value={form.vendorName}
                  onChange={(e) => setForm((f) => ({ ...f, vendorName: e.target.value }))}
                />
                {errors.vendorName && <p className="mt-1 text-[11px] text-red-600">{errors.vendorName}</p>}
              </label>
              <label>
                {label('Email', true)}
                <input
                  className={inputBase}
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
                {errors.email && <p className="mt-1 text-[11px] text-red-600">{errors.email}</p>}
              </label>
              <label>
                {label('Business type', true)}
                <div className="relative mt-1">
                  <select
                    className={`${inputBase} appearance-none pr-9`}
                    value={form.businessType}
                    onChange={(e) => setForm((f) => ({ ...f, businessType: e.target.value }))}
                  >
                    <option value="">Select…</option>
                    {VENDOR_BUSINESS_OPTIONS.map((b) => (
                      <option key={b.value} value={String(b.value)}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
                {errors.businessType && <p className="mt-1 text-[11px] text-red-600">{errors.businessType}</p>}
              </label>
              <label>
                {label('Phone', true)}
                <input
                  className={inputBase}
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
                {errors.phone && <p className="mt-1 text-[11px] text-red-600">{errors.phone}</p>}
              </label>
              <label>
                {label('Primary contact', true)}
                <input
                  className={inputBase}
                  value={form.primaryContact}
                  onChange={(e) => setForm((f) => ({ ...f, primaryContact: e.target.value }))}
                />
                {errors.primaryContact && <p className="mt-1 text-[11px] text-red-600">{errors.primaryContact}</p>}
              </label>
              <label>
                {label('Sector', true)}
                <input
                  className={inputBase}
                  value={form.sector}
                  onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value }))}
                />
                {errors.sector && <p className="mt-1 text-[11px] text-red-600">{errors.sector}</p>}
              </label>
              <label>
                {label('Gender', false)}
                <div className="relative mt-1">
                  <select
                    className={`${inputBase} appearance-none pr-9`}
                    value={form.gender}
                    onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                  >
                    <option value="">Select…</option>
                    {GENDERS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
              </label>
              <label>
                {label('Date', false)}
                <input
                  className={inputBase}
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </label>
              <div className="flex justify-end gap-2 pt-2 md:col-span-2">
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
            <div className="mb-3 flex items-center justify-between">
              <h3 className={enj.sectionTitle}>Vendor audit</h3>
              <button
                type="button"
                onClick={() => setAuditRow(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-gray-100"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mb-1 text-sm font-medium text-gray-900">{String(auditRow.new_vendorname ?? '—')}</p>
            <p className="mb-3 text-xs text-gray-500">{String(auditRow.new_vendoremail ?? '')}</p>
            <ul className="space-y-2 text-sm">
              {vendorAuditLines(auditRow).map((line) => (
                <li key={line.label} className="flex flex-col sm:flex-row sm:gap-2">
                  <span className="shrink-0 font-medium text-gray-500">{line.label}:</span>
                  <span className="break-all text-gray-800">{line.value}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[11px] text-gray-400">Full change history can be wired to your audit table or flow if required.</p>
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
            <h3 className={enj.sectionTitle}>Confirm Delete</h3>
            <p className="mt-2 text-sm text-gray-600">Do you want to delete this vendor?</p>
            <p className="mt-1 text-sm text-gray-500">{String(pendingDelete.new_vendorname ?? 'Record')}</p>
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
                onClick={() => void remove(String(pendingDelete.new_vendorid ?? ''))}
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
