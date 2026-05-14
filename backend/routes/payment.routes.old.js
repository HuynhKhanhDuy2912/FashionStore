import { createCrudRouter } from "./base.route.js";
import paymentController from "../controllers/payment.controller.js";
import Payment from "../models/Payment.js";
import { protect } from "../middlewares/auth.middleware.js";
import {
  attachOwner,
  checkOwnership,
  scopeToOwner
} from "../middlewares/ownership.middleware.js";

export default createCrudRouter(paymentController, {
  listMiddlewares: [protect, scopeToOwner("userId")],
  getMiddlewares: [protect, checkOwnership(Payment, "userId")],
  createMiddlewares: [protect, attachOwner("userId")],
  updateMiddlewares: [protect, checkOwnership(Payment, "userId"), attachOwner("userId")],
  deleteMiddlewares: [protect, checkOwnership(Payment, "userId")]
});
