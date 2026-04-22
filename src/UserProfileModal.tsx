/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { X } from 'lucide-react';

export type UserProfileModalProps = {
  open: boolean;
  onClose: () => void;
};

const readOnlyInputCls =
  'w-full cursor-default rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-[#2d356b] outline-none';

/** Read-only profile summary opened from the profile menu (matches ENJAZ dashboard styling). */
export function UserProfileModal({ open, onClose }: UserProfileModalProps) {
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
        className="relative w-full max-w-xl rounded-xl border border-gray-100 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-profile-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="user-profile-title" className="text-base font-semibold text-[#151d5d]">
              User Profile
            </h2>
            <button
              type="button"
              className="rounded-md bg-sky-100 px-3 py-1.5 text-xs font-medium text-sky-800 hover:bg-sky-200"
            >
              Audit
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-[#151d5d]"
            aria-label="Close"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-gray-600">First Name</span>
              <input readOnly tabIndex={-1} value="PMS" className={readOnlyInputCls} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-gray-600">Last Name</span>
              <input readOnly tabIndex={-1} value="Admin" className={readOnlyInputCls} />
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-gray-600">Email</span>
            <input
              readOnly
              tabIndex={-1}
              value="pms.admin@almajles.gov.ae"
              className={readOnlyInputCls}
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-gray-600">Employee ID</span>
              <input readOnly tabIndex={-1} value="EMP1" className={readOnlyInputCls} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-gray-600">Gender</span>
              <input readOnly tabIndex={-1} value="Male" className={readOnlyInputCls} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-gray-600">Department</span>
              <input readOnly tabIndex={-1} value="Admin" className={readOnlyInputCls} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-gray-600">Access Type</span>
              <input readOnly tabIndex={-1} value="User" className={readOnlyInputCls} />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
