import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PageHeader from "../components/PageHeader.jsx";
import ProductCard from "../components/ProductCard.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { apiRequest } from "../lib/api.js";
import { attachVariantsToProducts, buildCatalogFilters, filterProducts } from "../lib/catalog.js";

function getDirectParentId(category) {
  if (!category?.parentId) {
    return null;
  }

  return typeof category.parentId === "string" ? category.parentId : category.parentId._id || null;
}

function getProductCategoryId(product) {
  if (!product?.categoryId) {
    return null;
  }

  return typeof product.categoryId === "string" ? product.categoryId : product.categoryId._id || null;
}

function collectCategoryScope(categories, rootCategoryId) {
  if (!rootCategoryId) {
    return new Set();
  }

  const scope = new Set([rootCategoryId]);
  let changed = true;

  while (changed) {
    changed = false;
    categories.forEach((category) => {
      const categoryId = category._id;
      const parentId = getDirectParentId(category);

      if (!scope.has(categoryId) && parentId && scope.has(parentId)) {
        scope.add(categoryId);
        changed = true;
      }
    });
  }

  return scope;
}

export default function ProductsPage() {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [variants, setVariants] = useState([]);
  const [categories, setCategories] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    search: searchParams.get("search") || "",
    style: "",
    gender: "",
    occasion: ""
  });

  const selectedCategoryId = searchParams.get("categoryId") || "";

  useEffect(() => {
    const loadData = async () => {
      try {
        const [productResponse, variantResponse, categoryResponse] = await Promise.all([
          apiRequest("/products?limit=500"),
          apiRequest("/product-variants?limit=500"),
          apiRequest("/categories?limit=500")
        ]);

        setProducts(productResponse.data || []);
        setVariants(variantResponse.data || []);
        setCategories(categoryResponse.data || []);
      } catch (loadError) {
        setError(loadError.message);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    setFilters((current) => ({
      ...current,
      search: searchParams.get("search") || ""
    }));
  }, [searchParams]);

  const productsWithVariants = useMemo(
    () => attachVariantsToProducts(products, variants),
    [products, variants]
  );

  const filterOptions = useMemo(
    () => buildCatalogFilters(productsWithVariants),
    [productsWithVariants]
  );

  const categoryScope = useMemo(
    () => collectCategoryScope(categories, selectedCategoryId),
    [categories, selectedCategoryId]
  );

  const filteredProducts = useMemo(() => {
    const byPanelFilters = filterProducts(productsWithVariants, filters);

    if (!selectedCategoryId) {
      return byPanelFilters;
    }

    return byPanelFilters.filter((product) => categoryScope.has(getProductCategoryId(product)));
  }, [productsWithVariants, filters, selectedCategoryId, categoryScope]);

  const selectedCategory = useMemo(
    () => categories.find((category) => category._id === selectedCategoryId) || null,
    [categories, selectedCategoryId]
  );

  const handleWishlist = async (product) => {
    try {
      await apiRequest("/wishlists/me", {
        method: "POST",
        token,
        body: {
          productId: product._id,
          addedFrom: "product_page"
        }
      });

      setMessage(`Đã thêm ${product.name} vào danh sách yêu thích`);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const handleAddToCart = async (product, variant) => {
    try {
      await apiRequest("/carts/me/items", {
        method: "POST",
        token,
        body: {
          productId: product._id,
          variantId: variant._id,
          quantity: 1,
          source: "product_page"
        }
      });

      setMessage(`Đã thêm ${product.name} vào giỏ hàng`);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const inputClass =
    "w-full appearance-none border border-gray-200 bg-white px-4 py-2.5 text-sm text-black transition-colors focus:border-black focus:outline-none";
  const labelClass = "mb-2 block text-xs font-bold uppercase tracking-widest text-black";

  return (
    <div className="flex flex-col pb-16">
      <div className="mt-8 px-4 md:px-0">
        <PageHeader
          title={selectedCategory ? selectedCategory.name.toUpperCase() : "TẤT CẢ SẢN PHẨM"}
          description={
            selectedCategory
              ? `Đang hiển thị sản phẩm thuộc danh mục "${selectedCategory.name}" và các danh mục con.`
              : "Khám phá bộ sưu tập thời trang hiện đại với thiết kế tối giản."
          }
          aside={
            <span className="border border-black px-4 py-2 text-xs font-bold uppercase tracking-widest text-black">
              {filteredProducts.length} SẢN PHẨM
            </span>
          }
        />

        {message ? (
          <p className="mb-6 border-l-4 border-black bg-gray-100 px-6 py-4 font-medium text-black">{message}</p>
        ) : null}
        {error ? (
          <p className="mb-6 border-l-4 border-red-600 bg-red-50 px-6 py-4 font-medium text-red-600">{error}</p>
        ) : null}

        <div className="flex items-start gap-8 lg:flex-row flex-col">
          <aside className="sticky top-24 w-full shrink-0 bg-white lg:w-64">
            <div className="mb-6 border-b border-gray-200 pb-6">
              <label className={labelClass}>TÌM KIẾM</label>
              <div className="relative border-b border-gray-300 focus-within:border-black">
                <input
                  className="w-full bg-transparent py-2 pl-2 pr-8 text-sm outline-none"
                  placeholder="Nhập từ khóa..."
                  value={filters.search}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, search: event.target.value }))
                  }
                />
                <svg
                  className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-black"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>

            <div className="mb-8 space-y-6">
              <div>
                <label className={labelClass}>KIỂU DÁNG</label>
                <div className="relative">
                  <select
                    className={inputClass}
                    value={filters.style}
                    onChange={(event) =>
                      setFilters((current) => ({ ...current, style: event.target.value }))
                    }
                  >
                    <option value="">Tất cả kiểu dáng</option>
                    {filterOptions.styles.map((item) => (
                      <option key={item} value={item} className="capitalize">
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>GIỚI TÍNH</label>
                <div className="relative">
                  <select
                    className={inputClass}
                    value={filters.gender}
                    onChange={(event) =>
                      setFilters((current) => ({ ...current, gender: event.target.value }))
                    }
                  >
                    <option value="">Tất cả giới tính</option>
                    {filterOptions.genders.map((item) => (
                      <option key={item} value={item} className="capitalize">
                        {item === "male" ? "Nam" : item === "female" ? "Nữ" : "Unisex"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>DỊP SỬ DỤNG</label>
                <div className="relative">
                  <select
                    className={inputClass}
                    value={filters.occasion}
                    onChange={(event) =>
                      setFilters((current) => ({ ...current, occasion: event.target.value }))
                    }
                  >
                    <option value="">Tất cả dịp sử dụng</option>
                    {filterOptions.occasions.map((item) => (
                      <option key={item} value={item} className="capitalize">
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <button
              className="w-full cursor-pointer border border-black bg-transparent px-4 py-3 text-xs font-bold uppercase tracking-widest text-black transition-colors hover:bg-black hover:text-white"
              onClick={() =>
                setFilters({
                  search: "",
                  style: "",
                  gender: "",
                  occasion: ""
                })
              }
            >
              XÓA BỘ LỌC
            </button>
          </aside>

          <div className="min-w-0 flex-1">
            <div className="mb-6 flex justify-end">
              <Link
                className="border-b border-black pb-1 text-xs font-bold uppercase tracking-widest text-black transition-colors hover:text-gray-500"
                to="/recommendations"
              >
                GỢI Ý CHO BẠN
              </Link>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="border border-gray-200 bg-gray-50 py-32 text-center">
                <h3 className="mb-2 text-lg font-bold uppercase tracking-widest text-black">
                  Không tìm thấy sản phẩm
                </h3>
                <p className="text-sm text-gray-500">Thử điều chỉnh bộ lọc hoặc từ khóa tìm kiếm của bạn.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 gap-y-10 md:grid-cols-3 xl:grid-cols-4">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product._id}
                    product={product}
                    onAddToWishlist={token ? handleWishlist : null}
                    onAddToCart={token ? handleAddToCart : null}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
