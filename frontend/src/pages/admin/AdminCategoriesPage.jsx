import { useEffect, useMemo, useState } from "react";
import AdminPageHeader from "../../components/AdminPageHeader.jsx";
import ImageUpload from "../../components/ImageUpload.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { apiRequest } from "../../lib/api.js";

const initialRootForm = { name: "" };
const initialChildForm = { name: "", parentId: "", imageUrl: "" };
const initialEditForm = { name: "", parentId: "", imageUrl: "" };
const MAX_ROWS_PER_PAGE = 16;

function buildCategoryTree(categories) {
  const byParent = new Map();

  categories.forEach((category) => {
    const parentKey = category.parentId?._id || "root";
    if (!byParent.has(parentKey)) byParent.set(parentKey, []);
    byParent.get(parentKey).push(category);
  });

  const sortByCreatedAt = (items) =>
    [...items].sort((left, right) => new Date(left.createdAt || 0) - new Date(right.createdAt || 0));

  const walk = (parentId = "root", depth = 0) => {
    const children = sortByCreatedAt(byParent.get(parentId) || []);
    return children.map((child) => ({
      ...child,
      depth,
      children: walk(child._id, depth + 1)
    }));
  };

  return walk();
}

function flattenTree(nodes) {
  const result = [];
  const walk = (items, depth = 0) => {
    items.forEach((item) => {
      result.push({ ...item, depth });
      if (item.children?.length) walk(item.children, depth + 1);
    });
  };
  walk(nodes);
  return result;
}

function countRows(node) {
  return 1 + (node.children || []).reduce((total, child) => total + countRows(child), 0);
}

function paginateTreeRoots(roots, maxRowsPerPage) {
  if (!roots.length) return [[]];

  const pages = [];
  let currentPage = [];
  let currentRows = 0;

  roots.forEach((root) => {
    const rootRows = countRows(root);
    const exceedsCurrentPage = currentPage.length > 0 && currentRows + rootRows > maxRowsPerPage;

    if (exceedsCurrentPage) {
      pages.push(currentPage);
      currentPage = [root];
      currentRows = rootRows;
      return;
    }

    currentPage.push(root);
    currentRows += rootRows;
  });

  if (currentPage.length > 0) pages.push(currentPage);
  return pages.length > 0 ? pages : [[]];
}

