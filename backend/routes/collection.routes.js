import { createCrudRouter } from "./base.route.js";
import collectionController from "../controllers/collection.controller.js";
import { authorize, protect } from "../middlewares/auth.middleware.js";
import express from "express";

const router = createCrudRouter(collectionController, {
  createMiddlewares: [protect, authorize("admin")],
  updateMiddlewares: [protect, authorize("admin")],
  deleteMiddlewares: [protect, authorize("admin")]
});

// Public: get by slug
router.get("/slug/:slug", collectionController.getBySlug);

export default router;
