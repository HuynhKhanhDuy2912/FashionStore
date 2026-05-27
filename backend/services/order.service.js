import Cart from "../models/Cart.js";
import CartItem from "../models/CartItem.js";
import Order from "../models/Order.js";
import OrderItem from "../models/OrderItem.js";
import Payment from "../models/Payment.js";
import ProductVariant from "../models/ProductVariant.js";
import Review from "../models/Review.js";
import { createNotificationForAdmins } from "./notification.service.js";
import { createTransaction } from "./inventory.service.js";

const ORDER_POPULATE = [{ path: "userId", select: "username email fullname" }];

const populateOrder = (query) => query.populate(ORDER_POPULATE);

export const createOrderFromCart = async (user, body) => {
  const {
    shippingAddress,
    receiverName,
    receiverPhone,
    note,
    paymentMethod = "cod",
  } = body;
  const requestedItemIds = Array.isArray(body.cartItemIds)
    ? body.cartItemIds
    : Array.isArray(body.selectedItemIds)
      ? body.selectedItemIds
      : [];
  const selectedItemIds = requestedItemIds.length
    ? [...new Set(requestedItemIds.filter(Boolean).map(String))]
    : [];

  if (!shippingAddress) throw new Error("Shipping address is required");
  if (!receiverName) throw new Error("Receiver name is required");
  if (!receiverPhone) throw new Error("Receiver phone is required");
  if (requestedItemIds.length > 0 && selectedItemIds.length === 0) {
    throw new Error("Please select at least one cart item");
  }

  const cart = await Cart.findOne({ userId: user._id });
  if (!cart) throw new Error("Cart not found");

  const cartItemQuery = selectedItemIds.length
    ? { cartId: cart._id, _id: { $in: selectedItemIds } }
    : { cartId: cart._id };

  const cartItems = await CartItem.find(cartItemQuery)
    .populate("productId", "name price discount")
    .populate(
      "variantId",
      "size color sku stock priceAdjustment discount isActive",
    );

  if (cartItems.length === 0) throw new Error("Cart is empty");
  if (selectedItemIds.length && cartItems.length !== selectedItemIds.length) {
    throw new Error("Some selected cart items were not found");
  }

  // Validate stock
  for (const item of cartItems) {
    if (!item.variantId?.isActive)
      throw new Error(
        `Variant for ${item.productId?.name} is no longer available`,
      );
    if (item.variantId.stock < item.quantity)
      throw new Error(`Not enough stock for ${item.productId?.name}`);
  }

  // Calculate totals
  let subTotal = 0;
  const orderItemsData = cartItems.map((item) => {
    const basePrice = item.productId?.price || 0;
    const productDiscount = item.productId?.discount || 0;
    const variantDiscount = item.variantId?.discount;
    const discount =
      variantDiscount !== null && variantDiscount !== undefined
        ? variantDiscount
        : productDiscount;
    const discounted = basePrice - (basePrice * discount) / 100;
    const adj = item.variantId?.priceAdjustment || 0;
    const unitPrice = Math.round(Math.max(discounted + adj, 0));
    subTotal += unitPrice * item.quantity;

    return {
      productId: item.productId._id,
      variantId: item.variantId._id,
      quantity: item.quantity,
      price: unitPrice,
    };
  });

  // Receive shipping fee from frontend, with fallback to 0 (>= 999k) or 30k
  const providedShippingFee = body.shippingFee;
  const shippingFee =
    providedShippingFee !== undefined
      ? Number(providedShippingFee)
      : subTotal >= 999000
        ? 0
        : 30000;
  const totalPrice = subTotal + shippingFee;

  const order = await Order.create({
    userId: user._id,
    totalPrice,
    subTotal,
    shippingFee,
    discount: 0,
    status: "pending",
    paymentMethod,
    paymentStatus: paymentMethod === "cod" ? "pending" : "pending",
    shippingAddress,
    receiverName,
    receiverPhone,
    note: note || "",
  });

  await OrderItem.insertMany(
    orderItemsData.map((d) => ({ ...d, orderId: order._id })),
  );

  await Payment.create({
    orderId: order._id,
    userId: user._id,
    amount: totalPrice,
    paymentMethod,
    paymentStatus: "pending",
  });

  // KHÔNG trừ stock ngay - chỉ trừ khi đơn hàng được xác nhận (confirmed)
  // Stock sẽ được trừ trong updateAdminOrderStatus khi status chuyển sang "confirmed"

  // Remove only purchased items from the cart.
  await CartItem.deleteMany(
    selectedItemIds.length
      ? { cartId: cart._id, _id: { $in: selectedItemIds } }
      : { cartId: cart._id },
  );

  await createNotificationForAdmins("order", {
    orderId: order._id,
    orderNumber: order._id.toString().slice(-8).toUpperCase(),
    customerName: user.fullname || user.username || "Khách hàng",
    totalPrice,
    userName: user.fullname || user.username || "Khách hàng",
  });

  return populateOrder(Order.findById(order._id));
};

