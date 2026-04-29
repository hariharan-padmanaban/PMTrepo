/**
 * Sends JSON to a Power Automate "When an HTTP request is received" flow that runs
 * Office 365 Outlook "Send an email (V2)" (or similar). The flow’s request body schema
 * should match: { to, from, subject, body }.
 *
 * CORS: In Power Automate, use the trigger’s “Settings” to allow the origin of this app
 * if the browser blocks the POST.
 */

export type PowerAutomateEmailPayload = {
  to: string;
  from: string;
  subject: string;
  body: string;
};

export async function postEmailRequestToFlow(
  payload: PowerAutomateEmailPayload,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = (import.meta.env.VITE_POWER_AUTOMATE_EMAIL_URL as string | undefined)?.trim();
  if (!url) {
    return {
      ok: false,
      error:
        'Set VITE_POWER_AUTOMATE_EMAIL_URL in your .env to your flow’s HTTP POST URL, then restart the dev server.',
    };
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      return { ok: false, error: `Flow returned ${res.status}${t ? `: ${t.slice(0, 200)}` : ''}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}
