import nodemailer from "nodemailer";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildOtpEmailHtml(otp, purpose, name = "Bạn") {
  const year = new Date().getFullYear();
  let title = "Mã xác thực FashionStore";
  let description = "Dưới đây là mã xác thực của bạn.";

  if (purpose === "register") {
    title = "Xác nhận đăng ký tài khoản";
    description =
      "Cảm ơn bạn đã đăng ký tài khoản tại FashionStore. Vui lòng sử dụng mã xác thực dưới đây để hoàn tất đăng ký.";
  } else if (purpose === "reset_password") {
    title = "Đặt lại mật khẩu";
    description =
      "Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Vui lòng sử dụng mã xác thực dưới đây để tiến hành đặt lại mật khẩu.";
  }

  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f7f4ef;font-family:Arial,Helvetica,sans-serif;color:#171717;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f4ef;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e4ded6;">
          <!-- Header -->
          <tr>
            <td style="background:#171717;padding:28px 30px;color:#ffffff;">
              <div style="font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#d9b98c;font-weight:700;">FashionStore</div>
              <h1 style="margin:12px 0 0;font-size:24px;line-height:1.25;font-weight:700;">${title}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:30px;">
              <p style="margin:0 0 18px;font-size:15px;line-height:1.7;">
                Xin chào <strong>${escapeHtml(name)}</strong>,<br />
                ${description}
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;border-collapse:collapse;">
                <tr>
                  <td align="center" style="padding:24px;background:#faf8f5;border:2px dashed #d9b98c;border-radius:8px;">
                    <div style="font-size:14px;text-transform:uppercase;color:#6b625a;font-weight:700;margin-bottom:12px;">Mã xác thực (OTP)</div>
                    <div style="font-size:36px;letter-spacing:8px;font-weight:bold;color:#171717;">${otp}</div>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#6b625a;">
                Mã xác thực này có hiệu lực trong vòng <strong>10 phút</strong>. Vì lý do bảo mật, vui lòng không chia sẻ mã này cho bất kỳ ai.
              </p>
              <!-- No-reply notice -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="background:#faf8f5;border:1px solid #e4ded6;border-left:3px solid #d9b98c;padding:12px 16px;">
                    <p style="margin:0;font-size:13px;line-height:1.6;color:#6b625a;">
                      <strong style="color:#171717;">Email này được gửi tự động, vui lòng không trả lời.</strong><br />
                      Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:22px 30px;background:#faf8f5;border-top:1px solid #e4ded6;">
              <p style="margin:0;font-size:13px;color:#a09890;">&copy; ${year} FashionStore. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

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

function getSmtpPassword() {
  return String(process.env.MAIL_PASSWORD || "").replace(/\s/g, "");
}

export async function sendOTPEmail(email, otp, purpose) {
  if (!hasSmtpConfig()) {
    console.warn("SMTP is not configured. OTP:", otp);
    return { sent: true, error: "" }; // Allow development without SMTP if not configured, or return false to strict check
  }

  try {
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
    });

    let subject = "Mã xác thực FashionStore";
    if (purpose === "register") {
      subject = "Xác nhận đăng ký tài khoản - FashionStore";
    } else if (purpose === "reset_password") {
      subject = "Đặt lại mật khẩu - FashionStore";
    }

    await transporter.sendMail({
      from: getMailFromAddress(),
      replyTo: "no-reply@fashionstore.vn",
      to: email,
      subject: subject,
      html: buildOtpEmailHtml(otp, purpose),
    });

    return { sent: true, error: "" };
  } catch (error) {
    console.error("Lỗi gửi email OTP:", error);
    return { sent: false, error: error.message };
  }
}
