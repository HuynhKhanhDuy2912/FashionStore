import express from "express";
import { createCrudRouter } from "./base.route.js";
import productController from "../controllers/product.controller.js";
import searchController from "../controllers/search.controller.js";
import { authorize, protect, optionalAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Search route MUST be before /:id to avoid Express matching "search" as an ID
router.get("/search", searchController.search);

// Existing CRUD routes
const crudRouter = createCrudRouter(productController, {
  listMiddlewares: [optionalAuth],
  getMiddlewares: [optionalAuth],
  createMiddlewares: [protect, authorize("admin")],
  updateMiddlewares: [protect, authorize("admin")],
  deleteMiddlewares: [protect, authorize("admin")]
});

router.use("/", crudRouter);

export default router;
