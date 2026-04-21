import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import ProductCard from "../components/ProductCard.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { apiRequest } from "../lib/api.js";
import { attachVariantsToProducts } from "../lib/catalog.js";

const editCards = [
  {
    title: "Menswear",
    copy: "Relaxed tailoring, muted tones, and versatile wardrobe staples.",
    tone: "sand"
  },
  {
    title: "Womenswear",
    copy: "Soft silhouettes, smart casual layers, and elevated daily wear.",
    tone: "stone"
  },
  {
    title: "Collections",
    copy: "Browse curated outfits and personalized picks from your behavior data.",
    tone: "ink"
  }
];

export default function HomePage() {
  const { token } = useAuth();
  const [products, setProducts] = useState([]);
  const [variants, setVariants] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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

  const productsWithVariants = useMemo(
    () => attachVariantsToProducts(products, variants),
    [products, variants]
  );

  const newArrivals = useMemo(
    () =>
      [...productsWithVariants]
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
        .slice(0, 4),
    [productsWithVariants]
  );

  const bestSellers = useMemo(
    () =>
      [...productsWithVariants]
        .sort((left, right) => (right.totalReviews || 0) - (left.totalReviews || 0))
        .slice(0, 4),
    [productsWithVariants]
  );

  const menswear = useMemo(
    () => productsWithVariants.filter((item) => item.gender === "male" || item.gender === "unisex").slice(0, 4),
    [productsWithVariants]
  );

  const womenswear = useMemo(
    () => productsWithVariants.filter((item) => item.gender === "female" || item.gender === "unisex").slice(0, 4),
    [productsWithVariants]
  );

  const handleWishlist = async (product, addedFrom = "home") => {
    try {
      await apiRequest("/wishlists/me", {
        method: "POST",
        token,
        body: {
          productId: product._id,
          addedFrom
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
          source: "home"
        }
      });

      setMessage(`Added ${product.name} to cart`);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <section className="home-page">
      <section className="landing-hero">
        <div className="landing-copy">
          <span className="eyebrow">Spring summer 2026</span>
          <h2>Dress better with a storefront that adapts to each user journey</h2>
          <p>
            Explore a modern fashion shopping experience inspired by Routine, powered by
            your own backend for authentication, behavior tracking, wishlist, cart,
            checkout, and personalized recommendations.
          </p>
          <div className="landing-actions">
            <Link className="primary-link" to="/products">
              Shop the catalog
            </Link>
            <Link className="text-link" to="/recommendations">
              View recommendations
            </Link>
          </div>
        </div>
        <div className="landing-visual">
          <div className="visual-panel large">
            <img
              src="https://placehold.co/720x900/e7ddd1/5f4d3b?text=New+Season"
              alt="Collection visual"
            />
          </div>
          <div className="visual-panel stacked">
            <img
              src="https://placehold.co/380x430/ded4c9/6f5b48?text=Menswear"
              alt="Menswear"
            />
            <img
              src="https://placehold.co/380x430/f0e8df/6f5b48?text=Womenswear"
              alt="Womenswear"
            />
          </div>
        </div>
      </section>

      <section className="edit-grid">
        {editCards.map((item) => (
          <article key={item.title} className={`edit-card tone-${item.tone}`}>
            <span className="eyebrow">Editorial edit</span>
            <h3>{item.title}</h3>
            <p>{item.copy}</p>
            <Link to="/products">Explore now</Link>
          </article>
        ))}
      </section>

      {message ? <p className="success-text">{message}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}

      <section className="merch-block">
        <div className="merch-header">
          <div>
            <span className="eyebrow">Merchandising</span>
            <h2>New arrivals</h2>
          </div>
          <Link className="text-link" to="/products">
            Shop all
          </Link>
        </div>
        <div className="grid">
          {newArrivals.map((product) => (
            <ProductCard
              key={product._id}
              product={product}
              onAddToWishlist={token ? (item) => handleWishlist(item, "home") : null}
              onAddToCart={token ? handleAddToCart : null}
            />
          ))}
        </div>
      </section>

      <section className="dual-feature">
        <article className="feature-banner dark">
          <span className="eyebrow">For him</span>
          <h3>Relaxed tailoring and essential layers</h3>
          <p>Everyday menswear pieces with a clean street-to-smart balance.</p>
          <Link to="/products">Discover menswear</Link>
        </article>
        <article className="feature-banner light">
          <span className="eyebrow">For her</span>
          <h3>Soft structure, elegant motion, modern silhouettes</h3>
          <p>Wardrobe updates that work from office dressing to city evenings.</p>
          <Link to="/products">Discover womenswear</Link>
        </article>
      </section>

      <section className="merch-block">
        <div className="merch-header">
          <div>
            <span className="eyebrow">Popular now</span>
            <h2>Best sellers</h2>
          </div>
          <Link className="text-link" to="/recommendations">
            View personalized picks
          </Link>
        </div>
        <div className="grid">
          {bestSellers.map((product) => (
            <ProductCard
              key={product._id}
              product={product}
              onAddToWishlist={token ? (item) => handleWishlist(item, "home") : null}
              onAddToCart={token ? handleAddToCart : null}
            />
          ))}
        </div>
      </section>

      <section className="gender-sections">
        <div className="merch-column">
          <div className="merch-header">
            <div>
              <span className="eyebrow">Menswear edit</span>
              <h2>For him</h2>
            </div>
          </div>
          <div className="grid compact-grid">
            {menswear.map((product) => (
              <ProductCard
                key={product._id}
                product={product}
                onAddToWishlist={token ? (item) => handleWishlist(item, "home") : null}
                onAddToCart={token ? handleAddToCart : null}
              />
            ))}
          </div>
        </div>
        <div className="merch-column">
          <div className="merch-header">
            <div>
              <span className="eyebrow">Womenswear edit</span>
              <h2>For her</h2>
            </div>
          </div>
          <div className="grid compact-grid">
            {womenswear.map((product) => (
              <ProductCard
                key={product._id}
                product={product}
                onAddToWishlist={token ? (item) => handleWishlist(item, "home") : null}
                onAddToCart={token ? handleAddToCart : null}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="feature-strip">
        <div>
          <span>Behavior tracking</span>
          <p>Every wishlist, cart, and recommendation interaction can feed your backend.</p>
        </div>
        <div>
          <span>Personalized catalog</span>
          <p>Users get product suggestions based on profile, search, and history.</p>
        </div>
        <div>
          <span>Checkout ready</span>
          <p>From product browsing to order creation, the storefront uses your API flow.</p>
        </div>
      </section>
    </section>
  );
}
