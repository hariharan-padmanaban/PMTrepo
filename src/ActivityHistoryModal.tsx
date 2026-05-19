/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { X } from 'lucide-react';

export type ActivityHistoryModalProps = {
  open: boolean;
  onClose: () => void;
  userData?: Record<string, unknown> | null;
};

/** Compact read-only popup: employee snapshot and attendance-style fields (matches dashboard styling). */
export function ActivityHistoryModal({ open, onClose, userData }: ActivityHistoryModalProps) {
  const formatDate = (dateString: unknown): string => {
    if (!dateString) return '-';
    const dateStr = String(dateString ?? '').trim();
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      if (Number.isNaN(date.getTime())) return '-';
      const formatted = date.toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      return formatted?.replace(/,/g, '') ?? '-';
    } catch {
      return '-';
    }
  };
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onEsc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onEsc);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-xl border border-gray-100 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-history-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 id="activity-history-title" className="text-base font-semibold text-primary">
            Activity History
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-primary"
            aria-label="Close"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <div className="flex items-center gap-3">
            {(() => {
              const name = String(userData?.new_name ?? '').trim() || String(userData?.new_newcolumn ?? '').trim().split('@')[0] || 'User';
              const initials = name
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((p) => p[0]?.toUpperCase() ?? '')
                .join('') || 'U';
              return (
                <>
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#b28a44] text-sm font-semibold text-white">
                    {initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-primary">{name}</p>
                    <p className="text-xs text-gray-500">Employee ID: {String(userData?.new_userid ?? '-')}</p>
                  </div>
                </>
              );
            })()}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-600">Onboard Date</p>
              <p className="text-sm text-primary">{userData?.new_onboardeddate ? formatDate(userData.new_onboardeddate) : '-'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-600">Status</p>
              <p className="text-sm text-primary">{String(userData?.new_statusname ?? 'Active')}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-600">Last In Time</p>
              <p className="text-sm text-primary">{formatDate(userData?.crcf8_lastintime)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-600">Last Out Time</p>
              <p className="text-sm text-primary">{formatDate(userData?.crcf8_lastouttime)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
