import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronDown,
  Heart,
  LayoutGrid,
  List,
  Plus,
  SlidersHorizontal,
  SortAsc,
  X,
  ChevronRight,
  ChevronsRight,
  ChevronsLeft,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { apiRequest } from "../lib/api.js";
import {
  attachVariantsToProducts,
  buildCatalogFilters,
  filterProducts,
} from "../lib/catalog.js";
import { getProductPath } from "../lib/slug.js";
import { sortSizes } from "../lib/sizes.js";
import { trackBehavior } from "../lib/tracking.js";
import { formatProductName } from "../lib/productName.js";
import { getPaginationRange } from "../lib/pagination.js";
import {
  FALLBACK_PRODUCT_IMAGE,
  findFirstDistinctImage,
  getProductGalleryImageUrls,
  getProductImageUrls
} from "../lib/productImages.js";
import toast from "react-hot-toast";

function getParentId(category) {
  if (!category?.parentId) return null;
  return typeof category.parentId === "string"
    ? category.parentId
    : category.parentId._id || null;
}

function sortByCreatedAt(items) {
  return [...items].sort(
    (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0),
  );
}

function getCategoryIdFromProduct(product) {
  if (!product?.categoryId) return null;
  return typeof product.categoryId === "string"
    ? product.categoryId
    : product.categoryId._id || null;
}

function collectCategoryScope(categories, rootCategoryId) {
  if (!rootCategoryId) return new Set();
  const scope = new Set([rootCategoryId]);
  let changed = true;

  while (changed) {
    changed = false;
    categories.forEach((category) => {
      const categoryId = category._id;
      const parentId = getParentId(category);
      if (!scope.has(categoryId) && parentId && scope.has(parentId)) {
        scope.add(categoryId);
        changed = true;
      }
    });
  }

  return scope;
}

function findCategoryPath(categories, categoryId) {
  if (!categoryId) return [];
  const byId = new Map(categories.map((item) => [item._id, item]));
  const path = [];
  let cursor = byId.get(categoryId);

  while (cursor) {
    path.unshift(cursor);
    const parentId = getParentId(cursor);
    cursor = parentId ? byId.get(parentId) : null;
  }

  return path;
}

function getRootCategoryId(categories, categoryId) {
  const path = findCategoryPath(categories, categoryId);
  return path[0]?._id || "";
}

function colorToHex(color) {
  const map = {
    den: "#111111",
    black: "#111111",
    trang: "#F4F4F5",
    white: "#F4F4F5",
    navy: "#243447",
    xanh: "#1D4ED8",
    do: "#DC2626",
    red: "#DC2626",
    xam: "#6B7280",
    gray: "#6B7280",
    be: "#D6C6AE",
    kem: "#EFE7DA",
    nau: "#7C4A2D",
    brown: "#7C4A2D",
  };

  const key = (color || "").trim().toLowerCase();
  return map[key] || "#9CA3AF";
}

function getColorGroups(product) {
  const groups = new Map();
  const variants = product.availableVariants || [];

  variants.forEach((variant) => {
    const key = (variant.color || "Mặc định").trim();
    if (!groups.has(key)) {
      groups.set(key, {
        color: key,
        hex: colorToHex(key),
        previewImage: variant.image || "",
        variants: [],
      });
    }
    groups.get(key).variants.push(variant);
    if (!groups.get(key).previewImage && variant.image) {
      groups.get(key).previewImage = variant.image;
    }
  });

  groups.forEach((group) => {
    if (!group.previewImage) {
      group.previewImage = getProductImageUrls(product)[0] || "";
    }
  });

  if (groups.size === 0) {
    groups.set("Mặc định", {
      color: "Mặc định",
      hex: "#9CA3AF",
      previewImage: getProductImageUrls(product)[0] || "",
      variants: [],
    });
  }

  return [...groups.values()];
}

function formatPrice(price) {
  return `${Number(price || 0).toLocaleString("vi-VN")} đ`;
}

// Giá hiển thị trên card = (giá gốc + điều chỉnh biến thể) * (1 - giảm giá).
// Dùng để sắp xếp theo giá cho khớp với con số người dùng nhìn thấy.
function getProductDisplayPrice(product) {
  const colorGroups = getColorGroups(product);
  const group = colorGroups[0];
  const sizes = sortSizes([
    ...new Set((group?.variants || []).map((item) => item.size).filter(Boolean)),
  ]);
  const selectedSize = sizes[0] || "";
  const variant =
    (group?.variants || []).find((item) => item.size === selectedSize) ||
    group?.variants?.[0] ||
    null;
  const basePrice = Number(product.price || 0);
  const priceAdjustment = Number(variant?.priceAdjustment || 0);
  const priceBeforeDiscount = basePrice + priceAdjustment;
  const productDiscount = product.discount || 0;
  const variantDiscount = variant?.discount;
  const effectiveDiscount =
    variantDiscount !== null && variantDiscount !== undefined
      ? variantDiscount
      : productDiscount;
  return effectiveDiscount > 0
    ? Math.round(priceBeforeDiscount * (1 - effectiveDiscount / 100))
    : priceBeforeDiscount;
}

const sortSequence = ["newest", "price_asc", "price_desc", "name_asc"];
const sortLabelMap = {
  newest: "Mới nhất",
  price_asc: "Giá tăng",
  price_desc: "Giá giảm",
  name_asc: "Tên A-Z",
};

const PAGE_SIZE = 12;