export default function AdminCategoriesPage() {
  const { token } = useAuth();
  const [categories, setCategories] = useState([]);
  const [rootForm, setRootForm] = useState(initialRootForm);
  const [childForm, setChildForm] = useState(initialChildForm);
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState(initialEditForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [activePanel, setActivePanel] = useState("create");

  const inputClass =
    "w-full border border-gray-300 bg-white px-4 py-3 text-sm text-black outline-none transition focus:border-black";
  const labelClass = "flex flex-col gap-2 text-xs font-bold uppercase tracking-widest text-black";

  const showMessage = (value) => {
    setMessage(value);
    setError("");
    window.setTimeout(() => setMessage(""), 3000);
  };

  const loadCategories = async () => {
    try {
      const response = await apiRequest("/categories?limit=500", { token });
      setCategories(response.data || []);
    } catch (loadError) {
      setError(loadError.message);
    }
  };

  useEffect(() => {
    loadCategories();
  }, [token]);

  useEffect(() => {
    setCurrentPage(1);
  }, [categories.length]);

  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);
  const categoryOptions = useMemo(() => flattenTree(categoryTree), [categoryTree]);
  const treePages = useMemo(
    () => paginateTreeRoots(categoryTree, MAX_ROWS_PER_PAGE),
    [categoryTree]
  );
  const totalPages = treePages.length;
  const pagedCategoryTree = useMemo(() => treePages[currentPage - 1] || [], [treePages, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const handleAddRoot = async (event) => {
    event.preventDefault();
    if (!rootForm.name.trim()) return;

    try {
      await apiRequest("/categories", {
        method: "POST",
        token,
        body: {
          name: rootForm.name.trim(),
          parentId: null,
          imageUrl: ""
        }
      });
      showMessage(`Đã thêm danh mục gốc "${rootForm.name}"`);
      setRootForm(initialRootForm);
      await loadCategories();
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  const handleAddChild = async (event) => {
    event.preventDefault();
    if (!childForm.name.trim() || !childForm.parentId) return;

    try {
      await apiRequest("/categories", {
        method: "POST",
        token,
        body: {
          name: childForm.name.trim(),
          parentId: childForm.parentId,
          imageUrl: childForm.imageUrl || ""
        }
      });

      showMessage(`Đã thêm danh mục "${childForm.name}"`);
      setChildForm(initialChildForm);
      await loadCategories();
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  const handleEdit = (category) => {
    setEditingId(category._id);
    setEditForm({
      name: category.name || "",
      parentId: category.parentId?._id || "",
      imageUrl: category.imageUrl || ""
    });
  };

  const handleUpdate = async (event) => {
    event.preventDefault();

    try {
      await apiRequest(`/categories/${editingId}`, {
        method: "PUT",
        token,
        body: {
          name: editForm.name.trim(),
          parentId: editForm.parentId || null,
          imageUrl: editForm.imageUrl || ""
        }
      });

      showMessage("Đã cập nhật danh mục");
      setEditingId("");
      setEditForm(initialEditForm);
      await loadCategories();
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  const handleDelete = async (categoryId) => {
    try {
      await apiRequest(`/categories/${categoryId}`, {
        method: "DELETE",
        token
      });

      showMessage("Đã xóa danh mục");
      await loadCategories();
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  const renderTreeRows = (nodes) =>
    nodes.map((node) => (
      <div key={node._id} className="grid gap-2">
        <div className="flex items-center justify-between gap-3 rounded-sm border border-gray-100 bg-gray-50 px-3 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-widest text-gray-300">C{node.depth + 1}</span>
            <div
              className="h-10 w-10 shrink-0 overflow-hidden bg-white"
              style={{ marginLeft: `${node.depth * 10}px` }}
            >
              {node.imageUrl ? (
                <img src={node.imageUrl} alt={node.name} className="h-full w-full object-contain" />
              ) : (
                <div className="grid h-full w-full place-items-center text-[10px] uppercase tracking-widest text-gray-300">
                  IMG
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-black">{node.name}</p>
              <p className="text-[10px] uppercase tracking-widest text-gray-400">{node.children.length} mục con</p>
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <button
              className="cursor-pointer border border-black bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-black transition hover:bg-gray-100"
              onClick={() => handleEdit(node)}
            >
              Sửa
            </button>
            <button
              className="cursor-pointer border border-red-600 bg-red-600 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white transition hover:bg-red-700"
              onClick={() => handleDelete(node._id)}
            >
              Xóa
            </button>
          </div>
        </div>
        {node.children.length > 0 ? <div className="grid gap-2">{renderTreeRows(node.children)}</div> : null}
      </div>
    ));

  return (
    <section className="grid gap-6">
      <AdminPageHeader
        title="DANH MỤC"
        description="Quản lý danh mục nhiều cấp. Ví dụ: Nam -> Tất cả áo nam -> Áo thun/Áo polo."
      />

      {message ? (
        <p className="m-0 border-l-4 border-black bg-gray-100 px-4 py-3 text-xs font-bold uppercase tracking-widest text-black">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="m-0 border-l-4 border-red-600 bg-red-50 px-4 py-3 text-xs font-bold uppercase tracking-widest text-red-600">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActivePanel("create")}
          className={`cursor-pointer border-b-2 px-4 py-3 text-xs font-bold uppercase tracking-widest transition ${
            activePanel === "create"
              ? "border-black text-black"
              : "border-transparent text-gray-400 hover:text-black"
          }`}
        >
          Thêm danh mục
        </button>
        <button
          type="button"
          onClick={() => setActivePanel("structure")}
          className={`cursor-pointer border-b-2 px-4 py-3 text-xs font-bold uppercase tracking-widest transition ${
            activePanel === "structure"
              ? "border-black text-black"
              : "border-transparent text-gray-400 hover:text-black"
          }`}
        >
          Cấu trúc danh mục
        </button>
      </div>

      {editingId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={handleUpdate} className="grid w-full max-w-2xl gap-5 border border-gray-300 bg-white p-8">
            <h3 className="border-b border-gray-200 pb-4 text-sm font-bold uppercase tracking-widest text-black">
              Sửa danh mục
            </h3>

            <div className="grid gap-5 md:grid-cols-[1fr_1fr]">
              <label className={labelClass}>
                Tên danh mục
                <input
                  className={inputClass}
                  value={editForm.name}
                  onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <label className={labelClass}>
                Danh mục cha
                <select
                  className={inputClass}
                  value={editForm.parentId}
                  onChange={(event) => setEditForm((current) => ({ ...current, parentId: event.target.value }))}
                >
                  <option value="">Không có (Danh mục gốc)</option>
                  {categoryOptions
                    .filter((item) => item._id !== editingId)
                    .map((item) => (
                      <option key={item._id} value={item._id}>
                        {`${"— ".repeat(item.depth)}${item.name}`}
                      </option>
                    ))}
                </select>
              </label>
            </div>

            <ImageUpload
              label="Hình danh mục"
              value={editForm.imageUrl}
              onChange={(url) => setEditForm((current) => ({ ...current, imageUrl: url }))}
            />

            <div className="flex gap-3 border-t border-gray-200 pt-4">
              <button
                type="submit"
                className="cursor-pointer border-none bg-black px-6 py-3 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-gray-800"
              >
                Lưu
              </button>
              <button
                type="button"
                className="cursor-pointer border border-black bg-white px-6 py-3 text-xs font-bold uppercase tracking-widest text-black transition hover:bg-gray-100"
                onClick={() => {
                  setEditingId("");
                  setEditForm(initialEditForm);
                }}
              >
                Hủy
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {activePanel === "create" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={handleAddRoot} className="grid gap-5 border border-gray-200 bg-white p-7">
            <div>
              <h3 className="mb-1 text-sm font-bold uppercase tracking-widest text-black">Phần 1 - Danh mục gốc</h3>
              <p className="m-0 text-xs text-gray-500">Ví dụ: Nam, Nữ, Unisex</p>
            </div>

            <label className={labelClass}>
              Tên danh mục gốc
              <div className="flex gap-2">
                <input
                  className={inputClass}
                  value={rootForm.name}
                  placeholder="Ví dụ: Nam, Nữ..."
                  onChange={(event) => setRootForm({ name: event.target.value })}
                />
                <button
                  type="submit"
                  disabled={!rootForm.name.trim()}
                  className="shrink-0 cursor-pointer border-none bg-black px-5 py-3 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Thêm
                </button>
              </div>
            </label>
          </form>

          <form onSubmit={handleAddChild} className="grid gap-5 border border-gray-200 bg-white p-7">
            <div>
              <h3 className="mb-1 text-sm font-bold uppercase tracking-widest text-black">Phần 2 - Danh mục con</h3>
              <p className="m-0 text-xs text-gray-500">Chọn danh mục cha bất kỳ để tạo cấp tiếp theo.</p>
            </div>

            <label className={labelClass}>
              Thuộc danh mục cha
              <select
                className={inputClass}
                value={childForm.parentId}
                onChange={(event) => setChildForm((current) => ({ ...current, parentId: event.target.value }))}
                required
              >
                <option value="">Chọn danh mục cha...</option>
                {categoryOptions.map((item) => (
                  <option key={item._id} value={item._id}>
                    {`${"— ".repeat(item.depth)}${item.name}`}
                  </option>
                ))}
              </select>
            </label>

            <label className={labelClass}>
              Tên danh mục
              <input
                className={inputClass}
                value={childForm.name}
                placeholder="Ví dụ: Tất cả áo nam, Áo thun..."
                onChange={(event) => setChildForm((current) => ({ ...current, name: event.target.value }))}
              />
            </label>

            <ImageUpload
              label="Hình danh mục con"
              value={childForm.imageUrl}
              onChange={(url) => setChildForm((current) => ({ ...current, imageUrl: url }))}
            />

            <button
              type="submit"
              disabled={!childForm.name.trim() || !childForm.parentId}
              className="w-fit cursor-pointer border-none bg-black px-5 py-3 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Thêm danh mục
            </button>
          </form>
        </div>
      ) : (
        <section className="flex h-full flex-col border border-gray-200 bg-white p-7">
          <div className="mb-4 flex items-center justify-between border-b border-gray-200 pb-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-black">Cấu trúc danh mục ({categories.length})</h3>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
              Trang {currentPage}/{totalPages}
            </p>
          </div>

          {categories.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">Chưa có danh mục nào.</p>
          ) : (
            <>
              <div className="flex-1 pr-1">
                <div className="grid gap-2">{renderTreeRows(pagedCategoryTree)}</div>
              </div>

              {totalPages > 1 ? (
                <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
                  <button
                    type="button"
                    className="cursor-pointer border border-black bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-black transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
                  >
                    Trang trước
                  </button>

                  <div className="flex items-center gap-2">
                    {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={`h-8 min-w-8 cursor-pointer border px-2 text-[10px] font-bold uppercase tracking-widest transition ${
                          currentPage === page
                            ? "border-black bg-black text-white"
                            : "border-gray-300 bg-white text-black hover:border-black"
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="cursor-pointer border border-black bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-black transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}
                  >
                    Trang sau
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>
      )}
    </section>
  );
}
