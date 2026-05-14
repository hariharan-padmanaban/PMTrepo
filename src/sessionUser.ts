/**
 * Single place for “current user” (Power Apps User().Email + Users table name),
 * shared by ProfileDropdown and fields like Business Owner.
 */

import { getClient } from '@microsoft/power-apps/data';
import { dataSourcesInfo } from '../.power/schemas/appschemas/dataSourcesInfo';
import { NewUsersService } from './services/NewUsersService';

type GlobalContextLike = {
  getUserName?: () => string;
  userSettings?: { userEmail?: string; userName?: string };
};

function tryGetGlobalContext(win: Window): GlobalContextLike | undefined {
  try {
    const x = (win as unknown as { Xrm?: { Utility?: { getGlobalContext?: () => GlobalContextLike } } }).Xrm;
    return x?.Utility?.getGlobalContext?.();
  } catch {
    return undefined;
  }
}

/** Code apps often run in an iframe; `Xrm` is usually on `parent` / `top`. */
function getGlobalContextFromPage(): GlobalContextLike | undefined {
  const seen = new Set<Window>();
  const order: Window[] = [];
  const push = (w: Window | null | undefined) => {
    if (!w || seen.has(w)) return;
    seen.add(w);
    order.push(w);
  };
  push(window);
  try {
    push(window.parent);
  } catch {
    /* cross-origin */
  }
  try {
    push(window.top);
  } catch {
    /* cross-origin */
  }
  try {
    push(window.opener);
  } catch {
    /* cross-origin */
  }
  for (const w of order) {
    const ctx = tryGetGlobalContext(w);
    if (ctx) return ctx;
  }
  return undefined;
}

