import { sendEmail, hasEmailConfig } from "./emailTransport.js";

// ─── Design Tokens (Dựa trên hình ảnh tham khảo) ─────────────────────────────
const BRAND = {
  bg: "#ffffff",
  headerBg: "#F6F2EC",
  text: "#111111",
  muted: "#666666",
  line: "#e5e5e5",
  accent: "#000000",
  accentBorder: "#000000",
  font: "'Inter', 'Roboto', 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif",
};

const CLIENT_URL = () => process.env.CLIENT_URL || "http://localhost:3000";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatVND(amount) {
  return Number(amount || 0).toLocaleString("vi-VN") + "₫";
}

function orderCode(order) {
  const id = order._id?.toString?.() || String(order._id || "");
  return id.slice(-8).toUpperCase();
}

function getItemImage(item) {
  return item.variantSnapshot?.image || item.productSnapshot?.image || "";
}

function getItemName(item) {
  return escapeHtml(item.productSnapshot?.name || "Sản phẩm");
}

function getItemVariant(item) {
  const parts = [];
  if (item.variantSnapshot?.color) parts.push(item.variantSnapshot.color);
  if (item.variantSnapshot?.size) parts.push(item.variantSnapshot.size);
  return escapeHtml(parts.join(" / ") || "—");
}

// ─── Layout Components ───────────────────────────────────────────────────────

