import { createCrudRouter } from "./base.route.js";
import productController from "../controllers/product.controller.js";
import { authorize, protect, optionalAuth } from "../middlewares/auth.middleware.js";

export default createCrudRouter(productController, {
  listMiddlewares: [optionalAuth],
  getMiddlewares: [optionalAuth],
  createMiddlewares: [protect, authorize("admin")],
  updateMiddlewares: [protect, authorize("admin")],
  deleteMiddlewares: [protect, authorize("admin")]
});
