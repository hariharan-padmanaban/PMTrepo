import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ChevronDown } from 'lucide-react';
import { VendorsService } from './services/VendorsService';
import { NotificationToast, type ToastType } from './NotificationToast';
import { enj } from './ui/enjForm';

export const VENDOR_FORM_ACCENT = '#A08149';

/** Dataverse `new_BusinessType` option set. */
export const VENDOR_BUSINESS_OPTIONS = [
  { value: 100000000, label: 'Retail' },
  { value: 100000001, label: 'Wholesale' },
  { value: 100000002, label: 'Manufacturing' },
  { value: 100000003, label: 'Service' },
] as const;

const GENDERS = ['Male', 'Female', 'Other'] as const;

type FormState = {
  vendorName: string;
  email: string;
  businessType: string; // option set value as string, e.g. "100000000"
  phone: string;
  primaryContact: string;
  sector: string;
  gender: string;
  date: string; // YYYY-MM-DD
};

const EMPTY: FormState = {
  vendorName: '',
  email: '',
  businessType: '',
  phone: '',
  primaryContact: '',
  sector: '',
  gender: '',
  date: '',
};

function validate(f: FormState): Partial<Record<keyof FormState, string>> {
  const e: Partial<Record<keyof FormState, string>> = {};
  if (!f.vendorName.trim()) e.vendorName = 'Required';
  if (!f.email.trim()) e.email = 'Required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Invalid email';
  if (!f.businessType) e.businessType = 'Required';
  if (!f.phone.trim()) e.phone = 'Required';
  if (!f.primaryContact.trim()) e.primaryContact = 'Required';
  if (!f.sector.trim()) e.sector = 'Required';
  return e;
}

function fallbackGuid() {
  return globalThis.crypto?.randomUUID?.() ?? `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

type AddVendorScreenProps = {
  onCreated?: () => void;
};

export function AddVendorScreen({ onCreated }: AddVendorScreenProps = {}) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(null);
  const [nextVPreview, setNextVPreview] = useState('');

  const refreshVPreview = useCallback(async () => {
    try {
      const c = await VendorsService.getNextVnCode();
      setNextVPreview(c);
    } catch {
      setNextVPreview('V1');
    }
  }, []);

  useEffect(() => {
    void refreshVPreview();
  }, [refreshVPreview]);

  const onCancel = useCallback(() => {
    setForm(EMPTY);
    setErrors({});
  }, []);

  const onSubmit = useCallback(
    async (ev: FormEvent<HTMLFormElement>) => {
      ev.preventDefault();
      const next = validate(form);
      setErrors(next);
      if (Object.keys(next).length > 0) return;
      setSubmitting(true);
      try {
        const vCode = await VendorsService.getNextVnCode();
        const businessNum = Number(form.businessType);
        const payload: Record<string, unknown> = {
          new_vendorid: fallbackGuid(),
          new_vendorname: form.vendorName.trim(),
          new_vendoremail: form.email.trim(),
          new_appstatus: vCode,
          new_businesstype: businessNum,
          new_phonenumber: form.phone.trim(),
          new_primarycontactperson: form.primaryContact.trim(),
          new_sector: form.sector.trim(),
          new_gender: form.gender.trim() || undefined,
          new_date: form.date.trim() || undefined,
          new_status: 100000000,
          statecode: 0,
        };
        const res = await VendorsService.create(payload);
        if (!res.success) throw new Error(res.error?.message ?? 'Failed to add vendor');
        setToast({ type: 'success', message: 'Vendor added successfully.' });
        setForm(EMPTY);
        setErrors({});
        await refreshVPreview();
        onCreated?.();
      } catch (err) {
        setToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to add vendor' });
      } finally {
        setSubmitting(false);
      }
    },
    [form, onCreated, refreshVPreview],
  );

  const inputBase =
    'mt-1 h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400';
  const label = (text: string, required?: boolean) => (
    <span className="text-sm text-gray-900">
      {text}
      {required && <span className="text-red-500"> *</span>}
    </span>
  );

  return (
    <div>
      {toast && <NotificationToast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      <div className={`max-w-4xl ${enj.card} p-6`}>
        <h2 className="mb-6 text-lg font-bold text-gray-900">Add New Vendor</h2>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
            <label className="block">
              {label('Vendor Name', true)}
              <input
                className={inputBase}
                value={form.vendorName}
                onChange={(e) => setForm((f) => ({ ...f, vendorName: e.target.value }))}
                autoComplete="organization"
              />
              {errors.vendorName && <p className="mt-1 text-[11px] text-red-600">{errors.vendorName}</p>}
            </label>

            <label className="block">
              {label('Vendor ID', false)}
              <input
                className={`${inputBase} cursor-not-allowed bg-gray-100 text-gray-500`}
                disabled
                readOnly
                value={nextVPreview}
                placeholder="—"
                title="Assigned on save (next available code)"
              />
            </label>

            <label className="block">
              {label('Email', true)}
              <input
                className={inputBase}
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                autoComplete="email"
              />
              {errors.email && <p className="mt-1 text-[11px] text-red-600">{errors.email}</p>}
            </label>

            <label className="block">
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

            <label className="block">
              {label('Phone number', true)}
              <input
                className={inputBase}
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                autoComplete="tel"
              />
              {errors.phone && <p className="mt-1 text-[11px] text-red-600">{errors.phone}</p>}
            </label>

            <label className="block">
              {label('Primary contact', true)}
              <input
                className={inputBase}
                value={form.primaryContact}
                onChange={(e) => setForm((f) => ({ ...f, primaryContact: e.target.value }))}
                autoComplete="name"
              />
              {errors.primaryContact && <p className="mt-1 text-[11px] text-red-600">{errors.primaryContact}</p>}
            </label>

            <label className="block">
              {label('Sector', true)}
              <input className={inputBase} value={form.sector} onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value }))} />
              {errors.sector && <p className="mt-1 text-[11px] text-red-600">{errors.sector}</p>}
            </label>

            <label className="block">
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

            <label className="block">
              {label('Date', false)}
              <input
                className={inputBase}
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </label>
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className={enj.btnOutline}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={enj.btnPrimary}
            >
              {submitting ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
