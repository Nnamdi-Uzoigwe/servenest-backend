import nodemailer from "nodemailer";
import { env } from "@/config/env";

const transporter = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    })
  : null;

async function sendEmail(to: string, subject: string, text: string, html: string) {
  if (!transporter) {
    if (env.isProd) {
      console.warn(`SMTP not configured, email to ${to} was not sent`);
    } else {
      console.log(`\n[email:dev] to=${to}\nsubject: ${subject}\n${text}\n`);
    }
    return;
  }
  try {
    await transporter.sendMail({ from: env.EMAIL_FROM, to, subject, text, html });
  } catch (err) {
    // Never fail a request because of email delivery
    console.error("Email send failed:", err);
  }
}

function layout(name: string, intro: string, code: string) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#000">
      <p>Hi ${name},</p>
      <p>${intro}</p>
      <p style="font-size:32px;letter-spacing:8px;font-weight:bold;margin:24px 0">${code}</p>
      <p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>
      <p>The ServeNest Team</p>
    </div>`;
}

export function sendVerificationCode(to: string, name: string, code: string) {
  const intro = "Use this code to verify your email address:";
  return sendEmail(
    to,
    "Verify your ServeNest email",
    `Hi ${name}, your ServeNest verification code is ${code}. It expires in 10 minutes.`,
    layout(name, intro, code)
  );
}

export function sendPasswordResetCode(to: string, name: string, code: string) {
  const intro = "Use this code to reset your password:";
  return sendEmail(
    to,
    "Reset your ServeNest password",
    `Hi ${name}, your ServeNest password reset code is ${code}. It expires in 10 minutes.`,
    layout(name, intro, code)
  );
}