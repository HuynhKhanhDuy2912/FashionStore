import express from "express";
import multer from "multer";
import virtualTryOnController from "../controllers/virtualTryOn.controller.js";
import { optionalAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.VIRTUAL_TRY_ON_MAX_UPLOAD_MB || 10) * 1024 * 1024,
  },
});

router.post(
  "/",
  optionalAuth,
  upload.fields([
    { name: "personImage", maxCount: 1 },
    { name: "garmentImage", maxCount: 1 },
  ]),
  virtualTryOnController.generateVirtualTryOn,
);

export default router;