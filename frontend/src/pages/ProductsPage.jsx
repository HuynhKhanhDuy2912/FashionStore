import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PageHeader from "../components/PageHeader.jsx";
import ProductCard from "../components/ProductCard.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { apiRequest } from "../lib/api.js";
import {
  attachVariantsToProducts,
  buildCatalogFilters,
  filterProducts
} from "../lib/catalog.js";

export default function ProductsPage() {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [variants, setVariants] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    search: searchParams.get("search") || "",
    style: "",
    gender: "",
    occasion: ""
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [productResponse, variantResponse] = await Promise.all([
          apiRequest("/products"),
          apiRequest("/product-variants")
        ]);

        setProducts(productResponse.data);
        setVariants(variantResponse.data);
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
  const filteredProducts = useMemo(
    () => filterProducts(productsWithVariants, filters),
    [productsWithVariants, filters]
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

      setMessage(`Added ${product.name} to wishlist`);
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

      setMessage(`Added ${product.name} to cart`);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <section>
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">New arrival edit</span>
          <h2>Modern wardrobe essentials with a personalized shopping flow</h2>
          <p>
            Browse products, save favorites, add variants to cart, and let the backend
            recommendation engine adapt to each user interaction.
          </p>
        </div>
        <div className="hero-metrics">
          <div className="metric-card">
            <span>{products.length}</span>
            <p>Seeded products available</p>
          </div>
          <div className="metric-card">
            <span>{variants.length}</span>
            <p>Variants ready for cart and checkout</p>
          </div>
        </div>
      </section>

      <PageHeader
        title="Products"
        description="A clean storefront inspired by contemporary Vietnamese fashion e-commerce."
        aside={<span className="muted">{filteredProducts.length} products</span>}
      />
      {message ? <p className="success-text">{message}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      <section className="catalog-layout">
        <aside className="catalog-sidebar card">
          <div className="sidebar-section">
            <h3>Search</h3>
            <input
              placeholder="Search products..."
              value={filters.search}
              onChange={(event) =>
                setFilters((current) => ({ ...current, search: event.target.value }))
              }
            />
          </div>
          <div className="sidebar-section">
            <h3>Style</h3>
            <select
              value={filters.style}
              onChange={(event) =>
                setFilters((current) => ({ ...current, style: event.target.value }))
              }
            >
              <option value="">All styles</option>
              {filterOptions.styles.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="sidebar-section">
            <h3>Gender</h3>
            <select
              value={filters.gender}
              onChange={(event) =>
                setFilters((current) => ({ ...current, gender: event.target.value }))
              }
            >
              <option value="">All</option>
              {filterOptions.genders.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="sidebar-section">
            <h3>Occasion</h3>
            <select
              value={filters.occasion}
              onChange={(event) =>
                setFilters((current) => ({ ...current, occasion: event.target.value }))
              }
            >
              <option value="">All occasions</option>
              {filterOptions.occasions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <button
            className="secondary-button"
            onClick={() =>
              setFilters({
                search: "",
                style: "",
                gender: "",
                occasion: ""
              })
            }
          >
            Clear filters
          </button>
        </aside>

        <div className="catalog-main">
          <div className="catalog-toolbar">
            <p className="muted">
              Curated essentials, smart casual layers, and data-connected shopping actions
            </p>
            <Link className="text-link" to="/recommendations">
              Personalized picks
            </Link>
          </div>
          <div className="grid">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product._id}
                product={product}
                onAddToWishlist={token ? handleWishlist : null}
                onAddToCart={token ? handleAddToCart : null}
              />
            ))}
          </div>
        </div>
      </section>
    </section>
  );
}
