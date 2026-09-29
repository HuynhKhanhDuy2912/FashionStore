import ContactRequest from "../models/ContactRequest.js";
import { sendContactReplyEmail } from "./contactMail.service.js";

const allowedTopics = new Set([
  "Tư vấn sản phẩm",
  "Tra cứu đơn hàng",
  "Đổi trả / hoàn tiền",
  "Giao hàng",
  "Khiếu nại dịch vụ",
]);

function buildTicketCode() {
  const date = new Date();
  const datePart = date.toISOString().slice(2, 10).replace(/-/g, "");
  const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();

  return `FS-${datePart}-${randomPart}`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function validateContactPayload(payload) {
  const errors = {};
  const fullName = String(payload.fullName || "").trim();
  const email = String(payload.email || "")
    .trim()
    .toLowerCase();
  const orderCode = String(payload.orderCode || "")
    .trim()
    .toUpperCase();
  const topic = String(payload.topic || "").trim();
  const message = String(payload.message || "").trim();

  if (fullName.length < 2) errors.fullName = "Vui lòng nhập họ tên đầy đủ.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.email = "Email chưa đúng định dạng.";
  if (orderCode && orderCode.length < 5)
    errors.orderCode = "Mã đơn hàng cần có ít nhất 5 ký tự.";
  if (!allowedTopics.has(topic))
    errors.topic = "Chủ đề cần hỗ trợ không hợp lệ.";
  if (message.length < 20) errors.message = "Nội dung cần ít nhất 20 ký tự.";

  return {
    errors,
    values: { fullName, email, orderCode, topic, message },
  };
}

async function sendContactWebhook(contactRequest) {
  if (!process.env.CONTACT_WEBHOOK_URL || typeof fetch !== "function") return;

  try {
    await fetch(process.env.CONTACT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "contact_request.created",
        ticketCode: contactRequest.ticketCode,
        fullName: contactRequest.fullName,
        email: contactRequest.email,
        orderCode: contactRequest.orderCode,
        topic: contactRequest.topic,
        message: contactRequest.message,
        createdAt: contactRequest.createdAt,
      }),
    });
  } catch (error) {
    console.error("Contact webhook failed:", error.message);
  }
}

export const createContactRequestService = async (payload) => {
  const { errors, values } = validateContactPayload(payload);

  if (Object.keys(errors).length > 0) {
    const err = new Error("Dữ liệu liên hệ chưa hợp lệ.");
    err.statusCode = 400;
    err.errors = errors;
    throw err;
  }

  const contactRequest = await ContactRequest.create({
    ...values,
    ticketCode: buildTicketCode(),
  });

  await sendContactWebhook(contactRequest);

  return {
    ticketCode: contactRequest.ticketCode,
    status: contactRequest.status,
  };
};

export const getContactRequestsService = async (queryParams) => {
  const { status, search, limit = 50 } = queryParams;
  const query = {};

  if (status && status !== "all") query.status = status;

  if (search) {
    const searchRegex = new RegExp(escapeRegExp(String(search).trim()), "i");
    query.$or = [
      { ticketCode: searchRegex },
      { fullName: searchRegex },
      { email: searchRegex },
      { orderCode: searchRegex },
      { topic: searchRegex },
    ];
  }

  const requests = await ContactRequest.find(query)
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 50, 10000))
    .lean();

  return requests;
};

export const getUnreadContactCountService = async () => {
  const unreadCount = await ContactRequest.countDocuments({ isRead: false });
  return { unreadCount };
};

export const getContactRequestByIdService = async (id) => {
  const contactRequest = await ContactRequest.findById(id).lean();

  if (!contactRequest) {
    throw Object.assign(new Error("Không tìm thấy tin nhắn liên hệ."), {
      statusCode: 404,
    });
  }

  return contactRequest;
};

export const markContactRequestAsReadService = async (id) => {
  const contactRequest = await ContactRequest.findByIdAndUpdate(
    id,
    { isRead: true, readAt: new Date() },
    { new: true },
  );

  if (!contactRequest) {
    throw Object.assign(new Error("Không tìm thấy tin nhắn liên hệ."), {
      statusCode: 404,
    });
  }

  return contactRequest;
};

export const replyContactRequestService = async (id, replyData, user) => {
  const subject = String(replyData.subject || "").trim();
  const message = String(replyData.message || "").trim();

  if (subject.length < 5 || subject.length > 200) {
    throw Object.assign(
      new Error("Tiêu đề email cần từ 5 đến 200 ký tự."),
      { statusCode: 400 },
    );
  }

  if (message.length < 10) {
    throw Object.assign(
      new Error("Nội dung phản hồi cần ít nhất 10 ký tự."),
      { statusCode: 400 },
    );
  }

  const contactRequest = await ContactRequest.findById(id);

  if (!contactRequest) {
    throw Object.assign(new Error("Không tìm thấy tin nhắn liên hệ."), {
      statusCode: 404,
    });
  }

  const emailResult = await sendContactReplyEmail(
    contactRequest,
    subject,
    message,
  );

  if (!emailResult.sent) {
    throw Object.assign(
      new Error("Không thể gửi email lúc này. Vui lòng thử lại sau."),
      { statusCode: 500, emailError: emailResult.error },
    );
  }

  contactRequest.replies.push({
    subject,
    message,
    repliedBy: user?._id,
    repliedByName: user?.fullname || user?.username || "Admin",
    emailSent: true,
    emailError: "",
  });
  contactRequest.status = "resolved";
  contactRequest.isRead = true;
  contactRequest.readAt = contactRequest.readAt || new Date();
  await contactRequest.save();

  return {
    contactRequest,
    emailSent: true,
    emailError: "",
  };
};

export const deleteContactRequestService = async (id) => {
  const contactRequest = await ContactRequest.findByIdAndDelete(id);

  if (!contactRequest) {
    throw Object.assign(new Error("Không tìm thấy tin nhắn liên hệ."), {
      statusCode: 404,
    });
  }

  return contactRequest;
};
