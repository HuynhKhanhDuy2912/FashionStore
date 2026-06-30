import { sendEmail, hasEmailConfig } from "./emailTransport.js";

function buildReplyText(contactRequest, replyMessage) {
  const lines = [
    `Xin chào ${contactRequest.fullName},`,
    "",
    replyMessage,
    "",
    "---",
    "YÊU CẦU HỖ TRỢ GỐC CỦA BẠN",
    `Mã yêu cầu : ${contactRequest.ticketCode}`,
    `Chủ đề     : ${contactRequest.topic}`,
    `Nội dung   : ${contactRequest.message}`,
    "",
    "---",
    "Email này được gửi tự động. Vui lòng không trả lời email này.",
    "FashionStore cảm ơn bạn đã liên hệ.",
  ];

  if (contactRequest.orderCode) {
    lines.splice(8, 0, `Mã đơn hàng: ${contactRequest.orderCode}`);
  }

  return lines.join("\n");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function nl2br(value) {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

function buildReplyHtml(contactRequest, replyMessage) {
  const customerName = escapeHtml(contactRequest.fullName);
  const ticketCode = escapeHtml(contactRequest.ticketCode);
  const topic = escapeHtml(contactRequest.topic);
  const originalMsg = nl2br(contactRequest.message || "");
  const orderCode = contactRequest.orderCode
    ? escapeHtml(contactRequest.orderCode)
    : null;
  const year = new Date().getFullYear();

  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>FashionStore - Phản hồi hỗ trợ</title>
</head>
<body style="margin:0;padding:0;background:#f7f4ef;font-family:Arial,Helvetica,sans-serif;color:#171717;">

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f4ef;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e4ded6;">

          <!-- Header -->
          <tr>
            <td style="background:#171717;padding:28px 30px;color:#ffffff;">
              <div style="font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#d9b98c;font-weight:700;">FashionStore Concierge</div>
              <h1 style="margin:12px 0 0;font-size:28px;line-height:1.25;font-weight:700;">Phản hồi từ FashionStore</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:30px;">

              <p style="margin:0 0 18px;font-size:15px;line-height:1.7;">
                Xin chào <strong>${customerName}</strong>,<br />
                Đây là phản hồi của FashionStore cho yêu cầu hỗ trợ của bạn.
              </p>

              <!-- Staff reply box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;border-collapse:collapse;border-left:3px solid #d9b98c;">
                <tr>
                  <td style="padding:14px 18px;background:#faf8f5;">
                    <div style="font-size:13px;text-transform:uppercase;color:#6b625a;font-weight:700;margin-bottom:8px;">Nội dung phản hồi</div>
                    <div style="font-size:15px;line-height:1.8;color:#2b2b2b;">${nl2br(replyMessage)}</div>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">
                <tr><td style="border-top:1px solid #e4ded6;font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>

              <!-- Original request -->
              <div style="font-size:13px;text-transform:uppercase;color:#6b625a;font-weight:700;margin-bottom:14px;">Yêu cầu gốc của bạn</div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#faf8f5;border:1px solid #e4ded6;margin-bottom:24px;">
                <tr>
                  <td style="padding:12px 16px;border-bottom:1px solid #e4ded6;font-size:12px;text-transform:uppercase;color:#6b625a;font-weight:700;width:110px;">Mã yêu cầu</td>
                  <td style="padding:12px 16px;border-bottom:1px solid #e4ded6;font-size:14px;font-weight:700;">${ticketCode}</td>
                </tr>
                <tr>
                  <td style="padding:12px 16px;border-bottom:1px solid #e4ded6;font-size:12px;text-transform:uppercase;color:#6b625a;font-weight:700;">Chủ đề</td>
                  <td style="padding:12px 16px;border-bottom:1px solid #e4ded6;font-size:14px;">${topic}</td>
                </tr>
                ${
                  orderCode
                    ? `<tr>
                  <td style="padding:12px 16px;border-bottom:1px solid #e4ded6;font-size:12px;text-transform:uppercase;color:#6b625a;font-weight:700;">Mã đơn hàng</td>
                  <td style="padding:12px 16px;border-bottom:1px solid #e4ded6;font-size:14px;">${orderCode}</td>
                </tr>`
                    : ""
                }
                <tr>
                  <td colspan="2" style="padding:14px 16px;background:#ffffff;">
                    <div style="font-size:13px;text-transform:uppercase;color:#6b625a;font-weight:700;margin-bottom:8px;">Nội dung bạn đã gửi</div>
                    <div style="font-size:14px;line-height:1.7;color:#2b2b2b;">${originalMsg}</div>
                  </td>
                </tr>
              </table>

              <!-- No-reply notice -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="background:#faf8f5;border:1px solid #e4ded6;border-left:3px solid #d9b98c;padding:12px 16px;">
                    <p style="margin:0;font-size:13px;line-height:1.6;color:#6b625a;">
                      <strong style="color:#171717;">Email này được gửi tự động, vui lòng không trả lời.</strong>
                      Nếu bạn cần hỗ trợ thêm, vui lòng tạo yêu cầu mới tại trang liên hệ của FashionStore hoặc liên hệ trực tiếp với fanpage.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:22px 30px;background:#faf8f5;border-top:1px solid #e4ded6;">
              <p style="margin:0 0 4px;font-size:12px;line-height:1.7;color:#6b625a;">FashionStore cảm ơn bạn đã liên hệ. Chúng tôi luôn mong mỗi trải nghiệm mua sắm của bạn được chỉn chu và dễ chịu.</p>
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

export async function sendContactReplyEmail(
  contactRequest,
  replySubject,
  replyMessage,
) {
  if (!hasEmailConfig()) {
    return { sent: false, error: "No email transport configured" };
  }

  try {
    await sendEmail({
      to: contactRequest.email,
      subject: replySubject,
      text: buildReplyText(contactRequest, replyMessage),
      html: buildReplyHtml(contactRequest, replyMessage),
      replyTo: "no-reply@fashionstore.vn", // Ngăn khách reply lại
    });

    return { sent: true, error: "" };
  } catch (error) {
    return { sent: false, error: error.message };
  }
}
