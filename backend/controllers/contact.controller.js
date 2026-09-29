import {
  createContactRequestService,
  getContactRequestsService,
  getUnreadContactCountService,
  getContactRequestByIdService,
  markContactRequestAsReadService,
  replyContactRequestService,
  deleteContactRequestService,
} from "../services/contact.service.js";

export const createContactRequest = async (req, res) => {
  try {
    const result = await createContactRequestService(req.body);

    return res.status(201).json({
      success: true,
      message: "Yêu cầu liên hệ đã được ghi nhận.",
      data: result,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
      errors: error.errors,
    });
  }
};

export const getContactRequests = async (req, res) => {
  try {
    const requests = await getContactRequestsService(req.query);

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
    const result = await getUnreadContactCountService();

    return res.status(200).json({
      success: true,
      message: "Unread contact count fetched successfully",
      data: result,
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
    const contactRequest = await getContactRequestByIdService(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Contact request fetched successfully",
      data: contactRequest,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

export const markContactRequestAsRead = async (req, res) => {
  try {
    const contactRequest = await markContactRequestAsReadService(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Đã đánh dấu tin nhắn là đã đọc.",
      data: contactRequest,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

export const replyContactRequest = async (req, res) => {
  try {
    const result = await replyContactRequestService(
      req.params.id,
      req.body,
      req.user,
    );

    return res.status(200).json({
      success: true,
      message: "Đã gửi phản hồi đến email khách hàng.",
      data: result,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
      error: error.emailError,
    });
  }
};

export const deleteContactRequest = async (req, res) => {
  try {
    await deleteContactRequestService(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Đã xóa tin nhắn liên hệ.",
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
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
  deleteContactRequest,
};
