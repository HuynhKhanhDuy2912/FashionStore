import Cart from "../models/Cart.js";
import {
  sendOrderConfirmationEmail,
  sendOrderCompletedEmail,
} from "./orderEmail.service.js";
import CartItem from "../models/CartItem.js";
import Order from "../models/Order.js";
import OrderItem from "../models/OrderItem.js";
import Payment from "../models/Payment.js";
import ProductVariant from "../models/ProductVariant.js";
import Review from "../models/Review.js";
import UserBehavior from "../models/UserBehavior.js";
import { createNotificationForAdmins } from "./notification.service.js";
import { createTransaction } from "./inventory.service.js";
import User from "../models/User.js";
import {
  validateAndCalculateCoupon,
  applyCoupon,
  revokeCoupon,
  generateDynamicRewardCoupon,
} from "./coupon.service.js";

const ORDER_POPULATE = [{ path: "userId", select: "username email fullname" }];

const populateOrder = (query) => query.populate(ORDER_POPULATE);

const buildOrderDraftFromCart = async (user, body) => {
  const {
    shippingAddress,
    receiverName,
    receiverPhone,
    note,
    paymentMethod = "cod",
    couponCode,
    shippingCouponCode,
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
    .populate(
      "productId",
      "name price discount images isDeleted categoryId style occasion",
    )
    .populate(
      "variantId",
      "size color sku stock priceAdjustment discount isActive image isDeleted",
    );

  if (cartItems.length === 0) throw new Error("Cart is empty");
  if (selectedItemIds.length && cartItems.length !== selectedItemIds.length) {
    throw new Error("Some selected cart items were not found");
  }

  // Validate stock
  for (const item of cartItems) {
    if (!item.productId || item.productId.isDeleted) {
      throw new Error(
        `Sản phẩm ${item.productId?.name || ""} không còn tồn tại`,
      );
    }
    if (
      !item.variantId ||
      item.variantId.isDeleted ||
      !item.variantId.isActive
    ) {
      throw new Error(
        `Phân loại cho sản phẩm ${item.productId?.name} không còn khả dụng`,
      );
    }
    if (item.variantId.stock < item.quantity)
      throw new Error(`Không đủ hàng cho sản phẩm ${item.productId?.name}`);
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
      productSnapshot: {
        name: item.productId.name,
        image: item.productId.images?.[0] || "",
        price: item.productId.price,
        discount: item.productId.discount,
      },
      variantSnapshot: {
        size: item.variantId.size,
        color: item.variantId.color,
        sku: item.variantId.sku,
        image: item.variantId.image || "",
      },
    };
  });

  // Receive shipping fee from frontend, with fallback to 0 (>= 999k) or 30k
  const providedShippingFee = body.shippingFee;
  let shippingFee =
    providedShippingFee !== undefined
      ? Number(providedShippingFee)
      : subTotal >= 999000
        ? 0
        : 30000;

  // Apply product discount coupon (percentage / fixed_amount)
  let couponDiscount = 0;
  let appliedCoupon = null;
  if (couponCode) {
    const result = await validateAndCalculateCoupon(
      couponCode,
      user._id,
      subTotal,
      shippingFee,
    );
    if (result.coupon.discountType === "free_shipping") {
      throw new Error("Mã này là mã miễn phí ship, vui lòng chọn đúng loại");
    }
    couponDiscount = result.discountAmount;
    appliedCoupon = result.coupon;
  }

  // Apply free shipping coupon
  let shippingDiscount = 0;
  let appliedShippingCoupon = null;
  if (shippingCouponCode) {
    const result = await validateAndCalculateCoupon(
      shippingCouponCode,
      user._id,
      subTotal,
      shippingFee,
    );
    if (result.coupon.discountType !== "free_shipping") {
      throw new Error("Mã này không phải mã miễn phí ship");
    }
    shippingDiscount = Math.min(result.discountAmount, shippingFee);
    appliedShippingCoupon = result.coupon;
  }

  const discount = couponDiscount + shippingDiscount;
  const totalPrice = Math.max(
    subTotal - couponDiscount + shippingFee - shippingDiscount,
    0,
  );

  return {
    cart,
    cartItems,
    selectedItemIds,
    orderItemsData,
    appliedCoupon,
    appliedShippingCoupon,
    couponDiscount,
    shippingDiscount,
    orderData: {
      userId: user._id,
      totalPrice,
      subTotal,
      shippingFee,
      discount,
      couponCode: appliedCoupon?.code || null,
      shippingCouponCode: appliedShippingCoupon?.code || null,
      couponDiscount,
      shippingDiscount,
      status: "pending",
      paymentMethod,
      paymentStatus: "pending",
      shippingAddress,
      receiverName,
      receiverPhone,
      note: note || "",
    },
  };
};

