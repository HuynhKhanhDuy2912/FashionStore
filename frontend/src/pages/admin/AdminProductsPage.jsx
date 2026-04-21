import { useEffect, useState } from "react";
import AdminPageHeader from "../../components/AdminPageHeader.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { apiRequest } from "../../lib/api.js";

const initialForm = {
  name: "",
  description: "",
  price: 0,
  discount: 0,
  categoryId: "",
  brand: "",
  gender: "unisex",
  material: "",
  style: "casual",
  season: "all_season",
  occasion: "casual",
  imageUrl: ""
};

export default function AdminProductsPage() {
  const { token } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = async () => {
    try {
      const [productResponse, categoryResponse] = await Promise.all([
        apiRequest("/products", { token }),
        apiRequest("/categories", { token })
      ]);

      setProducts(productResponse.data);
      setCategories(categoryResponse.data);
    } catch (loadError) {
      setError(loadError.message);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const buildPayload = () => ({
    name: form.name,
    description: form.description,
    price: Number(form.price),
    discount: Number(form.discount),
    categoryId: form.categoryId,
    brand: form.brand,
    gender: form.gender,
    material: form.material,
    style: form.style,
    season: [form.season],
    occasion: [form.occasion],
    images: form.imageUrl ? [form.imageUrl] : []
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    try {
      if (editingId) {
        await apiRequest(`/products/${editingId}`, {
          method: "PUT",
          token,
          body: buildPayload()
        });
        setMessage("Product updated");
      } else {
        await apiRequest("/products", {
          method: "POST",
          token,
          body: buildPayload()
        });
        setMessage("Product created");
      }

      setForm(initialForm);
      setEditingId("");
      loadData();
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  const handleEdit = (product) => {
    setEditingId(product._id);
    setForm({
      name: product.name || "",
      description: product.description || "",
      price: product.price || 0,
      discount: product.discount || 0,
      categoryId: product.categoryId?._id || "",
      brand: product.brand || "",
      gender: product.gender || "unisex",
      material: product.material || "",
      style: product.style || "casual",
      season: product.season?.[0] || "all_season",
      occasion: product.occasion?.[0] || "casual",
      imageUrl: product.images?.[0] || ""
    });
  };

  const handleDelete = async (productId) => {
    try {
      await apiRequest(`/products/${productId}`, {
        method: "DELETE",
        token
      });
      setMessage("Product deleted");
      loadData();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  return (
    <section>
      <AdminPageHeader title="Products" description="Manage core catalog items." />
      <div className="admin-grid-two">
        <form className="card admin-form" onSubmit={handleSubmit}>
          <h3>{editingId ? "Edit product" : "New product"}</h3>
          <label>
            Name
            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            Description
            <textarea
              rows="3"
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
            />
          </label>
          <label>
            Category
            <select
              value={form.categoryId}
              onChange={(event) =>
                setForm((current) => ({ ...current, categoryId: event.target.value }))
              }
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category._id} value={category._id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <div className="admin-form-split">
            <label>
              Price
              <input
                type="number"
                value={form.price}
                onChange={(event) =>
                  setForm((current) => ({ ...current, price: event.target.value }))
                }
              />
            </label>
            <label>
              Discount
              <input
                type="number"
                value={form.discount}
                onChange={(event) =>
                  setForm((current) => ({ ...current, discount: event.target.value }))
                }
              />
            </label>
          </div>
          <div className="admin-form-split">
            <label>
              Gender
              <select
                value={form.gender}
                onChange={(event) =>
                  setForm((current) => ({ ...current, gender: event.target.value }))
                }
              >
                <option value="unisex">Unisex</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </label>
            <label>
              Style
              <select
                value={form.style}
                onChange={(event) =>
                  setForm((current) => ({ ...current, style: event.target.value }))
                }
              >
                <option value="casual">casual</option>
                <option value="minimal">minimal</option>
                <option value="streetwear">streetwear</option>
                <option value="elegant">elegant</option>
                <option value="sporty">sporty</option>
                <option value="vintage">vintage</option>
                <option value="smart_casual">smart_casual</option>
              </select>
            </label>
          </div>
          <div className="admin-form-split">
            <label>
              Season
              <input
                value={form.season}
                onChange={(event) =>
                  setForm((current) => ({ ...current, season: event.target.value }))
                }
              />
            </label>
            <label>
              Occasion
              <input
                value={form.occasion}
                onChange={(event) =>
                  setForm((current) => ({ ...current, occasion: event.target.value }))
                }
              />
            </label>
          </div>
          <label>
            Brand
            <input
              value={form.brand}
              onChange={(event) => setForm((current) => ({ ...current, brand: event.target.value }))}
            />
          </label>
          <label>
            Material
            <input
              value={form.material}
              onChange={(event) =>
                setForm((current) => ({ ...current, material: event.target.value }))
              }
            />
          </label>
          <label>
            Image URL
            <input
              value={form.imageUrl}
              onChange={(event) =>
                setForm((current) => ({ ...current, imageUrl: event.target.value }))
              }
            />
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
          <h3>Product list</h3>
          <div className="stack compact">
            {products.map((product) => (
              <div key={product._id} className="admin-list-row">
                <div>
                  <strong>{product.name}</strong>
                  <p className="muted">
                    {product.categoryId?.name} · {product.style}
                  </p>
                </div>
                <div className="inline-actions">
                  <button className="secondary-button" onClick={() => handleEdit(product)}>
                    Edit
                  </button>
                  <button onClick={() => handleDelete(product._id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