function formatLocalPartOfEmailOrUpn(s: string): string {
  if (!s.includes('@')) return s.trim();
  const local = s.split('@')[0]?.trim() ?? '';
  return local
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function displayNameFromXrmString(s: string): string {
  const t = s.trim();
  if (!t) return '';
  if (!t.includes('@')) return t;
  return formatLocalPartOfEmailOrUpn(t);
}

/** Power Apps `User().Email` (synchronous) — tries Xrm and context methods. */
export function getSessionUserEmail(): string | undefined {
  // Try 1: Xrm userSettings email
  const fromXrm = getGlobalContextFromPage()?.userSettings?.userEmail;
  if (typeof fromXrm === 'string' && fromXrm.includes('@')) return fromXrm.trim();

  // Try 2: Power Apps PCF context (window.__PAC__)
  try {
    const pacContext = (window as any).__PAC__;
    if (pacContext?.context?.userSettings?.userName) {
      const email = String(pacContext.context.userSettings.userName).trim();
      if (email.includes('@')) return email;
    }
  } catch {
    /* PCF context not available */
  }

  // Try 3: Xrm userName (may contain email)
  try {
    const ctx = getGlobalContextFromPage();
    const userName = ctx?.userSettings?.userName ?? ctx?.getUserName?.();
    if (typeof userName === 'string' && userName.includes('@')) {
      return userName.trim();
    }
  } catch {
    /* Not available */
  }

  // Try 4: Check if email is stored in sessionStorage by Power Apps
  try {
    const stored = sessionStorage.getItem('__user_email__') ??
                   sessionStorage.getItem('userEmail') ??
                   sessionStorage.getItem('email');
    if (typeof stored === 'string' && stored.includes('@')) return stored.trim();
  } catch {
    /* sessionStorage not available */
  }

  // Try 5: Environment variable for development
  const fromEnv = import.meta.env.VITE_DEV_USER_EMAIL as string | undefined;
  if (fromEnv?.trim() && fromEnv.includes('@')) return fromEnv.trim();

  return undefined;
}

/** Try to fetch current user email from Office 365 Users connector first, then Dataverse (async fallback during login) */
export async function getSessionUserEmailFromDataverseAsync(): Promise<string | undefined> {
  // Try Office 365 Users connector first (most reliable)
  let email = await getSessionUserEmailFromOffice365();
  if (email) return email;

  // Fallback to Dataverse systemuser table
  email = await getSessionUserEmailFromDataverse();
  return email;
}

/** Fetch current user's email from Office 365 Users connector */
async function getSessionUserEmailFromOffice365(): Promise<string | undefined> {
  try {
    const client = getClient(dataSourcesInfo);

    // Call Office 365 Users MyProfileV2 to get current user's profile
    const result = await client.executeAsync({
      dataverseRequest: {
        action: 'CloudLogicFlow',
        parameters: {
          actionName: 'office365users_GetMyProfile',
        },
      },
    } as any);

    if (result?.data) {
      const profileData = result.data as Record<string, unknown>;
      const email = String(profileData.mail ?? profileData.userPrincipalName ?? '').trim();
      if (email && email.includes('@')) return email;
    }
  } catch {
    // Office 365 connector call failed, will try other methods
  }
  return undefined;
}

/** Fetch current user's email directly from Dataverse systemuser table */
async function getSessionUserEmailFromDataverse(): Promise<string | undefined> {
  try {
    const client = getClient(dataSourcesInfo);

    // Query systemuser table to get current user's email
    // The API automatically uses the currently authenticated user's context
    const result = await client.retrieveMultipleRecordsAsync('systemusers', {
      select: ['internalemailaddress', 'domainname'],
      top: 1,
    });

    if (result.success && result.data && result.data.length > 0) {
      const user = result.data[0] as Record<string, unknown>;
      const email = String(user.internalemailaddress ?? user.domainname ?? '').trim();
      if (email && email.includes('@')) return email;
    }
  } catch {
    // Dataverse query failed, will try other methods
  }
  return undefined;
}

/**
 * When Users table or profile has no name — same idea as `User().FullName`.
 * UPNs are shown as a readable name.
 */
export function getPowerAppsUserFullName(): string | undefined {
  const fromEnv = (import.meta.env.VITE_DEV_USER_FULL_NAME as string | undefined)?.trim();
  if (fromEnv) return fromEnv;
  const ctx = getGlobalContextFromPage();
  const fromApi = ctx?.getUserName?.();
  if (typeof fromApi === 'string' && fromApi.trim()) return displayNameFromXrmString(fromApi);
  const u = ctx?.userSettings?.userName;
  if (typeof u === 'string' && u.trim()) return displayNameFromXrmString(u);
  return undefined;
}

export function findUsersRowBySessionEmail(
  urows: Array<Record<string, unknown>>,
  sessionLower: string,
): Record<string, unknown> | undefined {
  if (!sessionLower) return undefined;
  const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();
  for (const r of urows) {
    const emailId = norm(r.new_newcolumn);
    const userIdField = norm(r.new_userid);
    if (emailId && emailId === sessionLower) return r;
    if (userIdField && userIdField === sessionLower) return r;
  }
  for (const r of urows) {
    const nm = norm(r.new_name);
    if (nm.includes('@') && nm === sessionLower) return r;
  }
  return undefined;
}

export type SessionUserProfile = {
  /** Users.new_name (Name), or formatted if that column held an email. */
  displayName: string;
  /** Best-effort `User().Email` for the row: primary is `new_newcolumn` (Email ID). */
  email: string;
};

/**
 * Same resolution as the header `ProfileDropdown`: look up the signed-in user in `new_users`
 * by `new_newcolumn` (email) and legacy `new_userid` if it held an email, then use `new_name` for display.
 */
export async function fetchSessionUserProfileFromUsers(options?: {
  /** When true, if no user matches the session, use the first row (header profile behavior). */
  fallbackToFirstRow?: boolean;
}): Promise<SessionUserProfile | null> {
  const sessionEmail = getSessionUserEmail()?.trim().toLowerCase() ?? '';
  const res = await NewUsersService.getAll({ top: 2000, orderBy: ['createdon desc'] });
  if (!res.success) return null;
  const rows = (res.data ?? []) as Array<Record<string, unknown>>;
  let row: Record<string, unknown> | undefined = sessionEmail
    ? findUsersRowBySessionEmail(rows, sessionEmail)
    : undefined;
  if (!row && options?.fallbackToFirstRow && rows.length) {
    row = rows[0];
  }
  if (!row) return null;
  const newCol = String(row.new_newcolumn ?? '').trim();
  const userIdCol = String(row.new_userid ?? '').trim();
  const emailFromRow =
    (newCol.includes('@') ? newCol : '') || (userIdCol.includes('@') ? userIdCol : '') || newCol;
  const email = (emailFromRow || sessionEmail).trim().toLowerCase();
  const nameRaw = String(row.new_name ?? '').trim();
  const displayName = nameRaw.includes('@') ? displayNameFromXrmString(nameRaw) : nameRaw;
  if (!email && !displayName) return null;
  return { displayName, email: email.toLowerCase() };
}
