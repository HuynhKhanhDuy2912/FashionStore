import nodemailer from "nodemailer";

// ─── Config Helpers ──────────────────────────────────────────────────────────

function getMailFromAddress() {
  const fromName = process.env.MAIL_FROM_NAME || "FashionStore";
  const fromAddr = process.env.MAIL_FROM_ADDRESS || "no-reply@fashionstore.vn";
  return `${fromName} <${fromAddr}>`;
}

function hasSmtpConfig() {
  return Boolean(
    process.env.MAIL_HOST &&
      process.env.MAIL_USERNAME &&
      process.env.MAIL_PASSWORD,
  );
}

function hasBrevoConfig() {
  return Boolean(process.env.BREVO_API_KEY);
}

function getSmtpPassword() {
  return String(process.env.MAIL_PASSWORD || "").replace(/\s/g, "");
}

// ─── Brevo (HTTP API) ───────────────────────────────────────────────────────

async function sendViaBrevo({ to, subject, html, text, replyTo }) {
  console.log("[Email] Sending via Brevo API to:", to);

  const fromName = process.env.MAIL_FROM_NAME || "FashionStore";
  const fromEmail = process.env.MAIL_FROM_ADDRESS || "no-reply@fashionstore.vn";

  const toList = Array.isArray(to) ? to.map((e) => ({ email: e })) : [{ email: to }];

  const body = {
    sender: { name: fromName, email: fromEmail },
    to: toList,
    subject,
  };

  if (html) body.htmlContent = html;
  if (text) body.textContent = text;
  if (replyTo) body.replyTo = { email: replyTo };

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `Brevo API error: ${response.status}`);
  }

  console.log("[Email] Sent via Brevo successfully, messageId:", data.messageId);
  return data;
}

// ─── SMTP (nodemailer) ──────────────────────────────────────────────────────

async function sendViaSmtp({ to, subject, html, text, replyTo }) {
  console.log("[Email] Sending via SMTP to:", to);

  const port = Number(process.env.MAIL_PORT || 587);
  const encryption = String(process.env.MAIL_ENCRYPTION || "").toLowerCase();
  const secure = port === 465 || encryption === "ssl";

  const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST.trim(),
    port,
    secure,
    auth: {
      user: process.env.MAIL_USERNAME.trim(),
      pass: getSmtpPassword(),
    },
    requireTLS: encryption === "tls" || port === 587,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  const mailOptions = {
    from: getMailFromAddress(),
    to,
    subject,
  };
  if (html) mailOptions.html = html;
  if (text) mailOptions.text = text;
  if (replyTo) mailOptions.replyTo = replyTo;

  await transporter.sendMail(mailOptions);
  console.log("[Email] Sent via SMTP successfully to:", to);
}

// ─── Unified Send ────────────────────────────────────────────────────────────

/**
 * Gửi email qua transport tốt nhất có sẵn.
 * Ưu tiên: Brevo API > SMTP (hoạt động trên localhost)
 */
export async function sendEmail({ to, subject, html, text, replyTo }) {
  if (hasBrevoConfig()) {
    return sendViaBrevo({ to, subject, html, text, replyTo });
  }

  if (hasSmtpConfig()) {
    return sendViaSmtp({ to, subject, html, text, replyTo });
  }

  console.warn(
    "[Email] No email transport configured. Set BREVO_API_KEY (for production) or SMTP env vars (for local dev).",
  );
  return null;
}

/**
 * Kiểm tra xem có transport email nào được cấu hình không.
 */
export function hasEmailConfig() {
  return hasBrevoConfig() || hasSmtpConfig();
}

export { getMailFromAddress, hasSmtpConfig, hasBrevoConfig };
