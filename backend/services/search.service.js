import Product from "../models/Product.js";

/**
 * Normalize Vietnamese text: remove diacritics, replace đ/Đ with d
 */
const normalizeVietnamese = (text = "") =>
  String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .trim();

/**
 * Search products using MongoDB Atlas Search ($search aggregation).
 * Supports fuzzy matching and Vietnamese diacritics-insensitive search
 * thanks to icuFolding in the Atlas Search index analyzer.
 *
 * @param {string} query - The search query
 * @param {object} options - { limit }
 * @returns {{ results: Array, total: number }}
 */
export async function searchProducts(query, { limit = 10 } = {}) {
  const trimmedQuery = (query || "").trim();
  if (!trimmedQuery) return { results: [], total: 0 };

  const normalizedQuery = normalizeVietnamese(trimmedQuery);
  const words = trimmedQuery.split(/\s+/);

  const mustClauses = words.map((word) => ({
    text: {
      query: word,
      path: "name",
      fuzzy: {
        maxEdits: 1,
        prefixLength: 0,
      },
    },
  }));

  const pipeline = [
    {
      $search: {
        index: "product_search",
        compound: {
          must: mustClauses,
          should: [
            {
              phrase: {
                query: trimmedQuery,
                path: "name",
                score: { boost: { value: 10 } },
              },
            },
            {
              wildcard: {
                query: `*${normalizedQuery}*`,
                path: "slug",
                allowAnalyzedField: true,
                score: { boost: { value: 5 } },
              },
            },
          ],
          filter: [
            { equals: { path: "isActive", value: true } },
            { equals: { path: "isDeleted", value: false } },
          ],
        },
      },
    },
    {
      $addFields: {
        searchScore: { $meta: "searchScore" },
      },
    },
    { $sort: { searchScore: -1 } },
    {
      $facet: {
        results: [
          { $limit: limit },
          {
            $project: {
              _id: 1,
              name: 1,
              slug: 1,
              price: 1,
              discount: 1,
              images: 1,
              searchScore: 1,
            },
          },
        ],
        total: [{ $count: "count" }],
      },
    },
  ];

  const [facetResult] = await Product.aggregate(pipeline);

  const total = facetResult?.total?.[0]?.count || 0;
  const results = (facetResult?.results || []).map((product) => ({
    id: product._id,
    name: product.name,
    slug: product.slug || "",
    currentPrice:
      product.discount > 0
        ? Math.round(product.price * (1 - product.discount / 100))
        : product.price,
    originalPrice: product.price,
    imageUrl: product.images?.[0] || "",
    discount: product.discount || 0,
  }));

  return { results, total };
}
