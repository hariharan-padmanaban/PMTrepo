/**
 * Calls a Power Automate HTTP-trigger flow that creates/schedules
 * a Microsoft Teams meeting.
 */

export type PowerAutomateMeetingPayload = {
  meetingTitle: string;
  meetingCategory?: string;
  projectName?: string;
  vendorName?: string;
  projectManager?: string;
  inviteMembers: string[];
  department: string[];
  repeat: 'Does not Repeat' | 'Repeat';
  meetingDate: string;
  startTime: string;
  endTime: string;
  meetingLocation?: string;
  agenda?: string;
};

type MeetingFlowResult = {
  ok: true;
  teamsJoinUrl?: string;
  teamsMeetingId?: string;
} | {
  ok: false;
  error: string;
};

export async function postMeetingRequestToFlow(payload: PowerAutomateMeetingPayload): Promise<MeetingFlowResult> {
  const url = (import.meta.env.VITE_POWER_AUTOMATE_TEAMS_MEETING_URL as string | undefined)?.trim();
  if (!url) {
    return {
      ok: false,
      error:
        'Set VITE_POWER_AUTOMATE_TEAMS_MEETING_URL in your .env to your Teams meeting flow HTTP URL, then restart the app.',
    };
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await res.text().catch(() => '');
    if (!res.ok) return { ok: false, error: `Flow returned ${res.status}${text ? `: ${text.slice(0, 220)}` : ''}` };
    if (!text.trim()) return { ok: true };
    try {
      const json = JSON.parse(text) as { teamsJoinUrl?: string; teamsMeetingId?: string; joinUrl?: string; meetingId?: string };
      return {
        ok: true,
        teamsJoinUrl: String(json.teamsJoinUrl ?? json.joinUrl ?? '').trim() || undefined,
        teamsMeetingId: String(json.teamsMeetingId ?? json.meetingId ?? '').trim() || undefined,
      };
    } catch {
      return { ok: true };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error while calling Teams flow' };
  }
}
