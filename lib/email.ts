import nodemailer from "nodemailer"

/**
 * Email client for Manage One AI.
 *
 * Configure via environment variables:
 *   SMTP_HOST     — SMTP server hostname (default: localhost)
 *   SMTP_PORT     — SMTP server port (default: 587)
 *   SMTP_USER     — SMTP username
 *   SMTP_PASS     — SMTP password
 *   SMTP_FROM     — Default "from" address (default: noreply@Manage One.ai)
 *   SMTP_SECURE   — Use TLS (default: false, set "true" for port 465)
 *
 * In development without SMTP configured, emails are logged to console
 * using Nodemailer's built-in Ethereal test accounts.
 */

let transporter: nodemailer.Transporter | null = null

async function getTransporter() {
  if (transporter) return transporter

  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (host && user && pass) {
    // Production: use configured SMTP
    transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user, pass },
    })
  } else {
    // Development: use Ethereal test account (emails viewable at ethereal.email)
    const testAccount = await nodemailer.createTestAccount()
    transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    })
    console.log("[Email] Using Ethereal test account:", testAccount.user)
  }

  return transporter
}

const DEFAULT_FROM = process.env.SMTP_FROM ?? "Manage One AI <noreply@Manage One.ai>"

interface SendEmailOptions {
  to: string
  subject: string
  text: string
  html: string
}

export async function sendEmail(options: SendEmailOptions) {
  const mailer = await getTransporter()

  const info = await mailer.sendMail({
    from: DEFAULT_FROM,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  })

  // In dev, log the Ethereal preview URL
  const previewUrl = nodemailer.getTestMessageUrl(info)
  if (previewUrl) {
    console.log("[Email] Preview URL:", previewUrl)
  }

  return { messageId: info.messageId, previewUrl: previewUrl || null }
}

// ─── Email Templates ─────────────────────────────────────────────────

const APP_NAME = "Manage One AI"
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

function wrapHtml(content: string) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f4f4f5; }
    .container { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 12px; border: 1px solid #e4e4e7; overflow: hidden; }
    .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 32px 40px; }
    .header h1 { color: #fff; margin: 0; font-size: 20px; font-weight: 700; }
    .body { padding: 32px 40px; color: #18181b; line-height: 1.6; }
    .body h2 { font-size: 18px; margin: 0 0 16px; }
    .body p { margin: 0 0 16px; color: #3f3f46; }
    .btn { display: inline-block; padding: 12px 28px; background: #6366f1; color: #fff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; }
    .footer { padding: 20px 40px; border-top: 1px solid #e4e4e7; color: #a1a1aa; font-size: 12px; text-align: center; }
    .code { font-family: monospace; font-size: 14px; background: #f4f4f5; padding: 12px 20px; border-radius: 8px; border: 1px solid #e4e4e7; display: inline-block; letter-spacing: 2px; font-weight: 700; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${APP_NAME}</h1>
    </div>
    <div class="body">
      ${content}
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
    </div>
  </div>
</body>
</html>`
}

export async function sendPasswordResetEmail(to: string, resetToken: string) {
  const resetUrl = `${APP_URL}/reset-password?token=${resetToken}`

  return sendEmail({
    to,
    subject: `${APP_NAME} — Reset Your Password`,
    text: `You requested a password reset for your ${APP_NAME} account.\n\nReset your password: ${resetUrl}\n\nThis link expires in 30 minutes. If you didn't request this, please ignore this email.`,
    html: wrapHtml(`
      <h2>Reset Your Password</h2>
      <p>You requested a password reset for your ${APP_NAME} account.</p>
      <p>Click the button below to set a new password. This link expires in <strong>30 minutes</strong>.</p>
      <p style="text-align: center; margin: 28px 0;">
        <a href="${resetUrl}" class="btn">Reset Password</a>
      </p>
      <p style="font-size: 13px; color: #71717a;">If you didn't request this, you can safely ignore this email.</p>
      <p style="font-size: 12px; color: #a1a1aa; word-break: break-all;">Direct link: ${resetUrl}</p>
    `),
  })
}

export async function sendTeamInvitationEmail(to: string, inviterName: string, workspaceName: string, inviteToken: string) {
  const acceptUrl = `${APP_URL}/invite?token=${inviteToken}`

  return sendEmail({
    to,
    subject: `${inviterName} invited you to "${workspaceName}" on ${APP_NAME}`,
    text: `${inviterName} has invited you to join the "${workspaceName}" workspace on ${APP_NAME}.\n\nAccept the invitation: ${acceptUrl}\n\nThis invitation expires in 7 days.`,
    html: wrapHtml(`
      <h2>You're Invited!</h2>
      <p><strong>${inviterName}</strong> has invited you to join the <strong>"${workspaceName}"</strong> workspace on ${APP_NAME}.</p>
      <p>Join the team to collaborate on tasks, share notes, and stay in sync.</p>
      <p style="text-align: center; margin: 28px 0;">
        <a href="${acceptUrl}" class="btn">Accept Invitation</a>
      </p>
      <p style="font-size: 13px; color: #71717a;">This invitation expires in 7 days.</p>
    `),
  })
}

export async function sendNotificationDigestEmail(
  to: string,
  userName: string,
  notifications: Array<{ title: string; body: string | null; type: string }>
) {
  const notifListHtml = notifications
    .map(
      (n) =>
        `<tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #f4f4f5;">
            <div style="font-weight: 600; font-size: 14px; color: #18181b;">${n.title}</div>
            ${n.body ? `<div style="font-size: 13px; color: #71717a; margin-top: 4px;">${n.body}</div>` : ""}
            <div style="font-size: 11px; color: #a1a1aa; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px;">${n.type}</div>
          </td>
        </tr>`
    )
    .join("")

  return sendEmail({
    to,
    subject: `${APP_NAME} — Your Weekly Digest (${notifications.length} updates)`,
    text: `Hi ${userName},\n\nHere's your weekly digest from ${APP_NAME}:\n\n${notifications.map((n) => `• ${n.title}${n.body ? ` — ${n.body}` : ""}`).join("\n")}\n\nView your dashboard: ${APP_URL}/dashboard`,
    html: wrapHtml(`
      <h2>Your Weekly Digest</h2>
      <p>Hi <strong>${userName}</strong>, here are your latest updates from ${APP_NAME}:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        ${notifListHtml}
      </table>
      <p style="text-align: center; margin: 28px 0;">
        <a href="${APP_URL}/dashboard" class="btn">Open Dashboard</a>
      </p>
    `),
  })
}

