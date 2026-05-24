import express from "express";
import { protect, authorize } from "../middlewares/auth.middleware.js";
import * as controller from "../controllers/inventory.controller.js";

const router = express.Router();

router.use(protect, authorize("admin"));

router.get("/", controller.getInventoryList);
router.get("/low-stock", controller.getLowStockVariants);
router.get("/stats", controller.getInventoryStats);
router.get("/transactions", controller.getTransactionHistory);
router.get("/transactions/export", controller.exportTransactionHistory);
router.get("/:variantId", controller.getVariantInventory);
router.post("/import", controller.importStock);
router.post("/adjust", controller.adjustStock);

export default router;
