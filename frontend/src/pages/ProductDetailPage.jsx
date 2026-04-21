import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ProductCard from "../components/ProductCard.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { apiRequest } from "../lib/api.js";
import { attachVariantsToProducts } from "../lib/catalog.js";

export default function ProductDetailPage() {
  const { productId } = useParams();
  const { token } = useAuth();
  const [product, setProduct] = useState(null);
  const [allProducts, setAllProducts] = useState([]);
  const [allVariants, setAllVariants] = useState([]);
  const [variants, setVariants] = useState([]);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [selectedImage, setSelectedImage] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const loadProduct = async () => {
      try {
        const [productResponse, productsResponse, variantResponse] = await Promise.all([
          apiRequest(`/products/${productId}`),
          apiRequest("/products"),
          apiRequest("/product-variants")
        ]);

        const currentProduct = productResponse.data;
        const allCatalogProducts = productsResponse.data;
        const currentVariants = variantResponse.data.filter(
          (variant) => variant.productId?._id === currentProduct._id
        );

        setProduct(currentProduct);
        setAllProducts(allCatalogProducts);
        setAllVariants(variantResponse.data);
        setVariants(currentVariants);
        setSelectedVariantId(currentVariants[0]?._id || "");
        setSelectedImage(
          currentVariants[0]?.image ||
            currentProduct.images?.[0] ||
            "https://placehold.co/720x900/f1e8db/6e5b49?text=Product+Detail"
        );
      } catch (loadError) {
        setError(loadError.message);
      }
    };

    loadProduct();
  }, [productId]);

  const selectedVariant = useMemo(
    () => variants.find((variant) => variant._id === selectedVariantId) || variants[0],
    [selectedVariantId, variants]
  );

  useEffect(() => {
    if (selectedVariant?.image) {
      setSelectedImage(selectedVariant.image);
    }
  }, [selectedVariant]);

  const currentImage =
    selectedImage ||
    selectedVariant?.image ||
    product?.images?.[0] ||
    "https://placehold.co/720x900/f1e8db/6e5b49?text=Product+Detail";

  const galleryImages = useMemo(() => {
    const variantImages = variants.map((variant) => variant.image).filter(Boolean);
    const productImages = product?.images || [];

    return [...new Set([currentImage, ...variantImages, ...productImages])];
  }, [currentImage, product?.images, variants]);

  const relatedProducts = useMemo(() => {
    const sameStyle = allProducts.filter(
      (item) =>
        item._id !== productId &&
        product &&
        (item.style === product.style ||
          item.gender === product.gender ||
          item.categoryId === product.categoryId)
    );

    return sameStyle.slice(0, 4);
  }, [allProducts, product, productId]);

  const relatedProductsWithVariants = useMemo(() => {
    return attachVariantsToProducts(relatedProducts, allVariants);
  }, [relatedProducts, allVariants]);

  const handleWishlist = async () => {
    try {
      await apiRequest("/wishlists/me", {
        method: "POST",
        token,
        body: {
          productId: product._id,
          addedFrom: "product_page"
        }
      });

      setMessage("Added to wishlist");
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const handleAddToCart = async () => {
    if (!selectedVariant) {
      return;
    }

    try {
      await apiRequest("/carts/me/items", {
        method: "POST",
        token,
        body: {
          productId: product._id,
          variantId: selectedVariant._id,
          quantity: 1,
          source: "product_page"
        }
      });

      setMessage("Added to cart");
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  if (!product) {
    return (
      <section className="card">
        <p>{error || "Loading product..."}</p>
      </section>
    );
  }

  return (
    <section className="product-detail-page">
      <div className="detail-breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <Link to="/products">Products</Link>
        <span>/</span>
        <span>{product.name}</span>
      </div>

      <div className="product-detail-layout">
        <div className="detail-gallery">
          <div className="detail-main-image">
            <img src={currentImage} alt={product.name} />
          </div>
          <div className="thumbnail-row">
            {galleryImages.slice(0, 5).map((image, index) => (
              <button
                key={`${image}-${index}`}
                className={image === currentImage ? "thumbnail-card active" : "thumbnail-card"}
                onClick={() => setSelectedImage(image)}
              >
                <img src={image} alt={`${product.name}-${index}`} />
              </button>
            ))}
          </div>
        </div>

        <div className="detail-copy">
          <span className="eyebrow">Storefront detail</span>
          <h2>{product.name}</h2>
          <p className="detail-price">{product.price?.toLocaleString("vi-VN")} VND</p>
          <p className="detail-description">{product.description}</p>

          <div className="detail-meta">
            <span>Style: {product.style}</span>
            <span>Gender: {product.gender}</span>
            <span>Rating: {product.averageRating}</span>
            <span>Reviews: {product.totalReviews}</span>
          </div>

          <div className="variant-section">
            <h3>Select variant</h3>
            <div className="variant-grid">
              {variants.map((variant) => (
                <button
                  key={variant._id}
                  className={
                    variant._id === selectedVariantId
                      ? "variant-chip active"
                      : "variant-chip"
                  }
                  onClick={() => {
                    setSelectedVariantId(variant._id);
                    if (variant.image) {
                      setSelectedImage(variant.image);
                    }
                  }}
                >
                  <span>{variant.color}</span>
                  <span>{variant.size}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="detail-panels">
            <div className="detail-panel">
              <h3>Product details</h3>
              <p>
                Designed for a modern wardrobe with a focus on style consistency,
                flexible daily wear, and variant-based shopping flow.
              </p>
            </div>
            <div className="detail-panel">
              <h3>Shipping and care</h3>
              <p>
                Demo storefront copy for policies, fit notes, and aftercare guidance.
                You can replace this with real content from your business rules later.
              </p>
            </div>
          </div>

          <div className="detail-actions">
            {token ? (
              <>
                <button className="secondary-button" onClick={handleWishlist}>
                  Save to wishlist
                </button>
                <button onClick={handleAddToCart}>Add to cart</button>
              </>
            ) : (
              <Link className="primary-link" to="/login">
                Login to shop
              </Link>
            )}
          </div>

          {message ? <p className="success-text">{message}</p> : null}
          {error ? <p className="error-text">{error}</p> : null}
        </div>
      </div>

      <section className="merch-block related-block">
        <div className="merch-header">
          <div>
            <span className="eyebrow">You may also like</span>
            <h2>Related products</h2>
          </div>
        </div>
        <div className="grid">
          {relatedProductsWithVariants.map((item) => (
            <ProductCard key={item._id} product={item} />
          ))}
        </div>
      </section>
    </section>
  );
}
