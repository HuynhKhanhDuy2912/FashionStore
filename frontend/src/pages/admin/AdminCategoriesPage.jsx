import { useEffect, useState } from "react";
import AdminPageHeader from "../../components/AdminPageHeader.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { apiRequest } from "../../lib/api.js";

const initialForm = {
  name: "",
  parentId: ""
};

export default function AdminCategoriesPage() {
  const { token } = useAuth();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadCategories = async () => {
    try {
      const response = await apiRequest("/categories", { token });
      setCategories(response.data);
    } catch (loadError) {
      setError(loadError.message);
    }
  };

  useEffect(() => {
    loadCategories();
  }, [token]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    try {
      if (editingId) {
        await apiRequest(`/categories/${editingId}`, {
          method: "PUT",
          token,
          body: {
            ...form,
            parentId: form.parentId || null
          }
        });
        setMessage("Category updated");
      } else {
        await apiRequest("/categories", {
          method: "POST",
          token,
          body: {
            ...form,
            parentId: form.parentId || null
          }
        });
        setMessage("Category created");
      }

      setForm(initialForm);
      setEditingId("");
      loadCategories();
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  const handleEdit = (category) => {
    setEditingId(category._id);
    setForm({
      name: category.name || "",
      parentId: category.parentId?._id || ""
    });
  };

  const handleDelete = async (categoryId) => {
    try {
      await apiRequest(`/categories/${categoryId}`, {
        method: "DELETE",
        token
      });
      setMessage("Category deleted");
      loadCategories();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  return (
    <section>
      <AdminPageHeader title="Categories" description="Create and organize product categories." />
      <div className="admin-grid-two">
        <form className="card admin-form" onSubmit={handleSubmit}>
          <h3>{editingId ? "Edit category" : "New category"}</h3>
          <label>
            Name
            <input
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
            />
          </label>
          <label>
            Parent
            <select
              value={form.parentId}
              onChange={(event) =>
                setForm((current) => ({ ...current, parentId: event.target.value }))
              }
            >
              <option value="">None</option>
              {categories.map((category) => (
                <option key={category._id} value={category._id}>
                  {category.name}
                </option>
              ))}
            </select>
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
          <h3>Category list</h3>
          <div className="stack compact">
            {categories.map((category) => (
              <div key={category._id} className="admin-list-row">
                <div>
                  <strong>{category.name}</strong>
                  <p className="muted">{category.parentId?.name || "Root category"}</p>
                </div>
                <div className="inline-actions">
                  <button className="secondary-button" onClick={() => handleEdit(category)}>
                    Edit
                  </button>
                  <button onClick={() => handleDelete(category._id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
