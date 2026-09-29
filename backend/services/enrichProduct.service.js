import ProductVariant from "../models/ProductVariant.js";
import Collection from "../models/Collection.js";
import { attachGalleryImagesToProducts } from "./productImage.service.js";

/**
 * Enrich a list of products with availableVariants and collectionName
 * so ProductCard can display color swatches, sizes, and quick-add to cart.
 */
export async function enrichProducts(products) {
  if (!products || products.length === 0) return products;

  const productIds = products.map((p) => p._id);

  // 1. Fetch all active variants for these products in one query
  const variants = await ProductVariant.find({
    productId: { $in: productIds },
    isActive: true
  }).lean();

  // 2. Fetch active collections that contain any of these products
  const collections = await Collection.find({
    isActive: true,
    products: { $in: productIds }
  })
    .select("name products")
    .lean();

  // Build a map: productId -> collectionName (first match wins)
  const collectionNameMap = new Map();
  collections.forEach((col) => {
    col.products.forEach((pid) => {
      const key = pid.toString();
      if (!collectionNameMap.has(key)) {
        collectionNameMap.set(key, col.name);
      }
    });
  });

  // Build a map: productId -> variants[]
  const variantsByProduct = new Map();
  variants.forEach((v) => {
    const key = v.productId.toString();
    if (!variantsByProduct.has(key)) variantsByProduct.set(key, []);
    variantsByProduct.get(key).push(v);
  });

  const productsWithGalleryImages = await attachGalleryImagesToProducts(products);

  // Attach to each product
  return productsWithGalleryImages.map((product) => {
    const key = product._id.toString();
    return {
      ...product,
      availableVariants: variantsByProduct.get(key) || [],
      collectionName: collectionNameMap.get(key) || product.collectionName || null
    };
  });
}
