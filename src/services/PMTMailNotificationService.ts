import { PMTMailNotifyService } from '../generated/services/PMTMailNotifyService';
import type { ManualTriggerInput } from '../generated/models/PMTMailNotifyModel';

export interface EmailNotificationPayload {
  toEmail: string;
  subject: string;
  htmlBody: string;
  ccEmail?: string;
  bccEmail?: string;
  fromEmail?: string;
}

/**
 * Maps our email payload to the PMTMailNotify flow's generic text fields.
 * Adjust field assignments based on your flow's actual input mapping.
 */
function mapPayloadToFlowInput(payload: EmailNotificationPayload): ManualTriggerInput {
  return {
    text: payload.toEmail,              // Recipient email(s)
    text_1: payload.subject,            // Subject
    text_2: payload.htmlBody,           // HTML body
    text_3: payload.ccEmail || '',      // CC (optional)
    text_4: payload.bccEmail || '',     // BCC (optional)
    text_5: payload.fromEmail || 'noreply@enjaz.com', // From email
  };
}

export async function sendEmailNotification(
  payload: EmailNotificationPayload,
): Promise<{ success: boolean; error?: string }> {
  try {
    const flowInput = mapPayloadToFlowInput(payload);
    const result = await PMTMailNotifyService.Run(flowInput);

    if (result?.success) {
      return { success: true };
    }

    return {
      success: false,
      error: result?.error?.message || 'Failed to send email notification',
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error sending email';
    console.error('Email notification error:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Generates a styled HTML email template for notifications.
 */
export function generateEmailTemplate(
  title: string,
  greeting: string,
  message: string,
  details: Array<{ label: string; value: string }>,
  actionText?: string,
  actionUrl?: string,
): string {
  const detailsHtml = details
    .map(
      (detail, idx) =>
        `<tr${idx % 2 === 0 ? ' style="background-color:#f4f5fa;"' : ''}>
          <td style="padding:12px 15px;font-weight:600;color:#23235F;text-align:left;width:40%;border:1px solid rgba(35,35,95,0.1);">${detail.label}</td>
          <td style="padding:12px 15px;color:#555;text-align:left;border:1px solid rgba(35,35,95,0.1);">${detail.value}</td>
        </tr>`,
    )
    .join('');

  const actionButtonHtml = actionText && actionUrl ? `
    <div style="margin-top:30px;text-align:center;">
      <a href="${actionUrl}" style="display:inline-block;padding:12px 30px;background-color:#23235F;color:white;text-decoration:none;border-radius:6px;font-weight:600;">
        ${actionText}
      </a>
    </div>
  ` : '';

  return `
<table cellpadding="0" cellspacing="0" style="background-color:#ffffff;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;padding:0;text-align:center;width:100%;">
  <tbody>
    <tr>
      <td>
        <!-- Header -->
        <div style="background-color: #23235F; padding: 20px 15px; border-radius: 12px 12px 0 0; text-align: center;">
          <div style="color: white; font-size: 26px; font-weight: 700; letter-spacing: 2px; padding-bottom: 10px;">
            Enjaz
          </div>
          <h1 style="color: white; font-size: 22px; font-weight: 600; margin: 0 0 8px 0; letter-spacing: 0.5px;">
            ${title}
          </h1>
          <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 0; font-weight: 400;">
            Project Management System
          </p>
        </div>

        <!-- Body -->
        <table cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:0px;box-shadow:0 0 10px rgba(0,0,0,0.1);border:1px solid rgba(35,35,95,0.26);width:100%;">
          <tbody>
            <tr>
              <td style="padding:30px 40px 10px;color:#444;font-size:15px;text-align:left;">
                <p>${greeting}</p>
                <p>${message}</p>

                <!-- Details Section -->
                <table cellpadding="0" cellspacing="0" style="width:100%;margin:20px 0;border-collapse:collapse;">
                  <tbody>
                    ${detailsHtml}
                  </tbody>
                </table>

                <p style="margin-top:20px;">
                  Please review the details and take necessary actions.
                </p>

                ${actionButtonHtml}
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background-color:#f4f5fa;color:#555;padding:20px;border-radius:0 0 12px 12px;font-size:13px;">
                <p style="margin:0;text-align:center;">
                  <b>Best regards,</b><br/>
                  Enjaz Project Management Team
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  </tbody>
</table>
  `;
}
