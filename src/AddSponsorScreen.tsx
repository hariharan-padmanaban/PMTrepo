import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { SponsorsService } from './services/SponsorsService';
import { NotificationToast, type ToastType } from './NotificationToast';
import { enj } from './ui/enjForm';

export const SPONSOR_FORM_ACCENT = '#A08149';

type FormState = {
  sponsorName: string;
  email: string;
};

const EMPTY: FormState = {
  sponsorName: '',
  email: '',
};

function validate(f: FormState): Partial<Record<keyof FormState, string>> {
  const e: Partial<Record<keyof FormState, string>> = {};
  if (!f.sponsorName.trim()) e.sponsorName = 'Required';
  if (!f.email.trim()) e.email = 'Required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Invalid email';
  return e;
}

function fallbackGuid() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    })
  );
}

type AddSponsorScreenProps = {
  onCreated?: () => void;
};

export function AddSponsorScreen({ onCreated }: AddSponsorScreenProps = {}) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(null);
  const [idPreview, setIdPreview] = useState('');

  const refreshIdPreview = useCallback(async () => {
    try {
      const p = await SponsorsService.getNextIdPreview();
      setIdPreview(p);
    } catch {
      setIdPreview('SP1');
    }
  }, []);

  useEffect(() => {
    void refreshIdPreview();
  }, [refreshIdPreview]);

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
        const payload: Record<string, unknown> = {
          new_sponsorid: fallbackGuid(),
          new_sponsorname: form.sponsorName.trim(),
          new_sponsormailid: form.email.trim(),
          statecode: 0,
        };
        const res = await SponsorsService.create(payload);
        if (!res.success) throw new Error(res.error?.message ?? 'Failed to add sponsor');
        setToast({ type: 'success', message: 'Sponsor added successfully.' });
        setForm(EMPTY);
        setErrors({});
        await refreshIdPreview();
        onCreated?.();
      } catch (err) {
        setToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to add sponsor' });
      } finally {
        setSubmitting(false);
      }
    },
    [form, onCreated, refreshIdPreview],
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
        <h2 className="mb-6 text-lg font-bold text-gray-900">Add New Sponsor</h2>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
            <label className="block">
              {label('Sponsor', true)}
              <input
                className={inputBase}
                value={form.sponsorName}
                onChange={(e) => setForm((f) => ({ ...f, sponsorName: e.target.value }))}
                autoComplete="organization"
              />
              {errors.sponsorName && <p className="mt-1 text-[11px] text-red-600">{errors.sponsorName}</p>}
            </label>

            <label className="block">
              {label('ID', false)}
              <input
                className={`${inputBase} cursor-not-allowed bg-gray-100 text-gray-500`}
                disabled
                readOnly
                value={idPreview}
                title="Informational preview (count + 1). System ID is generated on save."
              />
            </label>

            <label className="block md:col-span-1">
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
