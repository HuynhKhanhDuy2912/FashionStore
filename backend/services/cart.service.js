import Cart from "../models/Cart.js";
import CartItem from "../models/CartItem.js";
import ProductVariant from "../models/ProductVariant.js";
import UserBehavior from "../models/UserBehavior.js";

const populateCartItems = (query) =>
  query
    .populate("cartId", "userId")
    .populate("productId", "name price discount images style isDeleted")
    .populate("variantId", "size color sku stock priceAdjustment discount image isDeleted isActive");

const calculateCartTotals = (items) => {
  const normalizedItems = items.map((item) => {
    const isUnavailable =
      !item.productId ||
      item.productId.isDeleted ||
      !item.variantId ||
      item.variantId.isDeleted ||
      !item.variantId.isActive;

    if (isUnavailable) {
      return {
        ...item.toObject(),
        isUnavailable: true,
        pricing: {
          productPrice: 0,
          discountPercent: 0,
          variantAdjustment: 0,
          unitPrice: 0,
          lineTotal: 0
        }
      };
    }

    const productPrice = item.productId?.price || 0;
    const productDiscount = item.productId?.discount || 0;
    const variantDiscount = item.variantId?.discount;
    const discountPercent = (variantDiscount !== null && variantDiscount !== undefined)
      ? variantDiscount
      : productDiscount;
    const discountedBasePrice = productPrice - (productPrice * discountPercent) / 100;
    const variantAdjustment = item.variantId?.priceAdjustment || 0;
    const unitPrice = Math.max(discountedBasePrice + variantAdjustment, 0);
    const lineTotal = unitPrice * item.quantity;

    return {
      ...item.toObject(),
      isUnavailable: false,
      pricing: {
        productPrice,
        discountPercent,
        variantAdjustment,
        unitPrice: Math.round(unitPrice),
        lineTotal: Math.round(lineTotal)
      }
    };
  });

  const availableItems = normalizedItems.filter((i) => !i.isUnavailable);
  const subTotal = availableItems.reduce((sum, i) => sum + i.pricing.lineTotal, 0);
  const quantityCount = availableItems.reduce((sum, i) => sum + i.quantity, 0);
  const itemCount = normalizedItems.length;

  return { items: normalizedItems, subTotal: Math.round(subTotal), itemCount, quantityCount };
};

export const getCartDetail = async (userId) => {
  let cart = await Cart.findOne({ userId });
  if (!cart) cart = await Cart.create({ userId });

  const rawItems = await populateCartItems(
    CartItem.find({ cartId: cart._id })
  );

  return { cart, ...calculateCartTotals(rawItems) };
};

export const addItemToCart = async (user, body) => {
  const { productId, variantId, quantity = 1, source = "product_page" } = body;

  const variant = await ProductVariant.findById(variantId).populate("productId");
  if (!variant || variant.isDeleted) throw new Error("Variant not found");
  if (!variant.isActive) throw new Error("Variant is not available");
  if (!variant.productId || variant.productId.isDeleted) throw new Error("Product is not available");
  if (variant.stock < quantity) throw new Error("Not enough stock");

  let cart = await Cart.findOne({ userId: user._id });
  if (!cart) cart = await Cart.create({ userId: user._id });

  let item = await CartItem.findOne({ cartId: cart._id, variantId });
  if (item) {
    const nextQuantity = item.quantity + quantity;
    if (variant.stock < nextQuantity) throw new Error("Not enough stock");

    item.quantity = nextQuantity;
    await item.save();
  } else {
    item = await CartItem.create({ cartId: cart._id, productId, variantId, quantity });
  }

  // Track behavior (nguồn DUY NHẤT cho add_to_cart — client không track nữa)
  // variant.productId đã được populate ở trên -> lấy đủ context cho recommendation
  const cartProduct = variant.productId;
  const toArray = (value) =>
    Array.isArray(value) ? value : value ? [value] : [];
  try {
    await UserBehavior.create({
      userId: user._id,
      productId,
      actionType: "add_to_cart",
      source,
      metadata: {
        categoryId: cartProduct.categoryId || null,
        style: toArray(cartProduct.style),
        occasion: toArray(cartProduct.occasion),
        variantId,
        quantity
      }
    });
  } catch (err) {
    console.error("Failed to track add_to_cart behavior:", err);
  }

  return populateCartItems(CartItem.findById(item._id));
};

export const updateCartItemQuantity = async (userId, cartItemId, updates) => {
  const cart = await Cart.findOne({ userId });
  if (!cart) throw new Error("Cart not found");

  const item = await CartItem.findOne({ _id: cartItemId, cartId: cart._id });
  if (!item) throw new Error("Cart item not found");

  const quantity = Number(
    typeof updates === "object" && updates !== null ? updates.quantity ?? item.quantity : updates
  );
  if (!Number.isFinite(quantity)) throw new Error("Invalid quantity");
  const nextVariantId =
    typeof updates === "object" && updates !== null && updates.variantId
      ? updates.variantId
      : item.variantId;

  if (quantity <= 0) {
    await item.deleteOne();
    return null;
  }

  const variant = await ProductVariant.findById(nextVariantId).populate("productId");
  if (!variant || variant.isDeleted) throw new Error("Variant not found");
  if (!variant.isActive) throw new Error("Variant is not available");
  if (!variant.productId || variant.productId.isDeleted) throw new Error("Product is not available");
  if (String(variant.productId._id) !== String(item.productId)) {
    throw new Error("Variant does not belong to this product");
  }

  const existingItem = await CartItem.findOne({
    cartId: cart._id,
    variantId: variant._id,
    _id: { $ne: item._id }
  });

  if (existingItem) {
    const mergedQuantity = existingItem.quantity + quantity;
    if (variant.stock < mergedQuantity) throw new Error("Not enough stock");

    existingItem.quantity = mergedQuantity;
    await existingItem.save();
    await item.deleteOne();

    return populateCartItems(CartItem.findById(existingItem._id));
  }

  if (variant.stock < quantity) throw new Error("Not enough stock");

  item.quantity = quantity;
  item.variantId = variant._id;
  await item.save();

  return populateCartItems(CartItem.findById(item._id));
};

export const removeCartItem = async (userId, cartItemId) => {
  const cart = await Cart.findOne({ userId });
  if (!cart) throw new Error("Cart not found");

  const item = await CartItem.findOneAndDelete({ _id: cartItemId, cartId: cart._id });
  if (!item) throw new Error("Cart item not found");

  return item;
};

export const clearCart = async (userId) => {
  const cart = await Cart.findOne({ userId });
  if (!cart) return;
  await CartItem.deleteMany({ cartId: cart._id });
};
