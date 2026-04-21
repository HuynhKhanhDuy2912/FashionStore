import CartItem from "../models/CartItem.js";
import Order from "../models/Order.js";
import OrderItem from "../models/OrderItem.js";
import Payment from "../models/Payment.js";
import Product from "../models/Product.js";
import ProductVariant from "../models/ProductVariant.js";
import UserBehavior from "../models/UserBehavior.js";
import { getOrCreateCart } from "./cart.service.js";

const SHIPPING_FEE = 30000;

export const createOrderFromCart = async (user, payload) => {
  const cart = await getOrCreateCart(user._id);
  const cartItems = await CartItem.find({ cartId: cart._id })
    .populate("productId")
    .populate("variantId");

  if (!cartItems.length) {
    throw new Error("Cart is empty");
  }

  const invalidItem = cartItems.find(
    (item) =>
      !item.productId ||
      !item.variantId ||
      !item.productId.isActive ||
      !item.variantId.isActive ||
      item.variantId.stock < item.quantity
  );

  if (invalidItem) {
    throw new Error("Some cart items are invalid or out of stock");
  }

  const normalizedItems = cartItems.map((item) => {
    const productPrice = item.productId.price || 0;
    const discountPercent = item.productId.discount || 0;
    const discountedBasePrice = productPrice - (productPrice * discountPercent) / 100;
    const unitPrice = Math.max(discountedBasePrice + (item.variantId.priceAdjustment || 0), 0);

    return {
      cartItemId: item._id,
      productId: item.productId._id,
      variantId: item.variantId._id,
      quantity: item.quantity,
      unitPrice,
      lineTotal: unitPrice * item.quantity
    };
  });

  const subTotal = normalizedItems.reduce((total, item) => total + item.lineTotal, 0);
  const discount = 0;
  const shippingFee = payload.shippingFee ?? SHIPPING_FEE;
  const totalPrice = subTotal + shippingFee - discount;

  const order = await Order.create({
    userId: user._id,
    subTotal,
    shippingFee,
    discount,
    totalPrice,
    status: "pending",
    shippingAddress: payload.shippingAddress || user.address || "",
    receiverName: payload.receiverName || user.full_name || user.username || "",
    receiverPhone: payload.receiverPhone || user.phone_number || "",
    note: payload.note || ""
  });

  await OrderItem.insertMany(
    normalizedItems.map((item) => ({
      orderId: order._id,
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      price: item.unitPrice
    }))
  );

  await Promise.all(
    normalizedItems.map((item) =>
      ProductVariant.findByIdAndUpdate(item.variantId, {
        $inc: { stock: -item.quantity }
      })
    )
  );

  await Payment.create({
    orderId: order._id,
    userId: user._id,
    amount: totalPrice,
    paymentMethod: payload.paymentMethod || "cod",
    paymentStatus: payload.paymentMethod === "cod" ? "pending" : "paid",
    transactionId: payload.transactionId || "",
    paidAt: payload.paymentMethod && payload.paymentMethod !== "cod" ? new Date() : null
  });

  await Promise.all(
    normalizedItems.map(async (item) => {
      const product = await Product.findById(item.productId);

      return UserBehavior.create({
        userId: user._id,
        productId: item.productId,
        actionType: "purchase",
        source: "cart",
        metadata: {
          style: product?.style || "",
          color: ""
        },
        sessionId: payload.sessionId || ""
      });
    })
  );

  await CartItem.deleteMany({ cartId: cart._id });

  return getOrderDetail(user._id, order._id);
};

export const getOrderDetail = async (userId, orderId) => {
  const order = await Order.findOne({ _id: orderId, userId }).populate(
    "userId",
    "username email full_name"
  );

  if (!order) {
    throw new Error("Order not found");
  }

  const [items, payment] = await Promise.all([
    OrderItem.find({ orderId })
      .populate("productId", "name images style")
      .populate("variantId", "size color sku image"),
    Payment.findOne({ orderId })
  ]);

  return {
    order,
    items,
    payment
  };
};

