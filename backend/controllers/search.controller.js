import { searchProducts } from "../services/search.service.js";

/**
 * GET /api/products/search?q=keyword&limit=10
 * Full-text search using MongoDB Atlas Search
 */
const search = async (req, res) => {
  try {
    const query = (req.query.q || "").trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);

    if (!query) {
      return res.status(200).json({
        success: true,
        data: [],
        total: 0,
      });
    }

    const { results, total } = await searchProducts(query, { limit });

    return res.status(200).json({
      success: true,
      data: results,
      total,
    });
  } catch (error) {
    console.error("[Search] Error:", error.message);

    // Fallback: if Atlas Search index not found, return empty
    if (
      error.message?.includes("$search") ||
      error.message?.includes("index not found")
    ) {
      return res.status(200).json({
        success: true,
        data: [],
        total: 0,
        warning: "Search index not configured. Please create Atlas Search index.",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export default { search };
