/**
 * Shared app shell for role dashboards that use the wide sidebar + ENJAZ wordmark
 * (Program, Project, Team, Admin). Business uses a compact icon rail and keeps its own layout.
 */
import type { ReactNode } from 'react';
import { LogoMark } from './LogoMark';
import { NotificationBell, type AppInboxNotificationItem } from './NotificationInbox';
import { ProfileDropdown } from './ProfileDropdown';
import { ThemeModeToggle } from './themeMode';

export type RoleDashboardShellProps = {
  /** Items rendered inside `<nav>` (nav buttons, nested menus, etc.). */
  sidebarNav: ReactNode;
  /** Tailwind classes for `<main>` — include padding, overflow, and flex growth to match sibling dashboards. */
  mainClassName: string;
  children: ReactNode;
  notificationItems: AppInboxNotificationItem[];
  onLogout: () => void;
  roleLabel: string;
  userData: Record<string, unknown> | null;
};

export function RoleDashboardShell({
  sidebarNav,
  mainClassName,
  children,
  notificationItems,
  onLogout,
  roleLabel,
  userData,
}: RoleDashboardShellProps) {
  return (
    <div className="flex h-[calc(100vh-2rem)] overflow-hidden bg-[#f5f6fb] text-gray-800">
      <aside className="z-[60] w-52 flex min-h-0 shrink-0 flex-col border-r border-gray-100 bg-[#FBFAFF] pb-8">
        {/* Logo + wordmark — same block as Program / Project / Team */}
        <div className="flex h-14 items-center gap-3 border-b border-gray-100 px-4">
          <LogoMark />
          <span className="text-base font-bold tracking-wide text-[#232360] sm:text-lg">ENJAZ</span>
        </div>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4">{sidebarNav}</nav>
        <div className="shrink-0 border-t border-gray-100 px-3 py-4">
          <ThemeModeToggle />
        </div>
      </aside>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center border-b border-gray-100 bg-[#FFFFFF] px-6">
          <div className="ml-auto flex items-center gap-4">
            <NotificationBell items={notificationItems} />
            <ProfileDropdown onLogout={onLogout} roleLabel={roleLabel} userData={userData ?? null} />
          </div>
        </header>
        <main className={mainClassName}>{children}</main>
      </div>
    </div>
  );
}