export const previewOrderFromCart = async (user, body) => {
  const draft = await buildOrderDraftFromCart(user, body);

  return {
    totalPrice: draft.orderData.totalPrice,
    subTotal: draft.orderData.subTotal,
    shippingFee: draft.orderData.shippingFee,
    discount: draft.orderData.discount,
    couponDiscount: draft.orderData.couponDiscount,
    shippingDiscount: draft.orderData.shippingDiscount,
    selectedItemIds: draft.selectedItemIds,
    itemCount: draft.cartItems.length,
  };
};

export const createOrderFromCart = async (user, body) => {
  const draft = await buildOrderDraftFromCart(user, body);
  const {
    cart,
    cartItems,
    selectedItemIds,
    orderItemsData,
    appliedCoupon,
    appliedShippingCoupon,
    couponDiscount,
    shippingDiscount,
    orderData,
  } = draft;

  const order = await Order.create(orderData);

  await OrderItem.insertMany(
    orderItemsData.map((d) => ({ ...d, orderId: order._id })),
  );

  await Payment.create({
    orderId: order._id,
    userId: user._id,
    amount: orderData.totalPrice,
    paymentMethod: orderData.paymentMethod,
    paymentStatus: "pending",
  });

  // Record coupon usage
  if (appliedCoupon) {
    await applyCoupon(appliedCoupon._id, user._id, order._id, couponDiscount);
  }
  if (appliedShippingCoupon) {
    await applyCoupon(
      appliedShippingCoupon._id,
      user._id,
      order._id,
      shippingDiscount,
    );
  }

  // KHÔNG trừ stock ngay - chỉ trừ khi đơn hàng được xác nhận (confirmed)
  // Stock sẽ được trừ trong updateAdminOrderStatus khi status chuyển sang "confirmed"

  // Remove only purchased items from the cart.
  await CartItem.deleteMany(
    selectedItemIds.length
      ? { cartId: cart._id, _id: { $in: selectedItemIds } }
      : { cartId: cart._id },
  );

  // Track purchase behavior for each product
  // style/occasion là [String] trong Product → giữ nguyên dạng mảng để khớp schema mới
  const toArray = (value) =>
    Array.isArray(value) ? value : value ? [value] : [];
  const purchaseBehaviors = cartItems.map((item) => ({
    userId: user._id,
    productId: item.productId._id,
    actionType: "purchase",
    source: "cart",
    metadata: {
      categoryId: item.productId.categoryId || null,
      style: toArray(item.productId.style),
      occasion: toArray(item.productId.occasion),
    },
  }));
  UserBehavior.insertMany(purchaseBehaviors).catch((err) => {
    console.error("Failed to track purchase behaviors:", err);
  });

  await createNotificationForAdmins("order", {
    orderId: order._id,
    orderNumber: order._id.toString().slice(-8).toUpperCase(),
    customerName: user.fullname || user.username || "Khách hàng",
    totalPrice: orderData.totalPrice,
    userName: user.fullname || user.username || "Khách hàng",
  });

  let awardedCoupons = [];
  if (orderData.paymentMethod === "cod") {
    awardedCoupons = await grantRewardCoupons(user._id, orderData.subTotal);
  }

  const populatedOrder = await populateOrder(Order.findById(order._id)).lean();

  // Fire-and-forget: gửi email xác nhận đơn hàng (chỉ COD, VNPay/PayPal xử lý ở payment callback)
  if (orderData.paymentMethod === "cod") {
    const emailItems = await OrderItem.find({ orderId: order._id });
    sendOrderConfirmationEmail(populatedOrder, emailItems, user).catch((err) =>
      console.error("Failed to send order confirmation email:", err.message),
    );
  }

  return { ...populatedOrder, awardedCoupons };
};

