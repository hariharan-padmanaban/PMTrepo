/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { enj } from './ui/enjForm';

export type UserProfileModalProps = {
  open: boolean;
  onClose: () => void;
};

const readOnlyInputCls = `${enj.control} cursor-default bg-gray-50`;

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
          <h2 id="user-profile-title" className="enj-screen-subheader">
            User Profile
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-primary"
            aria-label="Close"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-gray-600">Name</span>
            <input readOnly tabIndex={-1} value="PMS Admin" className={readOnlyInputCls} />
          </label>

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
          </div>
        </div>
      </div>
    </div>
  );
}
