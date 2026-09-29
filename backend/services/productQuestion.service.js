import mongoose from "mongoose";
import Product from "../models/Product.js";
import ProductQuestion from "../models/ProductQuestion.js";
import { createNotificationForAdmins } from "./notification.service.js";

const isValidObjectId = (v) => mongoose.Types.ObjectId.isValid(v);

export const createQuestionService = async (userId, userName, questionData) => {
  const { productId, question } = questionData;

  if (!isValidObjectId(productId)) {
    throw Object.assign(new Error("productId không hợp lệ."), { statusCode: 400 });
  }

  const trimmed = String(question || "").trim();
  if (trimmed.length < 5) {
    throw Object.assign(new Error("Câu hỏi cần ít nhất 5 ký tự."), { statusCode: 400 });
  }
  if (trimmed.length > 500) {
    throw Object.assign(new Error("Câu hỏi không được vượt quá 500 ký tự."), { statusCode: 400 });
  }

  const product = await Product.findById(productId).select("_id name");
  if (!product) {
    throw Object.assign(new Error("Không tìm thấy sản phẩm."), { statusCode: 404 });
  }

  const newQuestion = await ProductQuestion.create({
    productId,
    userId,
    question: trimmed,
  });

  const populated = await ProductQuestion.findById(newQuestion._id)
    .populate("userId", "username fullname avatar")
    .populate("productId", "name");

  await createNotificationForAdmins("question", {
    questionId: newQuestion._id,
    productId: product._id,
    productName: product.name,
    userName: userName || "Người dùng",
  });

  return populated;
};

export const listQuestionsByProductService = async (queryParams) => {
  const { productId, page = 1, limit = 10 } = queryParams;

  if (!isValidObjectId(productId)) {
    throw Object.assign(new Error("productId không hợp lệ."), { statusCode: 400 });
  }

  const parsedPage = Math.max(Number(page), 1);
  const parsedLimit = Math.min(Math.max(Number(limit), 1), 10000);

  const filter = { productId, isHidden: false };

  const [items, total] = await Promise.all([
    ProductQuestion.find(filter)
      .sort({ createdAt: -1 })
      .skip((parsedPage - 1) * parsedLimit)
      .limit(parsedLimit)
      .populate("userId", "username fullname avatar")
      .lean(),
    ProductQuestion.countDocuments(filter),
  ]);

  return {
    data: items,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit),
    },
  };
};

export const adminListQuestionsService = async (queryParams) => {
  const { page = 1, limit = 20, isAnswered, productId, search } = queryParams;

  const parsedPage = Math.max(Number(page), 1);
  const parsedLimit = Math.min(Math.max(Number(limit), 1), 10000);

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

  return {
    data: items,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit),
    },
  };
};

export const answerQuestionService = async (questionId, answerText) => {
  if (!isValidObjectId(questionId)) {
    throw Object.assign(new Error("ID không hợp lệ."), { statusCode: 400 });
  }

  const trimmed = String(answerText || "").trim();
  if (trimmed.length < 1) {
    throw Object.assign(new Error("Câu trả lời không được để trống."), { statusCode: 400 });
  }

  const q = await ProductQuestion.findById(questionId);
  if (!q) {
    throw Object.assign(new Error("Không tìm thấy câu hỏi."), { statusCode: 404 });
  }

  q.answer = trimmed;
  q.isAnswered = true;
  q.answeredAt = new Date();
  await q.save();

  const populated = await ProductQuestion.findById(questionId)
    .populate("userId", "username fullname avatar")
    .populate("productId", "name");

  return populated;
};

export const hideQuestionService = async (questionId) => {
  const q = await ProductQuestion.findByIdAndUpdate(
    questionId,
    { isHidden: true },
    { new: true }
  );
  if (!q) {
    throw Object.assign(new Error("Không tìm thấy câu hỏi."), { statusCode: 404 });
  }
  return q;
};

export const showQuestionService = async (questionId) => {
  const q = await ProductQuestion.findByIdAndUpdate(
    questionId,
    { isHidden: false },
    { new: true }
  );
  if (!q) {
    throw Object.assign(new Error("Không tìm thấy câu hỏi."), { statusCode: 404 });
  }
  return q;
};

export const deleteQuestionService = async (questionId) => {
  const q = await ProductQuestion.findByIdAndDelete(questionId);
  if (!q) {
    throw Object.assign(new Error("Không tìm thấy câu hỏi."), { statusCode: 404 });
  }
  return q;
};