export const grantRewardCoupons = async (userId, subTotal) => {
  const awardedCoupons = [];
  if (subTotal >= 999000) {
    const reward10 = await generateDynamicRewardCoupon(
      "G10",
      "percentage",
      10,
      "Giảm 10% cho đơn hàng đặc quyền",
    );
    awardedCoupons.push(reward10);
  }

  if (subTotal >= 1499000) {
    const rewardFree = await generateDynamicRewardCoupon(
      "F20K",
      "free_shipping",
      20000,
      "Miễn phí vận chuyển 20k cho đơn hàng đặc quyền",
    );
    awardedCoupons.push(rewardFree);
  }

  if (awardedCoupons.length > 0) {
    const couponIds = awardedCoupons.map((c) => c._id);
    await User.findByIdAndUpdate(userId, {
      $addToSet: { savedCoupons: { $each: couponIds } },
    });
  }
  return awardedCoupons;
};

export const getMyOrders = async (userId) => {
  const orders = await Order.find({ userId })
    .sort({ createdAt: -1 })
    .populate(ORDER_POPULATE);

  const ordersWithItems = await Promise.all(
    orders.map(async (order) => {
      const items = await OrderItem.find({ orderId: order._id })
        .populate("productId", "name price discount images isDeleted")
        .populate(
          "variantId",
          "size color sku image priceAdjustment discount isDeleted",
        );

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
    .populate("productId", "name price discount images isDeleted")
    .populate(
      "variantId",
      "size color sku image stock priceAdjustment discount isDeleted",
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

  // Revoke coupon usage
  await revokeCoupon(orderId);

  order.status = "cancelled";
  order.cancellationReason = reason;
  await order.save();
  return order;
};

export const refundAdminOrder = async (orderId, refundReason = "") => {
  const reason = refundReason.trim();
  if (!reason) throw new Error("Refund reason is required");

  const order = await Order.findById(orderId);
  if (!order) throw new Error("Khôn tìm thấy đơn hàng!");

  // Trục TIỀN: chỉ hoàn được khi đã thực sự thu tiền.
  if (order.paymentStatus !== "paid") {
    throw new Error("Chỉ có thể hoàn tiền cho đơn đã thanh toán");
  }
  // Idempotent: đã hoàn rồi thì chặn, tránh hoàn 2 lần.
  if (order.paymentStatus === "refunded") {
    throw new Error("Đơn hàng đã được hoàn tiền");
  }

  // Trục VẬN HÀNH: chỉ hoàn khi đơn đã kết thúc (hủy hoặc hoàn thành).
  if (!["cancelled", "completed"].includes(order.status)) {
    throw new Error("Đơn cần được hủy hoặc hoàn thành trước khi hoàn tiền");
  }

  // KHÔNG đụng kho ở đây: đơn 'cancelled' (từ confirmed) đã được hoàn kho
  // trong cancelOrder/updateAdminOrderStatus. Refund chỉ xử lý TIỀN.

  order.paymentStatus = "refunded";
  order.refundedAt = new Date();
  order.refundReason = reason;
  await order.save();

  await Payment.findOneAndUpdate(
    { orderId: order._id },
    { paymentStatus: "refunded" },
  );

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
    .populate("productId", "name price images isDeleted")
    .populate("variantId", "size color sku image isDeleted");

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

  // Fire-and-forget: gửi email thông báo đơn hàng hoàn thành
  const completedItems = await OrderItem.find({ orderId: order._id });
  const orderUser = await User.findById(userId);
  sendOrderCompletedEmail(order.toObject(), completedItems, orderUser).catch(
    (err) =>
      console.error("Failed to send order completed email:", err.message),
  );

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

  // Revoke coupon usage when cancelling
  if (status === "cancelled") {
    await revokeCoupon(orderId);
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

  // Fire-and-forget: gửi email khi admin chuyển trạng thái sang "completed"
  if (status === "completed") {
    const completedItems = await OrderItem.find({ orderId });
    const orderUser = await User.findById(order.userId);
    sendOrderCompletedEmail(
      order.toObject(),
      completedItems,
      orderUser,
    ).catch((err) =>
      console.error("Failed to send order completed email:", err.message),
    );
  }

  return order;
};