export const getMyOrders = async (userId) => {
  const orders = await Order.find({ userId })
    .sort({ createdAt: -1 })
    .populate(ORDER_POPULATE);

  const ordersWithItems = await Promise.all(
    orders.map(async (order) => {
      const items = await OrderItem.find({ orderId: order._id })
        .populate("productId", "name price discount images")
        .populate("variantId", "size color sku image priceAdjustment discount");

      if (order.status !== "completed") {
        const itemsWithReviewFlag = items.map((item) => ({
          ...item.toObject(),
          isReviewed: false,
        }));
        return { ...order.toObject(), items: itemsWithReviewFlag };
      }

      const productIds = [
        ...new Set(
          items.map((item) => item.productId?._id?.toString()).filter(Boolean),
        ),
      ];
      const reviewedRecords = await Review.find({
        userId,
        orderId: order._id,
        productId: { $in: productIds },
      }).select("productId");

      const reviewedProductIds = new Set(
        reviewedRecords.map((review) => review.productId.toString()),
      );
      const itemsWithReviewFlag = items.map((item) => ({
        ...item.toObject(),
        isReviewed: reviewedProductIds.has(item.productId?._id?.toString()),
      }));

      return { ...order.toObject(), items: itemsWithReviewFlag };
    }),
  );

  return ordersWithItems;
};

export const getOrderDetail = async (userId, orderId) => {
  const order = await Order.findOne({ _id: orderId, userId }).populate(
    ORDER_POPULATE,
  );
  if (!order) throw new Error("Khôn tìm thấy đơn hàng!");

  const items = await OrderItem.find({ orderId })
    .populate("productId", "name price discount images")
    .populate(
      "variantId",
      "size color sku image stock priceAdjustment discount",
    );

  return { ...order.toObject(), items };
};

export const cancelOrder = async (userId, orderId, cancellationReason = "") => {
  const reason = cancellationReason.trim();
  if (!reason) throw new Error("Cancellation reason is required");

  const order = await Order.findOne({ _id: orderId, userId });
  if (!order) throw new Error("Khôn tìm thấy đơn hàng!");
  if (!["pending", "confirmed"].includes(order.status)) {
    throw new Error("Cannot cancel order at this stage");
  }

  // Restore stock - chỉ hoàn trả nếu đơn hàng đã được confirmed (đã trừ stock)
  if (order.status === "confirmed") {
    const items = await OrderItem.find({ orderId });
    for (const item of items) {
      const variant = await ProductVariant.findById(item.variantId);

      // Create return transaction
      await createTransaction({
        variantId: item.variantId,
        productId: item.productId,
        type: "return",
        quantity: item.quantity,
        previousStock: variant.stock,
        newStock: variant.stock + item.quantity,
        reason: "Hoàn trả từ đơn hàng bị hủy bởi khách hàng",
        orderId: orderId,
        createdBy: userId,
      });

      await ProductVariant.findByIdAndUpdate(item.variantId, {
        $inc: { stock: item.quantity },
      });
    }
  }

  order.status = "cancelled";
  order.cancellationReason = reason;
  await order.save();
  return order;
};

export const getAdminOrders = async () => {
  return Order.find({}).sort({ createdAt: -1 }).populate(ORDER_POPULATE);
};

export { getAdminDashboardStats } from "./dashboard.service.js";

export const getAdminOrderDetail = async (orderId) => {
  const order = await Order.findById(orderId).populate(ORDER_POPULATE);
  if (!order) throw new Error("Khôn tìm thấy đơn hàng!");

  const items = await OrderItem.find({ orderId })
    .populate("productId", "name price images")
    .populate("variantId", "size color sku image");

  return { ...order.toObject(), items };
};

