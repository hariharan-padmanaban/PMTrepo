import { useEffect, type ReactNode } from 'react';
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
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);
  const config: Record<ToastType, { ring: string; bg: string; text: string; icon: ReactNode }> = {
    success: {
      ring: 'ring-emerald-200',
      bg: 'bg-emerald-50',
      text: 'text-emerald-800',
      icon: <CheckCircle2 size={20} className="text-emerald-600" />,
    },
    error: {
      ring: 'ring-rose-200',
      bg: 'bg-rose-50',
      text: 'text-rose-800',
      icon: <XCircle size={20} className="text-rose-600" />,
    },
    info: {
      ring: 'ring-sky-200',
      bg: 'bg-sky-50',
      text: 'text-sky-800',
      icon: <Info size={20} className="text-sky-600" />,
    },
  };

  const style = config[type];
  return (
    <>
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
      <div
        className={`fixed top-4 right-4 z-[400] min-w-[300px] max-w-[420px] rounded-lg p-4 shadow-lg ring-1 ${style.ring} ${style.bg}`}
        style={{
          animation: 'slideInRight 0.3s ease-out',
        }}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5">{style.icon}</div>
          <p className={`text-sm font-medium ${style.text} flex-1`}>{message}</p>
          <button
            type="button"
            className={`flex-shrink-0 text-gray-400 hover:text-gray-600 transition rounded p-1`}
            onClick={onClose}
          >
            ✕
          </button>
        </div>
      </div>
    </>
  );
}
