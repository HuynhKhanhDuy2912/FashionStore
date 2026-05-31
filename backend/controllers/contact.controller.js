import ContactRequest from "../models/ContactRequest.js";
import { sendContactReplyEmail } from "../services/contactMail.service.js";

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

export const createContactRequest = async (req, res) => {
  try {
    const { errors, values } = validateContactPayload(req.body);

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: "Dữ liệu liên hệ chưa hợp lệ.",
        errors,
      });
    }

    const contactRequest = await ContactRequest.create({
      ...values,
      ticketCode: buildTicketCode(),
    });

    await sendContactWebhook(contactRequest);

    return res.status(201).json({
      success: true,
      message: "Yêu cầu liên hệ đã được ghi nhận.",
      data: {
        ticketCode: contactRequest.ticketCode,
        status: contactRequest.status,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getContactRequests = async (req, res) => {
  try {
    const { status, search, limit = 50 } = req.query;
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
      .limit(Math.min(Number(limit) || 50, 100))
      .lean();

    return res.status(200).json({
      success: true,
      message: "Contact requests fetched successfully",
      data: requests,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getUnreadContactCount = async (_req, res) => {
  try {
    const unreadCount = await ContactRequest.countDocuments({ isRead: false });

    return res.status(200).json({
      success: true,
      message: "Unread contact count fetched successfully",
      data: { unreadCount },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getContactRequestById = async (req, res) => {
  try {
    const contactRequest = await ContactRequest.findById(req.params.id).lean();

    if (!contactRequest) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tin nhắn liên hệ.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Contact request fetched successfully",
      data: contactRequest,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const markContactRequestAsRead = async (req, res) => {
  try {
    const contactRequest = await ContactRequest.findByIdAndUpdate(
      req.params.id,
      { isRead: true, readAt: new Date() },
      { new: true },
    );

    if (!contactRequest) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tin nhắn liên hệ.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Đã đánh dấu tin nhắn là đã đọc.",
      data: contactRequest,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


export const replyContactRequest = async (req, res) => {
  try {
    const subject = String(req.body.subject || "").trim();
    const message = String(req.body.message || "").trim();

    if (subject.length < 5 || subject.length > 200) {
      return res.status(400).json({
        success: false,
        message: "Tiêu đề email cần từ 5 đến 200 ký tự.",
      });
    }

    if (message.length < 10) {
      return res.status(400).json({
        success: false,
        message: "Nội dung phản hồi cần ít nhất 10 ký tự.",
      });
    }

    const contactRequest = await ContactRequest.findById(req.params.id);

    if (!contactRequest) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tin nhắn liên hệ.",
      });
    }

    const emailResult = await sendContactReplyEmail(
      contactRequest,
      subject,
      message,
    );

    if (!emailResult.sent) {
      return res.status(500).json({
        success: false,
        message: "Không thể gửi email lúc này. Vui lòng thử lại sau.",
        error: emailResult.error,
      });
    }

    contactRequest.replies.push({
      subject,
      message,
      repliedBy: req.user?._id,
      repliedByName: req.user?.fullname || req.user?.username || "Admin",
      emailSent: true,
      emailError: "",
    });
    contactRequest.status = "resolved";
    contactRequest.isRead = true;
    contactRequest.readAt = contactRequest.readAt || new Date();
    await contactRequest.save();

    return res.status(200).json({
      success: true,
      message: "Đã gửi phản hồi đến email khách hàng.",
      data: {
        contactRequest,
        emailSent: true,
        emailError: "",
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export default {
  createContactRequest,
  getContactRequests,
  getUnreadContactCount,
  getContactRequestById,
  markContactRequestAsRead,
  replyContactRequest,
};
