import express from "express";
import { protect, authorize } from "../middlewares/auth.middleware.js";
import * as questionController from "../controllers/productQuestion.controller.js";

const router = express.Router();

// Public — lấy câu hỏi đã trả lời theo sản phẩm
router.get("/", questionController.listByProduct);

// Admin — xem tất cả câu hỏi
router.get("/admin", protect, authorize("admin"), questionController.adminList);

// User đăng nhập — đặt câu hỏi
router.post("/", protect, questionController.create);

// Admin — trả lời / ẩn / hiện câu hỏi
router.patch("/:id/answer", protect, authorize("admin"), questionController.answer);
router.patch("/:id/hide",   protect, authorize("admin"), questionController.hide);
router.patch("/:id/show",   protect, authorize("admin"), questionController.show);

export default router;
