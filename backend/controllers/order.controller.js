import Order from "../models/Order.js";
import { createCrudControllers } from "./base.controller.js";
import {
  cancelOrder,
  createOrderFromCart,
  getAdminOrderDetail,
  getAdminOrders,
  getAdminDashboardStats,
  getMyOrders,
  getOrderDetail,
  markOrderAsReceivedByUser,
  updateAdminOrderStatus
} from "../services/order.service.js";

const baseOrderController = createCrudControllers(Order, {
  modelName: "Order",
  populate: [{ path: "userId", select: "username email full_name" }]
});

export const checkoutMyOrder = async (req, res) => {
  try {
    const order = await createOrderFromCart(req.user, req.body);

    return res.status(201).json({
      success: true,
      message: "Checkout successful",
      data: order
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const getMyOrderList = async (req, res) => {
  try {
    const orders = await getMyOrders(req.user._id);

    return res.status(200).json({
      success: true,
      message: "Orders fetched successfully",
      data: orders
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getMyOrderById = async (req, res) => {
  try {
    const order = await getOrderDetail(req.user._id, req.params.orderId);

    return res.status(200).json({
      success: true,
      message: "Order fetched successfully",
      data: order
    });
  } catch (error) {
    const statusCode = error.message === "Order not found" ? 404 : 400;

    return res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

export const cancelMyOrder = async (req, res) => {
  try {
    const order = await cancelOrder(req.user._id, req.params.orderId, req.body.cancellationReason || "");

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      data: order
    });
  } catch (error) {
    const statusCode = error.message === "Order not found" ? 404 : 400;

    return res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

export const markMyOrderAsReceived = async (req, res) => {
  try {
    const order = await markOrderAsReceivedByUser(req.user._id, req.params.orderId);

    return res.status(200).json({
      success: true,
      message: "Order marked as received successfully",
      data: order
    });
  } catch (error) {
    const statusCode = error.message === "Order not found" ? 404 : 400;

    return res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

export const getAdminDashboardStatsHandler = async (_req, res) => {
  try {
    const stats = await getAdminDashboardStats();

    return res.status(200).json({
      success: true,
      message: "Dashboard stats fetched successfully",
      data: stats,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getAdminOrderList = async (_req, res) => {
  try {
    const orders = await getAdminOrders();

    return res.status(200).json({
      success: true,
      message: "Admin orders fetched successfully",
      data: orders
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getAdminOrderById = async (req, res) => {
  try {
    const order = await getAdminOrderDetail(req.params.orderId);

    return res.status(200).json({
      success: true,
      message: "Admin order fetched successfully",
      data: order
    });
  } catch (error) {
    const statusCode = error.message === "Order not found" ? 404 : 400;

    return res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

export const updateAdminOrder = async (req, res) => {
  try {
    const order = await updateAdminOrderStatus(
      req.params.orderId,
      req.body.status,
      req.body.cancellationReason || ""
    );

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data: order
    });
  } catch (error) {
    const statusCode = error.message === "Order not found" ? 404 : 400;

    return res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

export default {
  ...baseOrderController,
  checkoutMyOrder,
  getMyOrderList,
  getMyOrderById,
  cancelMyOrder,
  markMyOrderAsReceived,
  getAdminOrderList,
  getAdminDashboardStatsHandler,
  getAdminOrderById,
  updateAdminOrder,
};