export const getMyOrders = async (userId) => {
  const orders = await Order.find({ userId })
    .sort({ createdAt: -1 })
    .populate("userId", "username email full_name");

  const orderIds = orders.map((order) => order._id);
  const [items, payments] = await Promise.all([
    OrderItem.find({ orderId: { $in: orderIds } })
      .populate("productId", "name images")
      .populate("variantId", "size color sku"),
    Payment.find({ orderId: { $in: orderIds } })
  ]);

  return orders.map((order) => ({
    ...order.toObject(),
    items: items.filter((item) => item.orderId.toString() === order._id.toString()),
    payment: payments.find((payment) => payment.orderId.toString() === order._id.toString()) || null
  }));
};

export const cancelOrder = async (userId, orderId) => {
  const order = await Order.findOne({ _id: orderId, userId });

  if (!order) {
    throw new Error("Order not found");
  }

  if (!["pending", "confirmed"].includes(order.status)) {
    throw new Error("This order can no longer be cancelled");
  }

  const items = await OrderItem.find({ orderId });

  await Promise.all(
    items.map((item) =>
      ProductVariant.findByIdAndUpdate(item.variantId, {
        $inc: { stock: item.quantity }
      })
    )
  );

  order.status = "cancelled";
  await order.save();

  await Payment.findOneAndUpdate(
    { orderId },
    {
      paymentStatus: "failed"
    }
  );

  return getOrderDetail(userId, orderId);
};

export const getAdminOrders = async () => {
  const orders = await Order.find({})
    .sort({ createdAt: -1 })
    .populate("userId", "username email full_name");

  const orderIds = orders.map((order) => order._id);
  const [items, payments] = await Promise.all([
    OrderItem.find({ orderId: { $in: orderIds } })
      .populate("productId", "name images")
      .populate("variantId", "size color sku"),
    Payment.find({ orderId: { $in: orderIds } })
  ]);

  return orders.map((order) => ({
    ...order.toObject(),
    items: items.filter((item) => item.orderId.toString() === order._id.toString()),
    payment: payments.find((payment) => payment.orderId.toString() === order._id.toString()) || null
  }));
};

export const updateAdminOrderStatus = async (orderId, status) => {
  const allowedStatuses = ["pending", "confirmed", "shipping", "completed", "cancelled"];

  if (!allowedStatuses.includes(status)) {
    throw new Error("Invalid order status");
  }

  const order = await Order.findById(orderId);

  if (!order) {
    throw new Error("Order not found");
  }

  if (order.status === status) {
    return getAdminOrderDetail(orderId);
  }

  if (status === "cancelled" && order.status !== "cancelled") {
    const items = await OrderItem.find({ orderId });

    await Promise.all(
      items.map((item) =>
        ProductVariant.findByIdAndUpdate(item.variantId, {
          $inc: { stock: item.quantity }
        })
      )
    );

    await Payment.findOneAndUpdate(
      { orderId },
      {
        paymentStatus: "failed"
      }
    );
  }

  order.status = status;
  await order.save();

  if (status === "completed") {
    await Payment.findOneAndUpdate(
      { orderId },
      {
        paymentStatus: "paid",
        paidAt: new Date()
      }
    );
  }

  return getAdminOrderDetail(orderId);
};

export const getAdminOrderDetail = async (orderId) => {
  const order = await Order.findById(orderId).populate(
    "userId",
    "username email full_name phone_number"
  );

  if (!order) {
    throw new Error("Order not found");
  }

  const [items, payment] = await Promise.all([
    OrderItem.find({ orderId })
      .populate("productId", "name images style")
      .populate("variantId", "size color sku image"),
    Payment.findOne({ orderId })
  ]);

  return {
    order,
    items,
    payment
  };
};
