import Collection from "../models/Collection.js";
import { attachGalleryImagesToProducts } from "./productImage.service.js";

const productSelect = "name slug price discount images isActive";

const attachGalleryToCollectionProducts = async (collection) => {
  if (!collection) return collection;

  const plain = collection.toObject ? collection.toObject() : collection;
  const products = Array.isArray(plain.products)
    ? plain.products.filter(Boolean)
    : [];

  return {
    ...plain,
    products: await attachGalleryImagesToProducts(products)
  };
};

export const getCollectionByIdService = async (collectionId) => {
  const collection = await Collection.findById(collectionId)
    .populate({
      path: "products",
      select: productSelect
    });

  if (!collection) {
    throw Object.assign(new Error("Collection not found"), { statusCode: 404 });
  }

  return await attachGalleryToCollectionProducts(collection);
};

export const getCollectionBySlugService = async (slug) => {
  const collection = await Collection.findOne({ slug })
    .populate({
      path: "products",
      select: productSelect,
      match: { isActive: true }
    });

  if (!collection) {
    throw Object.assign(new Error("Không tìm thấy bộ sưu tập"), { statusCode: 404 });
  }

  return await attachGalleryToCollectionProducts(collection);
};
