import {
  createQuestionService,
  listQuestionsByProductService,
  adminListQuestionsService,
  answerQuestionService,
  hideQuestionService,
  showQuestionService,
  deleteQuestionService,
} from "../services/productQuestion.service.js";

// POST /product-questions — người dùng đặt câu hỏi (requires auth)
export const create = async (req, res) => {
  try {
    const userName = req.user.fullname || req.user.username || "Người dùng";
    const question = await createQuestionService(req.user._id, userName, req.body);

    return res.status(201).json({
      success: true,
      message: "Câu hỏi của bạn đã được gửi. Chúng tôi sẽ phản hồi sớm nhất có thể.",
      data: question,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

// GET /product-questions?productId=xxx — public, chỉ trả về câu hỏi đã trả lời và không ẩn
export const listByProduct = async (req, res) => {
  try {
    const result = await listQuestionsByProductService(req.query);

    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

// GET /product-questions/admin — admin xem tất cả câu hỏi
export const adminList = async (req, res) => {
  try {
    const result = await adminListQuestionsService(req.query);

    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// PATCH /product-questions/:id/answer — admin trả lời câu hỏi
export const answer = async (req, res) => {
  try {
    const question = await answerQuestionService(req.params.id, req.body.answer);

    return res.status(200).json({
      success: true,
      message: "Đã trả lời câu hỏi.",
      data: question,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

// PATCH /product-questions/:id/hide
export const hide = async (req, res) => {
  try {
    const question = await hideQuestionService(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Đã ẩn câu hỏi.",
      data: question,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

// PATCH /product-questions/:id/show
export const show = async (req, res) => {
  try {
    const question = await showQuestionService(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Đã hiển thị câu hỏi.",
      data: question,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

// DELETE /product-questions/:id
export const deleteQuestion = async (req, res) => {
  try {
    await deleteQuestionService(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Đã xóa câu hỏi.",
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};