function emailWrapper(content) {
  return `<!doctype html>
<html lang="vi" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>FashionStore</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:${BRAND.font};color:${BRAND.text};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND.bg};">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:${BRAND.bg};margin: 0 auto;">
          ${content}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function productCardRow(item) {
  const img = getItemImage(item);
  const imgHtml = img
    ? `<img src="${escapeHtml(img)}" alt="${getItemName(item)}" style="width:120px;height:120px;object-fit:cover;border-radius:8px;display:block;" />`
    : `<div style="width:120px;height:120px;border-radius:8px;background:${BRAND.line};"></div>`;

  // Base price (giá gốc trước khi giảm, có thể cộng thêm tuỳ chọn variant nếu có)
  const basePrice = item.productSnapshot?.price || item.price;
  const finalPrice = item.price;
  const discount = Math.max(0, basePrice - finalPrice);

  return `<tr>
  <td style="padding-bottom:20px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td width="136" valign="top">
          ${imgHtml}
        </td>
        <td valign="top">
          <!-- Hộp thông tin chi tiết với viền màu xanh nhạt -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid ${BRAND.accentBorder};border-radius:8px;padding:12px;font-size:13px;background:#ffffff;">
            <tr>
              <td style="font-weight:700;padding-bottom:4px;color:${BRAND.text};">${getItemName(item)}</td>
              <td align="right" style="padding-bottom:4px;color:${BRAND.text};">${formatVND(basePrice)}</td>
            </tr>
            <tr>
              <td style="color:${BRAND.muted};padding-bottom:4px;">Giảm giá</td>
              <td align="right" style="color:${BRAND.muted};padding-bottom:4px;">-${formatVND(discount)}</td>
            </tr>
            <tr>
              <td style="padding-bottom:12px;">Giá sau giảm</td>
              <td align="right" style="padding-bottom:12px;"><strong style="color:${BRAND.accent};">${formatVND(finalPrice)}</strong></td>
            </tr>
            <tr>
              <td colspan="2" style="padding-bottom:12px;"><div style="border-top:1px solid ${BRAND.line};"></div></td>
            </tr>
            <tr>
              <td style="color:${BRAND.muted};padding-bottom:4px;">Phân loại</td>
              <td align="right" style="padding-bottom:4px;">${getItemVariant(item)}</td>
            </tr>
            <tr>
              <td style="color:${BRAND.muted};">Số lượng</td>
              <td align="right">${item.quantity}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </td>
</tr>`;
}

function buildBaseHtml(order, items, user, title, greeting, message) {
  const customerName = escapeHtml(
    user?.fullname || user?.username || order?.receiverName || "Bạn",
  );
  const detailUrl = `${CLIENT_URL()}/profile?tab=orders`;

  const formattedDate = order.createdAt
    ? new Date(order.createdAt).toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "";

  const paymentMethodMap = {
    cod: "Thanh toán khi nhận hàng (COD)",
    vnpay: "VNPay",
    paypal: "PayPal",
  };
  const paymentMethodStr =
    paymentMethodMap[order.paymentMethod] || order.paymentMethod;

  const productRows = items.map((item) => productCardRow(item)).join("\n");

  const content = `
  <!-- Phần Header (Nền màu be nhạt) -->
  <tr>
    <td style="background:${BRAND.headerBg};padding:40px 20px;text-align:center;">
      <div style="font-size:32px;font-weight:900;color:#000000;margin-bottom:20px;letter-spacing:1.5px;font-family:${BRAND.font};">FS</div>
      <h1 style="margin:0 0 16px;font-size:20px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:${BRAND.text};">${title}</h1>
      <p style="margin:0 0 12px;font-size:15px;color:${BRAND.text};">${customerName}, ${greeting}</p>
      <p style="margin:0 auto;font-size:13px;color:${BRAND.muted};line-height:1.6;max-width:450px;">
        ${message}
      </p>
    </td>
  </tr>

  <!-- Phần Nội Dung Chính -->
  <tr>
    <td style="padding:0 30px 40px;">
      
      <!-- Tiêu đề phần tổng quan -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:30px 0 20px;">
        <tr>
          <td style="font-size:16px;font-weight:700;color:${BRAND.text};">Tổng quan đơn hàng</td>
          <td align="right" style="font-size:13px;color:${BRAND.muted};">${formattedDate}</td>
        </tr>
      </table>

      <!-- Danh sách sản phẩm -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        ${productRows}
      </table>

      <!-- Tổng tiền đơn hàng -->
      <div style="font-size:16px;font-weight:700;text-align:center;margin:10px 0 20px;color:${BRAND.text};">
        Tổng thanh toán
      </div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px;color:${BRAND.text};margin-bottom:40px;">
        <tr>
          <td style="padding-bottom:8px;">Tạm tính</td>
          <td align="right" style="padding-bottom:8px;">${formatVND(order.subTotal)}</td>
        </tr>
        <tr>
          <td style="padding-bottom:8px;">Giảm giá</td>
          <td align="right" style="padding-bottom:8px;">-${formatVND(order.discount)}</td>
        </tr>
        <tr>
          <td style="padding-bottom:12px;">Phí vận chuyển</td>
          <td align="right" style="padding-bottom:12px;">${order.shippingFee > 0 ? formatVND(order.shippingFee) : "Miễn phí"}</td>
        </tr>
        <tr>
          <td colspan="2" style="padding-bottom:12px;"><div style="border-top:1px solid ${BRAND.text};"></div></td>
        </tr>
        <tr>
          <td style="font-weight:700;color:${BRAND.accent};font-size:15px;">Tổng cộng:</td>
          <td align="right" style="font-weight:700;color:${BRAND.accent};font-size:16px;">${formatVND(order.totalPrice)}</td>
        </tr>
      </table>

      <!-- Thông tin thanh toán và giao hàng -->
      <div style="font-size:16px;font-weight:700;text-align:center;margin:0 0 20px;color:${BRAND.text};">
        Thông tin giao hàng
      </div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:13px;line-height:1.6;color:${BRAND.text};margin-bottom:30px;">
        <tr>
          <td width="50%" valign="top" style="padding-right:10px;">
            <strong style="display:block;margin-bottom:4px;">Giao hàng đến</strong>
            ${escapeHtml(order.receiverName)}<br/>
            ${escapeHtml(order.receiverPhone)}<br/>
            ${escapeHtml(order.shippingAddress)}
          </td>
          <td width="50%" valign="top" style="padding-left:10px;">
            <strong style="display:block;margin-bottom:4px;">Phương thức thanh toán</strong>
            ${paymentMethodStr}<br/><br/>
            <strong style="display:block;margin-bottom:4px;">Phương thức vận chuyển</strong>
            Giao hàng tiêu chuẩn
          </td>
        </tr>
      </table>

      <!-- Nút xem đơn hàng (CTA) -->
      <div style="text-align:center;">
        <a href="${escapeHtml(detailUrl)}" target="_blank" style="display:inline-block;padding:12px 32px;background:${BRAND.accent};color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:6px;letter-spacing:0.5px;">
          Xem đơn hàng
        </a>
      </div>

    </td>
  </tr>
  
  <!-- Footer -->
  <tr>
    <td style="padding:20px 30px 40px;text-align:center;border-top:1px solid ${BRAND.line};">
      <p style="margin:0 0 8px;font-size:12px;color:${BRAND.muted};">
        Email này được gửi tự động, vui lòng không trả lời.<br/>
        Nếu bạn có câu hỏi, vui lòng liên hệ bộ phận chăm sóc khách hàng.
      </p>
      <p style="margin:0;font-size:12px;color:#999999;">
        &copy; ${new Date().getFullYear()} FashionStore. All rights reserved.
      </p>
    </td>
  </tr>
  `;

  return emailWrapper(content);
}

// ─── Exported Send Functions ─────────────────────────────────────────────────

export async function sendOrderConfirmationEmail(order, items, user) {
  const email = user?.email;
  if (!email || !hasEmailConfig()) {
    console.warn("[OrderEmail] Skipped confirmation: missing email or transport config");
    return { sent: false };
  }

  try {
    const code = orderCode(order);

    const title = "XÁC NHẬN ĐƠN HÀNG";
    const greeting = "cảm ơn bạn đã đặt hàng!";
    const message =
      "Chúng tôi đã nhận được đơn hàng của bạn và sẽ liên hệ với bạn ngay khi gói hàng được gửi đi. Bạn có thể xem thông tin mua hàng bên dưới.";

    await sendEmail({
      to: email,
      subject: `Đơn hàng #${code} đã được xác nhận - FashionStore`,
      html: buildBaseHtml(order, items, user, title, greeting, message),
      replyTo: "no-reply@fashionstore.vn",
    });

    console.log(
      `[OrderEmail] Confirmation email sent to ${email} for order #${code}`,
    );
    return { sent: true, error: "" };
  } catch (error) {
    console.error(
      "[OrderEmail] Failed to send confirmation email:",
      error.message,
    );
    return { sent: false, error: error.message };
  }
}

export async function sendOrderCompletedEmail(order, items, user) {
  const email = user?.email;
  if (!email || !hasEmailConfig()) {
    console.warn("[OrderEmail] Skipped completed: missing email or transport config");
    return { sent: false };
  }

  try {
    const code = orderCode(order);

    const title = "GIAO HÀNG THÀNH CÔNG";
    const greeting = "đơn hàng của bạn đã được giao!";
    const message =
      "Kiện hàng của bạn đã được giao thành công. Mong rằng bạn hài lòng với các sản phẩm. Bạn có thể xem lại thông tin đơn hàng bên dưới.";

    await sendEmail({
      to: email,
      subject: `Đơn hàng #${code} đã giao thành công - FashionStore`,
      html: buildBaseHtml(order, items, user, title, greeting, message),
      replyTo: "no-reply@fashionstore.vn",
    });

    console.log(
      `[OrderEmail] Completed email sent to ${email} for order #${code}`,
    );
    return { sent: true, error: "" };
  } catch (error) {
    console.error(
      "[OrderEmail] Failed to send completed email:",
      error.message,
    );
    return { sent: false, error: error.message };
  }
}
