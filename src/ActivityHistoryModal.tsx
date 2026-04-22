/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { X } from 'lucide-react';

export type ActivityHistoryModalProps = {
  open: boolean;
  onClose: () => void;
};

/** Compact read-only popup: employee snapshot and attendance-style fields (matches dashboard styling). */
export function ActivityHistoryModal({ open, onClose }: ActivityHistoryModalProps) {
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
          <h2 id="activity-history-title" className="text-base font-semibold text-[#151d5d]">
            Activity History
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-[#151d5d]"
            aria-label="Close"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#b28a44] text-sm font-semibold text-white">
              PN
            </div>
            <div>
              <p className="text-sm font-semibold text-[#151d5d]">pms admin</p>
              <p className="text-xs text-gray-500">Employee ID: EMP1</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-600">Onboard Date</p>
              <p className="text-sm text-[#2d356b]">2025-08-11</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-600">Status</p>
              <p className="text-sm text-[#2d356b]">Active</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-600">Last In Time</p>
              <p className="text-sm text-[#2d356b]">19/04/2026 22:32</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-600">Last Out Time</p>
              <p className="text-sm text-[#2d356b]">1/29/2026 2:49 PM</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
