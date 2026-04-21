import { useEffect, useState } from "react";
import AdminPageHeader from "../../components/AdminPageHeader.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { apiRequest } from "../../lib/api.js";

const initialForm = {
  name: "",
  description: "",
  image: "",
  occasion: "casual",
  season: "all_season",
  style: "casual",
  genderTarget: "unisex",
  products: []
};

export default function AdminOutfitsPage() {
  const { token } = useAuth();
  const [products, setProducts] = useState([]);
  const [outfits, setOutfits] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = async () => {
    try {
      const [productResponse, outfitResponse] = await Promise.all([
        apiRequest("/products", { token }),
        apiRequest("/outfits", { token })
      ]);
      setProducts(productResponse.data);
      setOutfits(outfitResponse.data);
    } catch (loadError) {
      setError(loadError.message);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const buildPayload = () => ({
    ...form,
    products: form.products
  });

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      if (editingId) {
        await apiRequest(`/outfits/${editingId}`, {
          method: "PUT",
          token,
          body: buildPayload()
        });
        setMessage("Outfit updated");
      } else {
        await apiRequest("/outfits", {
          method: "POST",
          token,
          body: buildPayload()
        });
        setMessage("Outfit created");
      }

      setForm(initialForm);
      setEditingId("");
      loadData();
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  const handleEdit = (outfit) => {
    setEditingId(outfit._id);
    setForm({
      name: outfit.name || "",
      description: outfit.description || "",
      image: outfit.image || "",
      occasion: outfit.occasion || "casual",
      season: outfit.season || "all_season",
      style: outfit.style || "casual",
      genderTarget: outfit.genderTarget || "unisex",
      products: (outfit.products || []).map((item) => item._id || item)
    });
  };

  const toggleProductSelection = (productId) => {
    setForm((current) => ({
      ...current,
      products: current.products.includes(productId)
        ? current.products.filter((item) => item !== productId)
        : [...current.products, productId]
    }));
  };

  const handleDelete = async (outfitId) => {
    try {
      await apiRequest(`/outfits/${outfitId}`, {
        method: "DELETE",
        token
      });
      setMessage("Outfit deleted");
      loadData();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  return (
    <section>
      <AdminPageHeader title="Outfits" description="Curate outfit bundles and style edits." />
      <div className="admin-grid-two">
        <form className="card admin-form" onSubmit={handleSubmit}>
          <h3>{editingId ? "Edit outfit" : "New outfit"}</h3>
          <label>
            Name
            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            Description
            <textarea rows="3" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          </label>
          <label>
            Image URL
            <input value={form.image} onChange={(event) => setForm((current) => ({ ...current, image: event.target.value }))} />
          </label>
          <div className="admin-form-split">
            <label>
              Occasion
              <input value={form.occasion} onChange={(event) => setForm((current) => ({ ...current, occasion: event.target.value }))} />
            </label>
            <label>
              Season
              <input value={form.season} onChange={(event) => setForm((current) => ({ ...current, season: event.target.value }))} />
            </label>
          </div>
          <div className="admin-form-split">
            <label>
              Style
              <input value={form.style} onChange={(event) => setForm((current) => ({ ...current, style: event.target.value }))} />
            </label>
            <label>
              Gender target
              <input value={form.genderTarget} onChange={(event) => setForm((current) => ({ ...current, genderTarget: event.target.value }))} />
            </label>
          </div>
          <label>
            Selected products
            <div className="selected-tags">
              {form.products.length ? (
                form.products.map((productId) => {
                  const selectedProduct = products.find((product) => product._id === productId);

                  return (
                    <span key={productId} className="selected-tag">
                      {selectedProduct?.name || productId}
                    </span>
                  );
                })
              ) : (
                <span className="muted">No products selected yet</span>
              )}
            </div>
          </label>
          <div className="product-select-list">
            {products.map((product) => (
              <label key={product._id} className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.products.includes(product._id)}
                  onChange={() => toggleProductSelection(product._id)}
                />
                <span>
                  {product.name}
                  <small className="muted"> · {product.style}</small>
                </span>
              </label>
            ))}
          </div>
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
          <h3>Outfit list</h3>
          <div className="stack compact">
            {outfits.map((outfit) => (
              <div key={outfit._id} className="admin-list-row">
                <div>
                  <strong>{outfit.name}</strong>
                  <p className="muted">
                    {outfit.style} · {outfit.occasion}
                  </p>
                </div>
                <div className="inline-actions">
                  <button className="secondary-button" onClick={() => handleEdit(outfit)}>
                    Edit
                  </button>
                  <button onClick={() => handleDelete(outfit._id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
