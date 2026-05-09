import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ChevronDown } from 'lucide-react';
import { ClientsService } from './services/ClientsService';
import { NotificationToast, type ToastType } from './NotificationToast';
import { enj } from './ui/enjForm';

export const CLIENT_BUSINESS_TYPES = [
  'Individual',
  'Company',
  'Private',
  'Government',
  'Non-profit',
  'Partnership',
  'Corporation',
  'LLC',
  'Sole proprietorship',
] as const;

type FormState = {
  companyName: string;
  email: string;
  industrySector: string;
  primaryContact: string;
  businessType: string;
  phone: string;
};

const EMPTY: FormState = {
  companyName: '',
  email: '',
  industrySector: '',
  primaryContact: '',
  businessType: '',
  phone: '',
};

export const CLIENT_FORM_ACCENT = '#A08149';

function validate(f: FormState): Partial<Record<keyof FormState, string>> {
  const e: Partial<Record<keyof FormState, string>> = {};
  if (!f.companyName.trim()) e.companyName = 'Required';
  if (!f.email.trim()) e.email = 'Required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Invalid email';
  if (!f.industrySector.trim()) e.industrySector = 'Required';
  if (!f.primaryContact.trim()) e.primaryContact = 'Required';
  if (!f.businessType.trim()) e.businessType = 'Required';
  if (!f.phone.trim()) e.phone = 'Required';
  return e;
}

type AddClientScreenProps = {
  /** Called after a client is created successfully (e.g. return to list). */
  onCreated?: () => void;
};

export function AddClientScreen({ onCreated }: AddClientScreenProps = {}) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(null);
  const [nextClPreview, setNextClPreview] = useState('');

  const refreshClPreview = useCallback(async () => {
    try {
      const c = await ClientsService.getNextClCode();
      setNextClPreview(c);
    } catch {
      setNextClPreview('CL1');
    }
  }, []);

  useEffect(() => {
    void refreshClPreview();
  }, [refreshClPreview]);

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
        const clCode = await ClientsService.getNextClCode();
        const payload: Record<string, unknown> = {
          new_clientname: form.companyName.trim(),
          new_clientemail: form.email.trim(),
          new_industrysector: form.industrySector.trim(),
          new_primarycontactname: form.primaryContact.trim(),
          new_businesstype: form.businessType.trim(),
          new_phonenumber: form.phone.trim(),
          new_appstatus: clCode,
        };
        const res = await ClientsService.create(payload);
        if (!res.success) throw new Error(res.error?.message ?? 'Failed to add client');
        setToast({ type: 'success', message: 'Client added successfully.' });
        setForm(EMPTY);
        setErrors({});
        await refreshClPreview();
        onCreated?.();
      } catch (err) {
        setToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to add client' });
      } finally {
        setSubmitting(false);
      }
    },
    [form, onCreated, refreshClPreview],
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

      <div className={`${enj.card} p-6 max-w-4xl`}>
        <h2 className="enj-screen-subheader mb-6">Add New Client</h2>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <label className="block">
              {label('Company Name', true)}
              <input
                className={inputBase}
                value={form.companyName}
                onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                autoComplete="organization"
              />
              {errors.companyName && <p className="text-[11px] text-red-600 mt-1">{errors.companyName}</p>}
            </label>

            <label className="block">
              {label('Client ID', false)}
              <input
                className={`${inputBase} bg-gray-100 text-gray-500 cursor-not-allowed`}
                disabled
                readOnly
                value={nextClPreview}
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
              {errors.email && <p className="text-[11px] text-red-600 mt-1">{errors.email}</p>}
            </label>

            <label className="block">
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

            <label className="block">
              {label('Industry / Sector', true)}
              <input
                className={inputBase}
                value={form.industrySector}
                onChange={(e) => setForm((f) => ({ ...f, industrySector: e.target.value }))}
              />
              {errors.industrySector && <p className="text-[11px] text-red-600 mt-1">{errors.industrySector}</p>}
            </label>

            <label className="block">
              {label('Phone Number', true)}
              <input
                className={inputBase}
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                autoComplete="tel"
              />
              {errors.phone && <p className="text-[11px] text-red-600 mt-1">{errors.phone}</p>}
            </label>

            <label className="block">
              {label('Primary Contact Name', true)}
              <input
                className={inputBase}
                value={form.primaryContact}
                onChange={(e) => setForm((f) => ({ ...f, primaryContact: e.target.value }))}
                autoComplete="name"
              />
              {errors.primaryContact && <p className="text-[11px] text-red-600 mt-1">{errors.primaryContact}</p>}
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
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