export const markOrderAsReceivedByUser = async (userId, orderId) => {
  const order = await Order.findOne({ _id: orderId, userId });
  if (!order) throw new Error("Khôn tìm thấy đơn hàng!");
  if (order.status !== "shipping") {
    throw new Error("Only shipping orders can be marked as received");
  }

  order.status = "completed";
  order.completedAt = new Date();

  if (order.paymentMethod === "cod") {
    order.paymentStatus = "paid";
    await Payment.findOneAndUpdate(
      { orderId: order._id },
      { paymentStatus: "paid", paidAt: new Date() },
    );
  }

  await order.save();
  return order;
};

export const updateAdminOrderStatus = async (
  orderId,
  status,
  cancellationReason = "",
) => {
  const validStatuses = [
    "pending",
    "confirmed",
    "shipping",
    "completed",
    "cancelled",
  ];
  if (!validStatuses.includes(status)) throw new Error("Invalid status");

  const reason = cancellationReason.trim();
  if (status === "cancelled" && !reason)
    throw new Error("Cancellation reason is required");

  const order = await Order.findById(orderId);
  if (!order) throw new Error("Khôn tìm thấy đơn hàng!");

  const previousStatus = order.status;

  // Validate allowed status transitions
  const allowedTransitions = {
    pending: ["confirmed", "cancelled"],
    confirmed: ["shipping", "cancelled"],
    shipping: ["completed"],
    completed: [],
    cancelled: [],
  };

  if (!allowedTransitions[previousStatus]?.includes(status)) {
    throw new Error(`Cannot change status from ${previousStatus} to ${status}`);
  }

  // Khi chuyển từ pending sang confirmed - trừ stock
  if (previousStatus === "pending" && status === "confirmed") {
    const items = await OrderItem.find({ orderId });
    for (const item of items) {
      const variant = await ProductVariant.findById(item.variantId);
      if (!variant) throw new Error(`Variant not found for item ${item._id}`);
      if (variant.stock < item.quantity) {
        throw new Error(`Not enough stock for variant ${variant.sku}`);
      }

      // Create export transaction
      await createTransaction({
        variantId: item.variantId,
        productId: item.productId,
        type: "export",
        quantity: -item.quantity,
        previousStock: variant.stock,
        newStock: variant.stock - item.quantity,
        reason: "Xuất kho cho đơn hàng",
        orderId: orderId,
        createdBy: order.userId,
      });

      await ProductVariant.findByIdAndUpdate(item.variantId, {
        $inc: { stock: -item.quantity },
      });
    }
  }

  // Khi admin hủy đơn hàng đã confirmed - hoàn trả stock
  if (previousStatus === "confirmed" && status === "cancelled") {
    const items = await OrderItem.find({ orderId });
    for (const item of items) {
      const variant = await ProductVariant.findById(item.variantId);

      // Create return transaction
      await createTransaction({
        variantId: item.variantId,
        productId: item.productId,
        type: "return",
        quantity: item.quantity,
        previousStock: variant.stock,
        newStock: variant.stock + item.quantity,
        reason: "Hoàn trả từ đơn hàng bị hủy",
        orderId: orderId,
        createdBy: order.userId,
      });

      await ProductVariant.findByIdAndUpdate(item.variantId, {
        $inc: { stock: item.quantity },
      });
    }
  }

  // Cập nhật completedAt khi đơn hàng hoàn thành
  if (status === "completed") {
    order.completedAt = new Date();
  } else if (previousStatus === "completed" && status !== "completed") {
    order.completedAt = null;
  }

  // Cập nhật cancelledAt khi đơn hàng bị hủy
  if (status === "cancelled") {
    order.cancelledAt = new Date();
    order.cancellationReason = reason;
  } else if (previousStatus === "cancelled" && status !== "cancelled") {
    order.cancelledAt = null;
    order.cancellationReason = "";
  }

  order.status = status;

  if (status === "completed" && order.paymentMethod === "cod") {
    order.paymentStatus = "paid";
    await Payment.findOneAndUpdate(
      { orderId: order._id },
      { paymentStatus: "paid", paidAt: new Date() },
    );
  }

  await order.save();
  return order;
};
