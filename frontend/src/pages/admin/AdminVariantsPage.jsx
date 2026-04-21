import { useEffect, useState } from "react";
import AdminPageHeader from "../../components/AdminPageHeader.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { apiRequest } from "../../lib/api.js";

const initialForm = {
  productId: "",
  size: "",
  color: "",
  sku: "",
  stock: 0,
  priceAdjustment: 0,
  image: ""
};

export default function AdminVariantsPage() {
  const { token } = useAuth();
  const [products, setProducts] = useState([]);
  const [variants, setVariants] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = async () => {
    try {
      const [productResponse, variantResponse] = await Promise.all([
        apiRequest("/products", { token }),
        apiRequest("/product-variants", { token })
      ]);
      setProducts(productResponse.data);
      setVariants(variantResponse.data);
    } catch (loadError) {
      setError(loadError.message);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      const payload = {
        ...form,
        stock: Number(form.stock),
        priceAdjustment: Number(form.priceAdjustment)
      };

      if (editingId) {
        await apiRequest(`/product-variants/${editingId}`, {
          method: "PUT",
          token,
          body: payload
        });
        setMessage("Variant updated");
      } else {
        await apiRequest("/product-variants", {
          method: "POST",
          token,
          body: payload
        });
        setMessage("Variant created");
      }

      setForm(initialForm);
      setEditingId("");
      loadData();
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  const handleEdit = (variant) => {
    setEditingId(variant._id);
    setForm({
      productId: variant.productId?._id || "",
      size: variant.size || "",
      color: variant.color || "",
      sku: variant.sku || "",
      stock: variant.stock || 0,
      priceAdjustment: variant.priceAdjustment || 0,
      image: variant.image || ""
    });
  };

  const handleDelete = async (variantId) => {
    try {
      await apiRequest(`/product-variants/${variantId}`, {
        method: "DELETE",
        token
      });
      setMessage("Variant deleted");
      loadData();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  return (
    <section>
      <AdminPageHeader title="Variants" description="Manage color, size, stock, and SKU combinations." />
      <div className="admin-grid-two">
        <form className="card admin-form" onSubmit={handleSubmit}>
          <h3>{editingId ? "Edit variant" : "New variant"}</h3>
          <label>
            Product
            <select
              value={form.productId}
              onChange={(event) =>
                setForm((current) => ({ ...current, productId: event.target.value }))
              }
            >
              <option value="">Select product</option>
              {products.map((product) => (
                <option key={product._id} value={product._id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>
          <div className="admin-form-split">
            <label>
              Size
              <input value={form.size} onChange={(event) => setForm((current) => ({ ...current, size: event.target.value }))} />
            </label>
            <label>
              Color
              <input value={form.color} onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))} />
            </label>
          </div>
          <label>
            SKU
            <input value={form.sku} onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value }))} />
          </label>
          <div className="admin-form-split">
            <label>
              Stock
              <input type="number" value={form.stock} onChange={(event) => setForm((current) => ({ ...current, stock: event.target.value }))} />
            </label>
            <label>
              Price adjustment
              <input type="number" value={form.priceAdjustment} onChange={(event) => setForm((current) => ({ ...current, priceAdjustment: event.target.value }))} />
            </label>
          </div>
          <label>
            Image URL
            <input value={form.image} onChange={(event) => setForm((current) => ({ ...current, image: event.target.value }))} />
          </label>
          {message ? <p className="success-text">{message}</p> : null}
          {error ? <p className="error-text">{error}</p> : null}
          <div className="actions">
            <button type="submit">{editingId ? "Update" : "Create"}</button>
            {editingId ? (
              <button type="button" className="secondary-button" onClick={() => {
                setEditingId("");
                setForm(initialForm);
              }}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        <section className="card admin-panel">
          <h3>Variant list</h3>
          <div className="stack compact">
            {variants.map((variant) => (
              <div key={variant._id} className="admin-list-row">
                <div>
                  <strong>{variant.productId?.name}</strong>
                  <p className="muted">
                    {variant.color} / {variant.size} · stock {variant.stock}
                  </p>
                </div>
                <div className="inline-actions">
                  <button className="secondary-button" onClick={() => handleEdit(variant)}>
                    Edit
                  </button>
                  <button onClick={() => handleDelete(variant._id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
