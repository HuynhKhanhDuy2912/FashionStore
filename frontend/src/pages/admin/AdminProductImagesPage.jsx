import { useEffect, useState } from "react";
import AdminPageHeader from "../../components/AdminPageHeader.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { apiRequest } from "../../lib/api.js";

const initialForm = {
  productId: "",
  imageUrl: "",
  isMain: false
};

export default function AdminProductImagesPage() {
  const { token } = useAuth();
  const [products, setProducts] = useState([]);
  const [images, setImages] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = async () => {
    try {
      const [productResponse, imageResponse] = await Promise.all([
        apiRequest("/products", { token }),
        apiRequest("/product-images", { token })
      ]);
      setProducts(productResponse.data);
      setImages(imageResponse.data);
    } catch (loadError) {
      setError(loadError.message);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    try {
      if (editingId) {
        await apiRequest(`/product-images/${editingId}`, {
          method: "PUT",
          token,
          body: form
        });
        setMessage("Product image updated");
      } else {
        await apiRequest("/product-images", {
          method: "POST",
          token,
          body: form
        });
        setMessage("Product image created");
      }

      setForm(initialForm);
      setEditingId("");
      loadData();
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  const handleEdit = (image) => {
    setEditingId(image._id);
    setForm({
      productId: image.productId?._id || "",
      imageUrl: image.imageUrl || "",
      isMain: Boolean(image.isMain)
    });
  };

  const handleDelete = async (imageId) => {
    try {
      await apiRequest(`/product-images/${imageId}`, {
        method: "DELETE",
        token
      });
      setMessage("Product image deleted");
      loadData();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  return (
    <section>
      <AdminPageHeader
        title="Product Images"
        description="Manage supplemental image records for products."
      />
      <div className="admin-grid-two">
        <form className="card admin-form" onSubmit={handleSubmit}>
          <h3>{editingId ? "Edit image" : "New image"}</h3>
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
          <label>
            Image URL
            <input
              value={form.imageUrl}
              onChange={(event) =>
                setForm((current) => ({ ...current, imageUrl: event.target.value }))
              }
            />
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.isMain}
              onChange={(event) =>
                setForm((current) => ({ ...current, isMain: event.target.checked }))
              }
            />
            <span>Mark as main image</span>
          </label>
          {message ? <p className="success-text">{message}</p> : null}
          {error ? <p className="error-text">{error}</p> : null}
          <div className="actions">
            <button type="submit">{editingId ? "Update" : "Create"}</button>
            {editingId ? (
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setEditingId("");
                  setForm(initialForm);
                }}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        <section className="card admin-panel">
          <h3>Image list</h3>
          <div className="stack compact">
            {images.map((image) => (
              <div key={image._id} className="admin-list-row">
                <div>
                  <strong>{image.productId?.name}</strong>
                  <p className="muted">{image.imageUrl}</p>
                  <p className="muted">{image.isMain ? "Main image" : "Secondary image"}</p>
                </div>
                <div className="inline-actions">
                  <button className="secondary-button" onClick={() => handleEdit(image)}>
                    Edit
                  </button>
                  <button onClick={() => handleDelete(image._id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
