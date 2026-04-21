import express from "express";
import orderController from "../controllers/order.controller.js";
import { authorize, protect } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/admin/all", protect, authorize("admin"), orderController.getAdminOrderList);
router.get("/admin/:orderId", protect, authorize("admin"), orderController.getAdminOrderById);
router.patch(
  "/admin/:orderId/status",
  protect,
  authorize("admin"),
  orderController.updateAdminOrder
);

router.get("/me", protect, orderController.getMyOrderList);
router.get("/me/:orderId", protect, orderController.getMyOrderById);
router.post("/checkout", protect, orderController.checkoutMyOrder);
router.patch("/me/:orderId/cancel", protect, orderController.cancelMyOrder);

export default router;
