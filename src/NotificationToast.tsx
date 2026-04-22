import type { ReactNode } from 'react';
import { CheckCircle2, Info, XCircle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export function NotificationToast({
  type,
  message,
  onClose,
}: {
  type: ToastType;
  message: string;
  onClose: () => void;
}) {
  const config: Record<ToastType, { ring: string; bg: string; text: string; icon: ReactNode }> = {
    success: {
      ring: 'ring-emerald-200',
      bg: 'bg-emerald-50',
      text: 'text-emerald-800',
      icon: <CheckCircle2 size={16} className="text-emerald-600" />,
    },
    error: {
      ring: 'ring-rose-200',
      bg: 'bg-rose-50',
      text: 'text-rose-800',
      icon: <XCircle size={16} className="text-rose-600" />,
    },
    info: {
      ring: 'ring-sky-200',
      bg: 'bg-sky-50',
      text: 'text-sky-800',
      icon: <Info size={16} className="text-sky-600" />,
    },
  };

  const style = config[type];
  return (
    <div className={`fixed top-4 right-4 z-[400] min-w-[280px] max-w-[420px] rounded-lg p-3 shadow-md ring-1 ${style.ring} ${style.bg}`}>
      <div className="flex items-start gap-2">
        <div className="mt-0.5">{style.icon}</div>
        <p className={`text-sm ${style.text} flex-1`}>{message}</p>
        <button type="button" className="text-xs text-gray-500 hover:text-gray-700" onClick={onClose}>
          ✕
        </button>
      </div>
    </div>
  );
}
