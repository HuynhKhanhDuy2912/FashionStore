import mongoose from "mongoose";
import Product from "../models/Product.js";
import ProductQuestion from "../models/ProductQuestion.js";
import { createNotificationForAdmins } from "../services/notification.service.js";

const isValidObjectId = (v) => mongoose.Types.ObjectId.isValid(v);

// POST /product-questions — người dùng đặt câu hỏi (requires auth)
export const create = async (req, res) => {
  try {
    const { productId, question } = req.body;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({ success: false, message: "productId không hợp lệ." });
    }

    const trimmed = String(question || "").trim();
    if (trimmed.length < 5) {
      return res.status(400).json({ success: false, message: "Câu hỏi cần ít nhất 5 ký tự." });
    }
    if (trimmed.length > 500) {
      return res.status(400).json({ success: false, message: "Câu hỏi không được vượt quá 500 ký tự." });
    }

    const product = await Product.findById(productId).select("_id name");
    if (!product) {
      return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm." });
    }

    const newQuestion = await ProductQuestion.create({
      productId,
      userId: req.user._id,
      question: trimmed,
    });

    const populated = await ProductQuestion.findById(newQuestion._id)
      .populate("userId", "username fullname avatar")
      .populate("productId", "name");

    await createNotificationForAdmins("question", {
      questionId: newQuestion._id,
      productId: product._id,
      productName: product.name,
      userName: req.user.fullname || req.user.username || "Người dùng",
    });

    return res.status(201).json({
      success: true,
      message: "Câu hỏi của bạn đã được gửi. Chúng tôi sẽ phản hồi sớm nhất có thể.",
      data: populated,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /product-questions?productId=xxx — public, chỉ trả về câu hỏi đã trả lời và không ẩn
export const listByProduct = async (req, res) => {
  try {
    const { productId, page = 1, limit = 10 } = req.query;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({ success: false, message: "productId không hợp lệ." });
    }

    const parsedPage = Math.max(Number(page), 1);
    const parsedLimit = Math.min(Math.max(Number(limit), 1), 50);

    const filter = { productId, isAnswered: true, isHidden: false };

    const [items, total] = await Promise.all([
      ProductQuestion.find(filter)
        .sort({ createdAt: -1 })
        .skip((parsedPage - 1) * parsedLimit)
        .limit(parsedLimit)
        .populate("userId", "username fullname avatar")
        .lean(),
      ProductQuestion.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: items,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /product-questions/admin — admin xem tất cả câu hỏi
export const adminList = async (req, res) => {
  try {
    const { page = 1, limit = 20, isAnswered, productId, search } = req.query;

    const parsedPage = Math.max(Number(page), 1);
    const parsedLimit = Math.min(Math.max(Number(limit), 1), 100);

    const filter = {};
    if (isAnswered !== undefined) filter.isAnswered = isAnswered === "true";
    if (isValidObjectId(productId)) filter.productId = productId;
    if (search) filter.question = { $regex: search, $options: "i" };

    const [items, total] = await Promise.all([
      ProductQuestion.find(filter)
        .sort({ createdAt: -1 })
        .skip((parsedPage - 1) * parsedLimit)
        .limit(parsedLimit)
        .populate("userId", "username fullname avatar")
        .populate("productId", "name images")
        .lean(),
      ProductQuestion.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: items,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /product-questions/:id/answer — admin trả lời câu hỏi
export const answer = async (req, res) => {
  try {
    const { id } = req.params;
    const { answer: answerText } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "ID không hợp lệ." });
    }

    const trimmed = String(answerText || "").trim();
    if (trimmed.length < 1) {
      return res.status(400).json({ success: false, message: "Câu trả lời không được để trống." });
    }

    const q = await ProductQuestion.findById(id);
    if (!q) {
      return res.status(404).json({ success: false, message: "Không tìm thấy câu hỏi." });
    }

    q.answer = trimmed;
    q.isAnswered = true;
    q.answeredAt = new Date();
    await q.save();

    const populated = await ProductQuestion.findById(id)
      .populate("userId", "username fullname avatar")
      .populate("productId", "name");

    return res.status(200).json({
      success: true,
      message: "Đã trả lời câu hỏi.",
      data: populated,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /product-questions/:id/hide
export const hide = async (req, res) => {
  try {
    const q = await ProductQuestion.findByIdAndUpdate(
      req.params.id,
      { isHidden: true },
      { new: true }
    );
    if (!q) return res.status(404).json({ success: false, message: "Không tìm thấy câu hỏi." });
    return res.status(200).json({ success: true, message: "Đã ẩn câu hỏi.", data: q });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /product-questions/:id/show
export const show = async (req, res) => {
  try {
    const q = await ProductQuestion.findByIdAndUpdate(
      req.params.id,
      { isHidden: false },
      { new: true }
    );
    if (!q) return res.status(404).json({ success: false, message: "Không tìm thấy câu hỏi." });
    return res.status(200).json({ success: true, message: "Đã hiển thị câu hỏi.", data: q });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
