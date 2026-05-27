/**
 * Shared profile menu — consistent across Business / Program / Project / Team / Admin.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Activity, ChevronDown, Inbox, LogOut, UserCircle } from 'lucide-react';
import { ActivityHistoryModal } from './ActivityHistoryModal';
import { UserProfileModal } from './UserProfileModal';
import { fetchSessionUserProfileFromUsers } from './sessionUser';

export function ProfileDropdown({
  onLogout,
  roleLabel,
  userData,
}: {
  onLogout: () => void;
  roleLabel: string;
  userData?: Record<string, unknown> | null;
}) {
  const [open, setOpen] = useState(false);
  const [activityHistoryOpen, setActivityHistoryOpen] = useState(false);
  const [userProfileOpen, setUserProfileOpen] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [sessionEmail, setSessionEmail] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const nameFromUserData = useMemo(() => {
    if (!userData) return '';
    return (
      String(userData.new_name ?? '').trim() ||
      String(userData.new_newcolumn ?? '').trim().split('@')[0] ||
      ''
    );
  }, [userData]);

  const emailFromUserData = useMemo(
    () => (userData ? String(userData.new_newcolumn ?? '').trim() : ''),
    [userData],
  );

  const displayName = nameFromUserData || sessionName || 'User';
  const profileEmail = emailFromUserData || sessionEmail;

  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || 'U';

  const items = [
    { label: 'User Profile', icon: <UserCircle size={14} className="text-[#c7a56a]" /> },
    { label: 'Inbox', icon: <Inbox size={14} className="text-[#c7a56a]" /> },
    { label: 'Activity History', icon: <Activity size={14} className="text-[#c7a56a]" /> },
  ];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const onEsc = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  useEffect(() => {
    if (userData) return;
    let cancelled = false;
    (async () => {
      try {
        const profile = await fetchSessionUserProfileFromUsers({ fallbackToFirstRow: true });
        if (cancelled || !profile) return;
        if (profile.displayName) setSessionName(profile.displayName);
        if (profile.email) setSessionEmail(profile.email);
      } catch {
        /* keep fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userData]);

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((v) => (v + 1) % (items.length + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((v) => (v - 1 + items.length + 1) % (items.length + 1));
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (activeIndex === items.length) {
        onLogout();
      }
      setOpen(false);
    }
  };

  return (
    <>
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          className="flex items-center gap-1.5 hover:opacity-90 transition-opacity"
          aria-label="Profile menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <div
            className="w-8 h-8 rounded-full bg-[#b28a44] text-white text-[10px] font-semibold flex items-center justify-center"
            title={profileEmail || displayName}
          >
            {initials}
          </div>
          <ChevronDown size={13} className="text-gray-400" />
        </button>
        {open && (
          <div
            ref={menuRef}
            tabIndex={0}
            onKeyDown={onMenuKeyDown}
            className="absolute right-0 top-10 z-50 w-52 rounded-xl border border-gray-200 bg-white shadow-xl outline-none"
          >
            <div className="px-3 py-3 border-b border-gray-100">
              <p className="enj-screen-subheader">{displayName}</p>
              <p className="text-[10px] text-gray-400">{roleLabel}</p>
            </div>
            <div className="py-1">
              {items.map((item, index) => (
                <button
                  key={item.label}
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => {
                    if (item.label === 'User Profile') {
                      setUserProfileOpen(true);
                      setOpen(false);
                      return;
                    }
                    if (item.label === 'Activity History') {
                      setActivityHistoryOpen(true);
                      setOpen(false);
                      return;
                    }
                    if (item.label === 'Inbox') {
                      window.open('https://outlook.office.com/mail/', '_blank', 'noopener,noreferrer');
                      setOpen(false);
                    }
                  }}
                  className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 ${
                    activeIndex === index ? 'bg-gray-50 text-primary' : 'text-gray-500'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
            <div className="border-t border-gray-100 p-1">
              <button
                type="button"
                onClick={onLogout}
                onMouseEnter={() => setActiveIndex(items.length)}
                className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 rounded-lg ${
                  activeIndex === items.length ? 'bg-red-50 text-red-600' : 'text-gray-500'
                }`}
              >
                <LogOut size={14} className={activeIndex === items.length ? 'text-red-500' : 'text-[#c7a56a]'} />
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
      <UserProfileModal open={userProfileOpen} onClose={() => setUserProfileOpen(false)} />
      <ActivityHistoryModal open={activityHistoryOpen} onClose={() => setActivityHistoryOpen(false)} userData={userData} />
    </>
  );
}
