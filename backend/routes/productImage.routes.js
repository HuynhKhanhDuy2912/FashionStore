import express from "express";
import { createCrudRouter } from "./base.route.js";
import productImageController from "../controllers/productImage.controller.js";
import { authorize, protect } from "../middlewares/auth.middleware.js";

const router = createCrudRouter(productImageController, {
  createMiddlewares: [protect, authorize("admin")],
  updateMiddlewares: [protect, authorize("admin")],
  deleteMiddlewares: [protect, authorize("admin")]
});

// Endpoint đặc biệt: xóa DB record mà KHÔNG xóa Cloudinary
// Dùng cho dedup gallery khi URL vẫn còn được tham chiếu bởi bản ghi khác
router.delete("/:id/db-only", protect, authorize("admin"), productImageController.removeDbOnly);

export default router;