export default function ProductsPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tagsRef = useRef(null);

  const [products, setProducts] = useState([]);
  const [variants, setVariants] = useState([]);
  const [categories, setCategories] = useState([]);
  const [collections, setCollections] = useState([]);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showMobileCategoryPanel, setShowMobileCategoryPanel] = useState(false);
  const [sortBy, setSortBy] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState("grid");
  const [activeSwatchByProduct, setActiveSwatchByProduct] = useState({});
  const [quickAddByProduct, setQuickAddByProduct] = useState({});
  const [wishlistProductIds, setWishlistProductIds] = useState(new Set());
  const [filters, setFilters] = useState({
    style: "",
    gender: searchParams.get("gender") || "",
    occasion: "",
    soldOnly: searchParams.get("bestSeller") === "1",
    discountOnly:
      searchParams.get("sale") === "1" || searchParams.get("tag") === "uu-dai",
    minPrice: "",
    maxPrice: "",
  });

  const selectedCategoryId = searchParams.get("categoryId") || "";
  const searchKeyword = searchParams.get("search") || "";
  const isBestSellerContext = searchParams.get("bestSeller") === "1";
  const isNewArrivalsContext = searchParams.get("newArrivals") === "1";
  const isSaleContext =
    searchParams.get("sale") === "1" || searchParams.get("tag") === "uu-dai";
  const isCategoryContext = Boolean(selectedCategoryId);
  const isSearchContext = Boolean(searchKeyword);
  const useNewAllProductsLayout = !isCategoryContext && !isSearchContext;

  // Map productId -> collection name
  const productCollectionMap = useMemo(() => {
    const map = new Map();
    collections.forEach((col) => {
      if (!col.isActive) return;
      (col.products || []).forEach((p) => {
        const pid = p._id || p;
        if (!map.has(pid)) map.set(pid, col.name);
      });
    });
    return map;
  }, [collections]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const requests = [
          apiRequest("/products?limit=500"),
          apiRequest("/product-variants?limit=1200"),
          apiRequest("/categories?limit=1000"),
          apiRequest("/collections?limit=100&isActive=true"),
        ];
        if (token) requests.push(apiRequest("/wishlists/me", { token }));

        const [
          productResponse,
          variantResponse,
          categoryResponse,
          collectionResponse,
          wishlistResponse,
        ] = await Promise.all(requests);

        setProducts(productResponse.data || []);
        setVariants(variantResponse.data || []);
        setCategories(categoryResponse.data || []);
        setCollections(collectionResponse.data || []);
        setWishlistProductIds(
          new Set(
            (wishlistResponse?.data?.items || [])
              .map((item) => item.productId?._id)
              .filter(Boolean),
          ),
        );
      } catch (loadError) {
        toast.error(loadError.message);
      }
    };

    loadData();
  }, [token]);

  // Search results state
  const [searchMatchIds, setSearchMatchIds] = useState(null);
  const [isSearchLoading, setIsSearchLoading] = useState(false);

  useEffect(() => {
    if (!searchKeyword) {
      setSearchMatchIds(null);
      return;
    }

    let cancelled = false;
    setIsSearchLoading(true);

    apiRequest(`/products/search?q=${encodeURIComponent(searchKeyword)}&limit=50`)
      .then((response) => {
        if (cancelled) return;
        const ids = new Set((response.data || []).map((item) => item.id));
        setSearchMatchIds(ids);
      })
      .catch(() => {
        if (!cancelled) setSearchMatchIds(new Set());
      })
      .finally(() => {
        if (!cancelled) setIsSearchLoading(false);
      });

    return () => { cancelled = true; };
  }, [searchKeyword]);

  const toggleWishlist = async (product) => {
    if (!token) {
      navigate("/login");
      return;
    }

    const isWishlisted = wishlistProductIds.has(product._id);

    try {
      if (isWishlisted) {
        await apiRequest(`/wishlists/me/product/${product._id}`, {
          method: "DELETE",
          token,
        });
        setWishlistProductIds((current) => {
          const next = new Set(current);
          next.delete(product._id);
          return next;
        });
        toast.success(`Đã bỏ ${formatProductName(product.name)} khỏi danh sách yêu thích`);

        // Track remove_from_wishlist behavior
        trackBehavior(token, {
          actionType: "remove_from_wishlist",
          productId: product._id,
          source: "category"
        });
      } else {
        await apiRequest("/wishlists/me", {
          method: "POST",
          token,
          body: {
            productId: product._id,
            addedFrom: "product_page",
          },
        });
        setWishlistProductIds((current) => new Set([...current, product._id]));
        toast.success(`Đã thêm ${formatProductName(product.name)} vào danh sách yêu thích`);

        // Track add_to_wishlist behavior (đối xứng với remove_from_wishlist)
        trackBehavior(token, {
          actionType: "add_to_wishlist",
          productId: product._id,
          source: "category",
          metadata: {
            categoryId: typeof product.categoryId === "object" ? product.categoryId?._id : product.categoryId,
            style: Array.isArray(product.style) ? product.style : (product.style ? [product.style] : []),
            occasion: Array.isArray(product.occasion) ? product.occasion : (product.occasion ? [product.occasion] : [])
          }
        });
      }
    } catch (requestError) {
      toast.error(requestError.message);
    }
  };

  useEffect(() => {
    setFilters((current) => ({
      ...current,
      gender: searchParams.get("gender") || "",
      soldOnly: searchParams.get("bestSeller") === "1",
      discountOnly:
        searchParams.get("sale") === "1" ||
        searchParams.get("tag") === "uu-dai",
    }));

    if (searchParams.get("newArrivals") === "1") {
      setSortBy("newest");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!token) return;
    const hasFilters = filters.style || filters.gender || filters.occasion || selectedCategoryId;

    if (!hasFilters) return;

    const timer = setTimeout(() => {
      let keyword = "";
      if (hasFilters) {
        const filterParts = [];
        if (selectedCategoryId) {
          const catName = categories.find(c => c._id === selectedCategoryId)?.name || "";
          filterParts.push(`Danh mục: ${catName || selectedCategoryId}`);
        }
        if (filters.style) filterParts.push(`Style: ${getStyleLabel(filters.style)}`);
        if (filters.gender) filterParts.push(`Giới tính: ${filters.gender === "male" ? "Nam" : "Nữ"}`);
        if (filters.occasion) filterParts.push(`Dịp: ${getOccasionLabel(filters.occasion)}`);
        keyword = `[Bộ lọc] ${filterParts.join(" | ")}`;
      }

      trackBehavior(token, {
        actionType: "filter",
        source: "category",
        searchKeyword: keyword,
        metadata: {
          categoryId: selectedCategoryId || null,
          style: filters.style ? [filters.style] : [],
          occasion: filters.occasion ? [filters.occasion] : []
        }
      });
    }, 1500);

    return () => clearTimeout(timer);
  }, [filters, selectedCategoryId, token, categories, searchParams]);

  const productsWithVariants = useMemo(
    () => attachVariantsToProducts(products, variants),
    [products, variants],
  );

  const filterOptions = useMemo(
    () => buildCatalogFilters(productsWithVariants),
    [productsWithVariants],
  );

  const categoryScope = useMemo(
    () => collectCategoryScope(categories, selectedCategoryId),
    [categories, selectedCategoryId],
  );

  const baseFilteredProducts = useMemo(() => {
    let result = filterProducts(productsWithVariants, filters);
    if (selectedCategoryId) {
      result = result.filter((product) =>
        categoryScope.has(getCategoryIdFromProduct(product)),
      );
    }
    // Filter by search results
    if (searchMatchIds) {
      result = result.filter((product) => searchMatchIds.has(product._id));
    }
    return result;
  }, [productsWithVariants, filters, selectedCategoryId, categoryScope, searchMatchIds]);

  const filteredProducts = useMemo(() => {
    const data = [...baseFilteredProducts];
    if (sortBy === "price_asc")
      data.sort((a, b) => getProductDisplayPrice(a) - getProductDisplayPrice(b));
    if (sortBy === "price_desc")
      data.sort((a, b) => getProductDisplayPrice(b) - getProductDisplayPrice(a));
    if (sortBy === "name_asc")
      data.sort((a, b) => (a.name || "").localeCompare(b.name || "", "vi"));
    if (sortBy === "newest")
      data.sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
      );
    return data;
  }, [baseFilteredProducts, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const normalizedCurrentPage = Math.min(currentPage, totalPages);
  const paginatedProducts = useMemo(() => {
    const startIndex = (normalizedCurrentPage - 1) * PAGE_SIZE;
    return filteredProducts.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredProducts, normalizedCurrentPage]);

  const selectedRootCategoryId = useMemo(
    () => getRootCategoryId(categories, selectedCategoryId),
    [categories, selectedCategoryId],
  );

  const breadcrumbPath = useMemo(
    () => findCategoryPath(categories, selectedCategoryId),
    [categories, selectedCategoryId],
  );

  const selectedNode = useMemo(
    () => categories.find((item) => item._id === selectedCategoryId) || null,
    [categories, selectedCategoryId],
  );

  const level2AnchorId = useMemo(() => {
    if (!selectedNode) return "";

    const pathLength = breadcrumbPath.length;
    if (pathLength >= 3) {
      return breadcrumbPath[1]?._id || "";
    }

    if (pathLength === 2) {
      return selectedNode._id;
    }

    return "";
  }, [selectedNode, breadcrumbPath]);

  const quickTagBaseId = useMemo(() => {
    if (level2AnchorId) return level2AnchorId;
    return selectedRootCategoryId || "";
  }, [level2AnchorId, selectedRootCategoryId]);

  const quickTagCategories = useMemo(() => {
    if (!quickTagBaseId) return [];
    return sortByCreatedAt(
      categories.filter((category) => getParentId(category) === quickTagBaseId),
    );
  }, [categories, quickTagBaseId]);

  const hasQuickTags =
    Boolean(quickTagBaseId) || quickTagCategories.length > 0;

  const selectedScopeForTag = selectedCategoryId || quickTagBaseId || "";

  const selectedCategoryLabel = selectedNode?.name || "Tất cả sản phẩm";

  const categoryLevel1 = useMemo(
    () => sortByCreatedAt(categories.filter((item) => !getParentId(item))),
    [categories],
  );

  const selectedLevel1Id = useMemo(() => {
    if (!selectedCategoryId) return "";
    return breadcrumbPath[0]?._id || "";
  }, [selectedCategoryId, breadcrumbPath]);

  const isMaleOrFemaleCategory = useMemo(() => {
    if (!breadcrumbPath.length) return false;
    const rootName = breadcrumbPath[0]?.name?.toLowerCase() || "";
    return rootName.includes("nam") || rootName.includes("nữ");
  }, [breadcrumbPath]);

  const categoryLevel2 = useMemo(() => {
    if (!selectedLevel1Id) return [];
    return sortByCreatedAt(
      categories.filter((item) => getParentId(item) === selectedLevel1Id),
    );
  }, [categories, selectedLevel1Id]);

  const selectedLevel2Id = useMemo(() => {
    if (breadcrumbPath.length >= 2) return breadcrumbPath[1]?._id || "";
    return "";
  }, [breadcrumbPath]);

  const categoryLevel3 = useMemo(() => {
    if (!selectedLevel2Id) return [];
    return sortByCreatedAt(
      categories.filter((item) => getParentId(item) === selectedLevel2Id),
    );
  }, [categories, selectedLevel2Id]);

  const handleSelectCategory = (categoryId) => {
    const next = new URLSearchParams(searchParams);
    if (categoryId) next.set("categoryId", categoryId);
    else next.delete("categoryId");
    setSearchParams(next);
    setShowMobileCategoryPanel(false);
  };

  const handleSelectQuickTag = (tagCategoryId) => {
    handleSelectCategory(tagCategoryId);
  };
  function getOccasionLabel(occasion) {
    const map = {
      casual: "Thường ngày",
      work: "Đi làm",
      party: "Tiệc tùng",
      date: "Hẹn hò",
      travel: "Du lịch",
      sport: "Thể thao",
      formal: "Trang trọng",
      street: "Dạo phố",
    };
    return map[occasion] || occasion;
  }

  function getStyleLabel(style) {
    const map = {
      casual: "Thường ngày (Casual)",
      minimal: "Tối giản (Minimal)",
      streetwear: "Đường phố (Streetwear)",
      elegant: "Thanh lịch (Elegant)",
      sporty: "Thể thao (Sporty)",
      vintage: "Cổ điển (Vintage)",
      smart_casual: "Công sở năng động (Smart Casual)",
    };
    return map[style] || style;
  }

  const clearFiltersKeepCategory = () => {
    setFilters({
      style: "",
      gender: "",
      occasion: "",
      soldOnly: isBestSellerContext,
      discountOnly: isSaleContext,
      minPrice: "",
      maxPrice: "",
    });
    setSortBy("newest");
  };

  const hasClearableFilters = Boolean(
    filters.style ||
    filters.gender ||
    filters.occasion ||
    filters.minPrice ||
    filters.maxPrice ||
    (filters.discountOnly && !isSaleContext) ||
    sortBy !== "newest"
  );

  const activeFilterChips = [
    selectedCategoryId
      ? { key: "category", label: `Danh mục: ${selectedCategoryLabel}` }
      : null,
    filters.style
      ? { key: "style", label: `Phong cách: ${getStyleLabel(filters.style)}` }
      : null,
    filters.gender
      ? {
        key: "gender",
        label: `Giới tính: ${filters.gender === "male" ? "Nam" : "Nữ"}`,
      }
      : null,
    filters.occasion
      ? { key: "occasion", label: `Dịp sử dụng: ${getOccasionLabel(filters.occasion)}` }
      : null,
    filters.discountOnly && !isSaleContext
      ? { key: "discountOnly", label: "Đang giảm giá" }
      : null,
    filters.minPrice || filters.maxPrice
      ? {
        key: "price",
        label: `Giá: ${filters.minPrice ? formatPrice(filters.minPrice) : "0 đ"} – ${filters.maxPrice ? formatPrice(filters.maxPrice) : "∞"}`,
      }
      : null,
    sortBy !== "newest"
      ? { key: "sort", label: `Sắp xếp: ${sortLabelMap[sortBy]}` }
      : null,
    isNewArrivalsContext ? { key: "newArrivals", label: "Hàng mới" } : null,
    isBestSellerContext ? { key: "bestSeller", label: "Bán chạy" } : null,
    isSaleContext ? { key: "sale", label: "Ưu đãi" } : null,
  ].filter(Boolean);

  const clearSingleChip = (key) => {
    if (key === "category") {
      handleSelectCategory("");
      return;
    }
    if (key === "sort") {
      setSortBy("newest");
      return;
    }
    if (key === "newArrivals") {
      const next = new URLSearchParams(searchParams);
      next.delete("newArrivals");
      setSearchParams(next);
      return;
    }
    if (key === "bestSeller") {
      const next = new URLSearchParams(searchParams);
      next.delete("bestSeller");
      setSearchParams(next);
      setFilters((current) => ({ ...current, soldOnly: false }));
      return;
    }
    if (key === "sale") {
      const next = new URLSearchParams(searchParams);
      next.delete("sale");
      if (next.get("tag") === "uu-dai") next.delete("tag");
      setSearchParams(next);
      setFilters((current) => ({ ...current, discountOnly: false }));
      return;
    }
    if (key === "discountOnly") {
      setFilters((current) => ({ ...current, discountOnly: false }));
      return;
    }
    if (key === "price") {
      setFilters((current) => ({ ...current, minPrice: "", maxPrice: "" }));
      return;
    }
    setFilters((current) => ({ ...current, [key]: "" }));
  };

  const handleWishlist = async (product) => {
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      await apiRequest("/wishlists/me", {
        method: "POST",
        token,
        body: {
          productId: product._id,
          addedFrom: "product_page",
        },
      });
      toast.success(`Đã thêm ${formatProductName(product.name)} vào danh sách yêu thích`);
    } catch (requestError) {
      toast.error(requestError.message);
    }
  };

  const handleQuickAddToggle = (productId, defaultSize) => {
    setQuickAddByProduct((current) => {
      if (current[productId]) {
        const clone = { ...current };
        delete clone[productId];
        return clone;
      }
      return { ...current, [productId]: { size: defaultSize || "" } };
    });
  };

  const handleQuickAddSize = (productId, size) => {
    setQuickAddByProduct((current) => ({ ...current, [productId]: { size } }));
  };

  const handleAddToCart = async (product, variant) => {
    if (!token) {
      navigate("/login");
      return;
    }

    if (!variant?._id) {
      toast.error("Sản phẩm chưa có biến thể phù hợp để thêm vào giỏ hàng.");
      return;
    }

    try {
      await apiRequest("/carts/me/items", {
        method: "POST",
        token,
        body: {
          productId: product._id,
          variantId: variant._id,
          quantity: 1,
          source: "product_page",
        },
      });

      toast.success(`Đã thêm ${formatProductName(product.name)} vào giỏ hàng`);
      setQuickAddByProduct((current) => {
        const clone = { ...current };
        delete clone[product._id];
        return clone;
      });
    } catch (requestError) {
      toast.error(requestError.message);
    }
  };

  const handleSortToggle = () => {
    const currentIndex = sortSequence.indexOf(sortBy);
    const nextValue = sortSequence[(currentIndex + 1) % sortSequence.length];
    setSortBy(nextValue);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, sortBy, selectedCategoryId, isBestSellerContext, isNewArrivalsContext, isSaleContext]);

  const inputClass =
    "w-full appearance-none border border-gray-200 bg-white px-4 py-2.5 text-sm text-black transition-colors focus:border-black focus:outline-none";
  const labelClass =
    "mb-2 block text-[13px] font-semibold text-black";

  return (
    /* Container */
    <div className="bg-[#f6f6f6] pb-16 pt-6">
      <section className="mx-auto w-full max-w-[1400px] px-4 lg:px-8">
        <div className="border border-gray-300 bg-white px-5 py-2">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 text-[15px]">
              <span className="font-semibold text-black">
                {filteredProducts.length} Sản phẩm
              </span>
              <span className="text-gray-400">&gt;</span>
              <Link to="/" className="text-gray-600 hover:text-black">
                Trang chủ
              </Link>
              <span className="text-gray-400">&gt;</span>

              {isSearchContext ? (
                <>
                  <span className="text-gray-600">Tìm kiếm</span>
                  <span className="text-gray-400">&gt;</span>
                  <span className="font-semibold text-black">
                    &ldquo;{searchKeyword}&rdquo;
                  </span>
                </>
              ) : breadcrumbPath.length ? (
                breadcrumbPath.map((item, index) => (
                  <span
                    key={item._id}
                    className="inline-flex items-center gap-3"
                  >
                    {index === breadcrumbPath.length - 1 ? (
                      <span className="font-semibold text-black">
                        {item.name}
                      </span>
                    ) : (
                      <Link
                        to={`/products?category=${item._id}`}
                        className="text-gray-600 hover:text-black"
                      >
                        {item.name}
                      </Link>
                    )}
                    {index !== breadcrumbPath.length - 1 ? (
                      <span className="text-gray-400">&gt;</span>
                    ) : null}
                  </span>
                ))
              ) : (
                <>
                  <span className="text-gray-600">Tất cả sản phẩm</span>
                  {isNewArrivalsContext ? (
                    <>
                      <span className="text-gray-400">&gt;</span>
                      <span className="font-semibold text-black">Sản phẩm mới</span>
                    </>
                  ) : null}
                  {isBestSellerContext ? (
                    <>
                      <span className="text-gray-400">&gt;</span>
                      <span className="font-semibold text-black">Sản phẩm bán chạy</span>
                    </>
                  ) : null}
                  {isSaleContext ? (
                    <>
                      <span className="text-gray-400">&gt;</span>
                      <span className="font-semibold text-black">Sản phẩm ưu đãi</span>
                    </>
                  ) : null}
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className={`grid h-9 w-9 place-items-center border transition ${showFilterPanel
                  ? "border-black bg-black text-white"
                  : "border-gray-300 bg-white text-black"
                  }`}
                onClick={() => setShowFilterPanel((current) => !current)}
                aria-label="Bộ lọc"
              >
                <SlidersHorizontal size={16} />
              </button>

              <button
                type="button"
                onClick={handleSortToggle}
                className="inline-flex h-9 items-center gap-2 border border-gray-300 bg-white px-3 text-xs font-medium text-black transition hover:border-black"
                aria-label="Sắp xếp"
              >
                <SortAsc size={14} />
                <span className="hidden sm:inline">{sortLabelMap[sortBy]}</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`grid h-9 w-9 place-items-center border transition ${viewMode === "grid"
                  ? "border-black bg-black text-white"
                  : "border-gray-300 bg-white text-black"
                  }`}
                aria-label="Chế độ lưới"
              >
                <LayoutGrid size={16} />
              </button>

              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`grid h-9 w-9 place-items-center border transition ${viewMode === "list"
                  ? "border-black bg-black text-white"
                  : "border-gray-300 bg-white text-black"
                  }`}
                aria-label="Chế độ danh sách"
              >
                <List size={16} />
              </button>
            </div>
          </div>
        </div>

        {hasQuickTags && (
          <div className="mt-4 mb-6">
            <div className="flex items-center gap-2">
              <div
                ref={tagsRef}
                className="scrollbar-hide flex-1 overflow-x-auto whitespace-nowrap"
              >
                <div className="inline-flex gap-2">
                  {quickTagBaseId && (
                    <button
                      type="button"
                      onClick={() => handleSelectQuickTag(quickTagBaseId)}
                      className={`border px-5 py-3 text-[15px] font-medium transition ${selectedScopeForTag === quickTagBaseId
                        ? "border-black bg-black text-white"
                        : "border-gray-300 bg-white text-black hover:border-black"
                        }`}
                    >
                      Tất cả
                    </button>
                  )}

                  {quickTagCategories.map((tag) => (
                    <button
                      key={tag._id}
                      type="button"
                      onClick={() => handleSelectQuickTag(tag._id)}
                      className={`border px-5 py-3 text-[15px] font-medium transition ${selectedScopeForTag === tag._id
                        ? "border-black bg-black text-white"
                        : "border-gray-300 bg-white text-black hover:border-black"
                        }`}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {showFilterPanel ? (
          <div className={`mt-2 mb-6 grid grid-cols-1 gap-5 border border-gray-200 bg-white p-5 md:grid-cols-4 ${hasQuickTags ? "mt-2" : "mt-4"
            }`}>

            <label className="block min-w-0">
              <span className={labelClass}>Phong cách</span>
              <select
                className={`${inputClass} w-full`}
                value={filters.style}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    style: event.target.value,
                  }))
                }
              >
                <option value="">Tất cả</option>
                {filterOptions.styles.map((item) => (
                  <option key={item} value={item}>
                    {getStyleLabel(item)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block min-w-0">
              <span className={labelClass}>Dịp sử dụng</span>
              <select
                className={`${inputClass} w-full`}
                value={filters.occasion}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    occasion: event.target.value,
                  }))
                }
              >
                <option value="">Tất cả</option>
                {filterOptions.occasions.map((item) => (
                  <option key={item} value={item}>
                    {getOccasionLabel(item)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block min-w-0">
              <span className={labelClass}>Danh mục</span>
              <select
                className={`${inputClass} w-full`}
                value={selectedCategoryId}
                onChange={(event) => handleSelectCategory(event.target.value)}
              >
                <option value="">Tất cả danh mục</option>
                {categoryLevel1.map((cat) => [
                  <option key={cat._id} value={cat._id} className="font-semibold text-black">{cat.name}</option>,
                  ...categories.filter(c => getParentId(c) === cat._id).map(sub => [
                    <option key={sub._id} value={sub._id}>{sub.name}</option>,
                    ...categories.filter(c2 => getParentId(c2) === sub._id).map(sub2 => (
                      <option key={sub2._id} value={sub2._id}>{sub2.name}</option>
                    ))
                  ])
                ])}
              </select>
            </label>

            {!isMaleOrFemaleCategory && (
              <label className="block min-w-0">
                <span className={labelClass}>Giới tính</span>
                <select
                  className={`${inputClass} w-full`}
                  value={filters.gender}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      gender: event.target.value,
                    }))
                  }
                >
                  <option value="">Tất cả</option>
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                </select>
              </label>
            )}

            <div className="block min-w-0">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <span className={labelClass}>Giá từ</span>
                  <input
                    type="number"
                    min="0"
                    className={`${inputClass} w-full px-3`}
                    placeholder="0"
                    value={filters.minPrice}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        minPrice: event.target.value,
                      }))
                    }
                  />
                </div>
                <span className="pb-2.5 text-gray-400">–</span>
                <div className="flex-1">
                  <span className={labelClass}>Giá đến</span>
                  <input
                    type="number"
                    min="0"
                    className={`${inputClass} w-full px-3`}
                    placeholder="∞"
                    value={filters.maxPrice}
                    onChange={(event) =>
                      setFilters((current) => ({
                        ...current,
                        maxPrice: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            <label className="block min-w-0">
              <span className={labelClass}>Khuyến mãi</span>
              <select
                className={`${inputClass} w-full`}
                value={filters.discountOnly ? "true" : "false"}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    discountOnly: event.target.value === "true",
                  }))
                }
              >
                <option value="false">Tất cả sản phẩm</option>
                <option value="true">Đang giảm giá</option>
              </select>
            </label>

            <div className="flex items-end justify-end md:col-start-4">
              <button
                type="button"
                className="border border-black px-4 py-2 text-[13px] font-bold transition hover:bg-black hover:text-white"
                onClick={() => {
                  if (hasClearableFilters) {
                    clearFiltersKeepCategory();
                  } else {
                    setShowFilterPanel(false);
                  }
                }}
              >
                {hasClearableFilters ? "Xóa bộ lọc" : "Đóng bộ lọc"}
              </button>
            </div>
          </div>
        ) : null}
        {useNewAllProductsLayout && activeFilterChips.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {activeFilterChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => clearSingleChip(chip.key)}
                className="inline-flex items-center gap-1 border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-black hover:border-black"
              >
                {chip.label}
                <X size={12} />
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-6">
          <div>
            <div className="mb-3 lg:hidden">
              <button
                type="button"
                onClick={() => setShowMobileCategoryPanel((prev) => !prev)}
                className="inline-flex items-center gap-2 border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-black"
              >
                Danh mục
                <ChevronDown size={16} />
              </button>
            </div>

            {showMobileCategoryPanel && (
              <div className="mb-4 border border-gray-200 bg-white p-3 lg:hidden">
                <div className="grid gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectCategory("")}
                    className="border border-gray-300 px-3 py-2 text-left text-sm"
                  >
                    Tất cả sản phẩm
                  </button>
                  {[
                    ...categoryLevel1,
                    ...categoryLevel2,
                    ...categoryLevel3,
                  ].map((cat) => (
                    <button
                      key={cat._id}
                      type="button"
                      onClick={() => handleSelectCategory(cat._id)}
                      className={`px-3 py-2 text-left text-sm border ${selectedCategoryId === cat._id ? "border-black bg-black text-white" : "border-gray-300 bg-white"}`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {paginatedProducts.length === 0 ? (
              <div className="border border-gray-200 bg-white py-24 text-center">
                <h3 className="mb-2 text-lg font-semibold text-black">
                  Không tìm thấy sản phẩm
                </h3>
                <p className="text-sm text-gray-500">
                  Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm của bạn.
                </p>
              </div>
            ) : (
              <div
                className={
                  viewMode === "list"
                    ? "grid grid-cols-1 gap-4"
                    : "grid grid-cols-2 gap-[1px] bg-gray-200 md:grid-cols-3 xl:grid-cols-4"
                }
              >
                {paginatedProducts.map((product) => {
                  const colorGroups = getColorGroups(product);
                  const activeColorName =
                    activeSwatchByProduct[product._id] || colorGroups[0]?.color;
                  const activeColorGroup =
                    colorGroups.find(
                      (group) => group.color === activeColorName,
                    ) || colorGroups[0];
                  const productImageUrls = getProductImageUrls(product);
                  const primaryImage =
                    activeColorGroup?.previewImage ||
                    productImageUrls[0] ||
                    FALLBACK_PRODUCT_IMAGE;
                  const secondaryImage =
                    findFirstDistinctImage(
                      [
                        ...getProductGalleryImageUrls(product, activeColorGroup?.color),
                        ...productImageUrls,
                        ...(activeColorGroup?.variants || []).map((item) => item.image),
                      ],
                      primaryImage,
                    ) ||
                    primaryImage;

                  const sizes = sortSizes([
                    ...new Set(
                      (activeColorGroup?.variants || [])
                        .map((item) => item.size)
                        .filter(Boolean),
                    ),
                  ]);
                  const quickAdd = quickAddByProduct[product._id];
                  const selectedSize = quickAdd?.size || sizes[0] || "";
                  const selectedVariant =
                    (activeColorGroup?.variants || []).find(
                      (item) => item.size === selectedSize,
                    ) ||
                    activeColorGroup?.variants?.[0] ||
                    null;
                  const displayName = formatProductName(product.name);
                  const basePrice = Number(product.price || 0);
                  const priceAdjustment = Number(
                    selectedVariant?.priceAdjustment || 0,
                  );
                  const priceBeforeDiscount = basePrice + priceAdjustment;
                  const productDiscount = product.discount || 0;
                  const variantDiscount = selectedVariant?.discount;
                  const effectiveDiscount =
                    variantDiscount !== null && variantDiscount !== undefined
                      ? variantDiscount
                      : productDiscount;
                  const displayPrice =
                    effectiveDiscount > 0
                      ? Math.round(
                        priceBeforeDiscount * (1 - effectiveDiscount / 100),
                      )
                      : priceBeforeDiscount;

                  return (
                    <article
                      key={product._id}
                      className={`group bg-white ${viewMode === "list" ? "grid grid-cols-1 gap-4 border border-gray-200 p-4 md:grid-cols-[220px_minmax(0,1fr)_300px] md:items-center" : ""}`}
                    >
                      <div className="relative overflow-hidden bg-gray-100 border-t border-gray-200">
                        <Link
                          to={getProductPath(product, {
                            color: activeColorName,
                          })}
                          className="absolute inset-0 block"
                        >
                          <img
                            src={primaryImage}
                            alt={displayName}
                            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300 group-hover:opacity-0"
                            onError={(e) => { e.target.onerror = null; e.target.src = FALLBACK_PRODUCT_IMAGE; }}
                          />
                          <img
                            src={secondaryImage}
                            alt={displayName}
                            className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                            onError={(e) => { e.target.onerror = null; e.target.src = FALLBACK_PRODUCT_IMAGE; }}
                          />
                        </Link>

                        <div
                          className={`${viewMode === "list" ? "aspect-[4/5]" : "aspect-[4/5]"}`}
                        />

                        {viewMode !== "list" ? (
                          <>
                            <div className="absolute inset-x-0 bottom-0 border-t border-gray-200 bg-white/95 px-3 py-2 backdrop-blur-[1px]">
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  {productCollectionMap.get(product._id) ? (
                                    <p className="line-clamp-1 text-[12px] font-bold uppercase text-red-600">
                                      {productCollectionMap.get(product._id)}
                                    </p>
                                  ) : (
                                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400"></p>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleQuickAddToggle(product._id, sizes[0])
                                  }
                                  className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-bold uppercase transition ${quickAdd ? "border-black bg-black text-white" : "border-gray-300 bg-white text-black hover:border-black"}`}
                                  aria-label="Thêm nhanh vào giỏ"
                                >
                                  {quickAdd ? <X size={13} /> : <Plus size={13} />}
                                  {quickAdd ? "Đóng" : "Thêm"}
                                </button>
                              </div>
                            </div>

                            {quickAdd ? (
                              <div className="absolute bottom-14 right-2 z-10 w-50 border border-gray-200 bg-white p-3 shadow-xl">
                                <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-500">
                                  Chọn size
                                </p>
                                <div className="mb-3 flex flex-wrap gap-2">
                                  {(sizes.length ? sizes : ["M"]).map((size) => {
                                    const variantForSize =
                                      (activeColorGroup?.variants || []).find((item) => item.size === size) || null;
                                    const isOutOfStock = Number(variantForSize?.stock || 0) <= 0;

                                    return (
                                      <button
                                        key={size}
                                        type="button"
                                        onClick={() => !isOutOfStock && handleQuickAddSize(product._id, size)}
                                        disabled={isOutOfStock}
                                        className={`relative h-8 w-8 border text-xs font-medium transition ${isOutOfStock
                                          ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                                          : selectedSize === size
                                            ? "border-black bg-black text-white"
                                            : "border-gray-300 bg-white text-black hover:border-black"
                                          }`}
                                      >
                                        {size}
                                        {isOutOfStock ? (
                                          <span className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
                                            <span className="h-[1px] w-[140%] -rotate-45 bg-gray-400" />
                                          </span>
                                        ) : null}
                                      </button>
                                    );
                                  })}
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleAddToCart(product, selectedVariant)
                                  }
                                  disabled={!selectedVariant || Number(selectedVariant?.stock || 0) <= 0}
                                  className="w-full bg-black py-2 px-2 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {Number(selectedVariant?.stock || 0) <= 0 ? "Hết hàng" : "Thêm giỏ hàng"}
                                </button>
                              </div>
                            ) : null}
                          </>
                        ) : null}
                      </div>

                      <div
                        className={`${viewMode === "list" ? "pt-2 md:pt-0" : "px-3 py-3"} bg-white`}
                      >
                        {viewMode === "list" && productCollectionMap.get(product._id) ? (
                          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-red-600">
                            {productCollectionMap.get(product._id)}
                          </p>
                        ) : null}

                        <h2 className="text-[16px] font-semibold leading-tight text-black md:text-[17px]">
                          <Link
                            to={getProductPath(product, {
                              color: activeColorName,
                            })}
                            className="hover:text-red-600"
                          >
                            {displayName}
                          </Link>
                        </h2>

                        <div className="mt-3 flex items-center gap-2">
                          {colorGroups.slice(0, 6).map((group) => (
                            <button
                              key={`${product._id}-${group.color}`}
                              type="button"
                              title={group.color}
                              onMouseEnter={() =>
                                setActiveSwatchByProduct((current) => ({
                                  ...current,
                                  [product._id]: group.color,
                                }))
                              }
                              onClick={() =>
                                setActiveSwatchByProduct((current) => ({
                                  ...current,
                                  [product._id]: group.color,
                                }))
                              }
                              className={`relative overflow-hidden w-8 h-10 border transition-all p-0 m-0 bg-white ${activeColorName === group.color
                                ? "border-black"
                                : "border-gray-200 opacity-70 hover:opacity-100"
                                }`}
                            >
                              {group.previewImage ? (
                                <img
                                  src={group.previewImage}
                                  alt={group.color}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-[8px] font-bold uppercase tracking-widest text-center flex items-center justify-center h-full w-full leading-tight px-0.5">
                                  {group.color}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>

                        {viewMode !== "list" ? (
                          <div className="mt-3 flex items-start justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <p className="m-0 text-[16px] font-semibold text-black">
                                {formatPrice(displayPrice)}
                              </p>
                              {effectiveDiscount > 0 ? (
                                <>
                                  <p className="m-0 text-[16px] font-normal text-gray-400 line-through decoration-gray-400 decoration-[1px]">
                                    {formatPrice(priceBeforeDiscount)}
                                  </p>
                                  <span
                                    className="inline-flex items-center bg-red-600 py-0.5 pl-2 pr-1.5 text-[12px] font-bold leading-none text-white"
                                    style={{
                                      clipPath:
                                        "polygon(18% 0%, 100% 0%, 100% 100%, 6px 100%, 0% 50%)",
                                    }}
                                  >
                                    -{effectiveDiscount}%
                                  </span>
                                </>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleWishlist(product)}
                              className={`inline-flex items-center gap-1.5 text-xs font-medium transition text-red-600 hover:text-red-400`}
                            >
                              <Heart
                                size={13}
                                className={
                                  wishlistProductIds.has(product._id)
                                    ? "fill-red-600 text-red-600"
                                    : "text-current"
                                }
                              />
                              Yêu thích
                            </button>
                          </div>
                        ) : (
                          <div className="mt-3 text-sm text-gray-500">
                            {activeColorName} {selectedVariant?.size ? `• Size ${selectedVariant.size}` : ""}
                          </div>
                        )}
                      </div>

                      {viewMode === "list" ? (
                        <div className="border-t border-gray-200 pt-3 md:border-t-0 md:border-l md:border-gray-200 md:pl-4 md:pt-0">
                          <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
                            <p className="m-0 text-right text-xl font-bold text-black md:text-2xl">
                              {formatPrice(displayPrice)}
                            </p>
                            {effectiveDiscount > 0 ? (
                              <>
                                <p className="m-0 text-right text-base font-normal text-gray-400 line-through decoration-gray-400 decoration-[1px]">
                                  {formatPrice(priceBeforeDiscount)}
                                </p>
                                <span
                                  className="inline-flex items-center bg-red-600 py-0.5 pl-2 pr-1.5 text-[12px] font-bold leading-none text-white"
                                  style={{
                                    clipPath:
                                      "polygon(18% 0%, 100% 0%, 100% 100%, 6px 100%, 0% 50%)",
                                  }}
                                >
                                  -{effectiveDiscount}%
                                </span>
                              </>
                            ) : null}
                          </div>

                          <div className="mt-3 flex justify-end">
                            <button
                              type="button"
                              onClick={() => toggleWishlist(product)}
                              className={`inline-flex items-center gap-1.5 text-xs font-medium transition ${wishlistProductIds.has(product._id) ? "text-red-600" : "text-gray-500 hover:text-red-600"}`}
                            >
                              <Heart
                                size={13}
                                className={
                                  wishlistProductIds.has(product._id)
                                    ? "fill-red-600 text-red-600"
                                    : "text-current"
                                }
                              />
                              Yêu thích
                            </button>
                          </div>

                          <div className="mt-4">
                            <p className="mb-2 text-right text-[11px] font-semibold uppercase text-gray-500">Chọn size nhanh</p>
                            <div className="mb-3 flex flex-wrap justify-end gap-2">
                              {(sizes.length ? sizes : ["M"]).map((size) => {
                                const variantForSize =
                                  (activeColorGroup?.variants || []).find((item) => item.size === size) || null;
                                const isOutOfStock = Number(variantForSize?.stock || 0) <= 0;

                                return (
                                  <button
                                    key={size}
                                    type="button"
                                    onClick={() => !isOutOfStock && handleQuickAddSize(product._id, size)}
                                    disabled={isOutOfStock}
                                    className={`relative h-8 min-w-[36px] border px-2 text-xs font-medium transition ${isOutOfStock
                                      ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                                      : selectedSize === size
                                        ? "border-black bg-black text-white"
                                        : "border-gray-300 bg-white text-black hover:border-black"
                                      }`}
                                  >
                                    {size}
                                    {isOutOfStock ? (
                                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
                                        <span className="h-[1px] w-[140%] -rotate-45 bg-gray-400" />
                                      </span>
                                    ) : null}
                                  </button>
                                );
                              })}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleAddToCart(product, selectedVariant)}
                              disabled={!selectedVariant || Number(selectedVariant?.stock || 0) <= 0}
                              className="w-full border border-black bg-black py-2.5 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {Number(selectedVariant?.stock || 0) <= 0 ? "Hết hàng" : "Thêm vào giỏ hàng"}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}

            {filteredProducts.length > PAGE_SIZE ? (
              <div className="mt-4 flex items-center justify-center border-t border-gray-200 px-5 py-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={normalizedCurrentPage === 1}
                    className="flex items-center justify-center rounded bg-white p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-200"
                  >
                    <ChevronsLeft size={18} />
                  </button>

                  <div className="flex items-center gap-1">
                    {getPaginationRange(normalizedCurrentPage, totalPages).map((p) => {
                      if (p === "left-ellipsis" || p === "right-ellipsis") {
                        return (
                          <span key={`ellipsis-${p}`} className="px-1 text-gray-400">...</span>
                        );
                      }
                      return (
                        <button
                          key={p}
                          onClick={() => setCurrentPage(p)}
                          className={`h-9 w-9 rounded-lg text-sm font-semibold transition ${normalizedCurrentPage === p
                            ? "bg-black text-white"
                            : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                            }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={normalizedCurrentPage === totalPages}
                    className="flex items-center justify-center rounded bg-white p-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-200"
                  >
                    <ChevronsRight size={18} />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
