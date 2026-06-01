import { useEffect, type ReactNode } from 'react';
import { enj } from './ui/enjForm';

/** Lock document scroll and full-bleed gray canvas while a form page is open. */
export function useFormPageLayout(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const html = document.documentElement;
    const { body } = document;
    const main = document.querySelector('main');
    html.classList.add('enj-add-project-active');
    body.classList.add('enj-add-project-active');
    main?.classList.add('enj-add-project-main');
    return () => {
      html.classList.remove('enj-add-project-active');
      body.classList.remove('enj-add-project-active');
      main?.classList.remove('enj-add-project-main');
    };
  }, [active]);
}

export function FormFieldLabel({ label, required = false }: { label: string; required?: boolean }) {
  return (
    <label className="mb-1 block text-[13px] font-normal leading-normal text-gray-600">
      {label}
      {required ? <span className="text-rose-500"> *</span> : null}
    </label>
  );
}

export function FormPageShell({
  parentLabel,
  onBack,
  title,
  children,
  cardClassName = '',
}: {
  parentLabel: string;
  onBack: () => void;
  title: string;
  children: ReactNode;
  /** Optional width/layout overrides for the white card (e.g. `!max-w-6xl`). */
  cardClassName?: string;
}) {
  useFormPageLayout(true);
  return (
    <div className="enj-add-project-root">
      <div className="enj-add-project-scroll">
        <div className="enj-add-project-shell">
          <section className={`enj-add-project-card ${cardClassName}`.trim()}>
            <p className="enj-add-project-breadcrumb">
              <button type="button" onClick={onBack}>{parentLabel}</button>
              {' > '}{title}
            </p>
            {children}
          </section>
        </div>
      </div>
    </div>
  );
}

export function FormPageActions({
  onCancel,
  onClear,
  onSave,
  busy,
  saveLabel = 'Save',
  showClear = false,
  cancelLabel = 'Cancel',
  saveType = 'button',
}: {
  onCancel: () => void;
  onClear?: () => void;
  onSave: () => void;
  busy?: boolean;
  saveLabel?: string;
  showClear?: boolean;
  cancelLabel?: string;
  saveType?: 'button' | 'submit';
}) {
  return (
    <div className="enj-add-project-actions mt-5 flex items-center justify-end gap-3">
      <button
        type="button"
        className={`${enj.btn} ${enj.btnOutline} px-8 font-semibold`}
        onClick={onCancel}
        disabled={busy}
      >
        {cancelLabel}
      </button>
      {showClear && onClear && (
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
        type={saveType}
        className={`${enj.btn} ${enj.btnPrimary} px-8 font-semibold disabled:opacity-50`}
        onClick={saveType === 'button' ? onSave : undefined}
        disabled={busy}
      >
        {busy ? 'Saving...' : saveLabel}
      </button>
    </div>
  );
}
