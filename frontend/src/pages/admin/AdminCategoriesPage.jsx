import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import AdminPageHeader from "../../components/AdminPageHeader.jsx";
import ImageUpload from "../../components/ImageUpload.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { apiRequest } from "../../lib/api.js";
import toast from "react-hot-toast";

const initialRootForm = { name: "", imageUrl: "" };
const initialLevel2Form = { name: "", parentId: "", imageUrl: "" };
const initialLevel3Form = { name: "", parentId: "", imageUrl: "" };
const initialEditForm = { name: "", parentId: "", imageUrl: "" };

function buildCategoryTree(categories) {
  const byParent = new Map();

  categories.forEach((category) => {
    const parentKey = category.parentId?._id || "root";
    if (!byParent.has(parentKey)) byParent.set(parentKey, []);
    byParent.get(parentKey).push(category);
  });

  const sortByCreatedAt = (items) =>
    [...items].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

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

function filterTree(nodes, query) {
  if (!query.trim()) return nodes;
  const normalized = query.trim().toLowerCase();

  const walk = (items) => {
    const filtered = [];

    items.forEach((item) => {
      const children = walk(item.children || []);
      const isMatch = (item.name || "").toLowerCase().includes(normalized);
      if (isMatch || children.length > 0) filtered.push({ ...item, children });
    });

    return filtered;
  };

  return walk(nodes);
}

export default function AdminCategoriesPage() {
  const { token } = useAuth();

  const [categories, setCategories] = useState([]);
  const [rootForm, setRootForm] = useState(initialRootForm);
  const [level2Form, setLevel2Form] = useState(initialLevel2Form);
  const [level3Form, setLevel3Form] = useState(initialLevel3Form);
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState(initialEditForm);
  const [activeForm, setActiveForm] = useState("root");
  const [search, setSearch] = useState("");

  const inputClass =
    "w-full border border-gray-300 bg-white px-4 py-3 text-sm text-black outline-none transition focus:border-black";
  const labelClass = "flex flex-col gap-2 text-xs font-bold uppercase tracking-widest text-black";

  const loadCategories = async () => {
    try {
      const response = await apiRequest("/categories?limit=1000", { token });
      setCategories(response.data || []);
    } catch (loadError) {
      toast.error(loadError.message);
    }
  };

  useEffect(() => {
    loadCategories();
  }, [token]);

  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);
  const filteredTree = useMemo(() => filterTree(categoryTree, search), [categoryTree, search]);
  const categoryOptions = useMemo(() => flattenTree(categoryTree), [categoryTree]);

  const depthById = useMemo(() => {
    const map = new Map();
    categoryOptions.forEach((item) => map.set(item._id, item.depth));
    return map;
  }, [categoryOptions]);

  const level1Options = useMemo(
    () => categoryOptions.filter((item) => item.depth === 0),
    [categoryOptions]
  );

  const level2Options = useMemo(
    () => categoryOptions.filter((item) => item.depth === 1),
    [categoryOptions]
  );

  const level1Count = useMemo(
    () => categoryOptions.filter((item) => item.depth === 0).length,
    [categoryOptions]
  );

  const level2Count = useMemo(
    () => categoryOptions.filter((item) => item.depth === 1).length,
    [categoryOptions]
  );

  const level3Count = useMemo(
    () => categoryOptions.filter((item) => item.depth === 2).length,
    [categoryOptions]
  );

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
          imageUrl: rootForm.imageUrl ? rootForm.imageUrl.trim() : ""
        }
      });

      toast.success(`Đã thêm danh mục cấp 1 "${rootForm.name}"`);
      setRootForm(initialRootForm);
      await loadCategories();
    } catch (submitError) {
      toast.error(submitError.message);
    }
  };

  const handleAddLevel2 = async (event) => {
    event.preventDefault();
    if (!level2Form.name.trim() || !level2Form.parentId) return;

    if (!level2Form.imageUrl.trim()) {
      toast.error("Danh mục cấp 2 bắt buộc có ảnh.");
      return;
    }

    const parentDepth = depthById.get(level2Form.parentId);
    if (parentDepth !== 0) {
      toast.error("Danh mục cấp 2 phải chọn cha là danh mục cấp 1.");
      return;
    }

    try {
      await apiRequest("/categories", {
        method: "POST",
        token,
        body: {
          name: level2Form.name.trim(),
          parentId: level2Form.parentId,
          imageUrl: level2Form.imageUrl.trim()
        }
      });

      toast.success(`Đã thêm danh mục cấp 2 "${level2Form.name}"`);
      setLevel2Form(initialLevel2Form);
      await loadCategories();
    } catch (submitError) {
      toast.error(submitError.message);
    }
  };

  const handleAddLevel3 = async (event) => {
    event.preventDefault();
    if (!level3Form.name.trim() || !level3Form.parentId) return;

    if (!level3Form.imageUrl.trim()) {
      toast.error("Danh mục cấp 3 bắt buộc có ảnh.");
      return;
    }

    const parentDepth = depthById.get(level3Form.parentId);
    if (parentDepth !== 1) {
      toast.error("Danh mục cấp 3 phải chọn cha là danh mục cấp 2.");
      return;
    }

    try {
      await apiRequest("/categories", {
        method: "POST",
        token,
        body: {
          name: level3Form.name.trim(),
          parentId: level3Form.parentId,
          imageUrl: level3Form.imageUrl.trim()
        }
      });

      toast.success(`Đã thêm danh mục cấp 3 "${level3Form.name}"`);
      setLevel3Form(initialLevel3Form);
      await loadCategories();
    } catch (submitError) {
      toast.error(submitError.message);
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
    if (!editingId) return;

    const currentDepth = depthById.get(editingId) ?? 0;
    const nextParentId = editForm.parentId || null;
    const nextParentDepth = nextParentId ? depthById.get(nextParentId) : -1;
    const nextDepth = nextParentDepth + 1;

    if (nextDepth > 2) {
      toast.error("Danh mục chỉ hỗ trợ tối đa 3 cấp.");
      return;
    }

    if (nextDepth > 0 && !editForm.imageUrl.trim()) {
      toast.error("Danh mục cấp 2/3 bắt buộc có ảnh.");
      return;
    }

    try {
      await apiRequest(`/categories/${editingId}`, {
        method: "PUT",
        token,
        body: {
          name: editForm.name.trim(),
          parentId: nextParentId,
          imageUrl: editForm.imageUrl.trim()
        }
      });

      toast.success("Đã cập nhật danh mục");
      setEditingId("");
      setEditForm(initialEditForm);
      await loadCategories();
    } catch (submitError) {
      toast.error(submitError.message);
    }
  };

  const handleDelete = async (categoryId) => {
    try {
      await apiRequest(`/categories/${categoryId}`, {
        method: "DELETE",
        token
      });

      toast.success("Đã xóa danh mục");
      await loadCategories();
    } catch (submitError) {
      toast.error(submitError.message);
    }
  };

  const renderTreeRows = (nodes) =>
    nodes.map((node) => (
      <div key={node._id} className="grid gap-2">
        <div className="flex items-center justify-between gap-3 rounded-sm border border-gray-100 bg-gray-50 px-3 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-widest text-gray-300">CẤP {node.depth + 1}</span>
            <div className="h-10 w-10 shrink-0 overflow-hidden bg-white" style={{ marginLeft: `${node.depth * 10}px` }}>
              {node.imageUrl ? (
                <img src={node.imageUrl} alt={node.name} className="h-full w-full object-contain" />
              ) : (
                <div className="grid h-full w-full place-items-center text-[10px] uppercase tracking-widest text-gray-300 text-center leading-[1]">
                  NO IMG
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

  const editingDepth = editingId ? depthById.get(editingId) ?? 0 : 0;
  const editParentOptions = useMemo(() => {
    if (!editingId) return [];
    const editingNode = categoryOptions.find((item) => item._id === editingId);
    if (!editingNode) return [];

    const getMaxDepthOffset = (node) => {
      if (!node || !node.children || node.children.length === 0) return 0;
      return 1 + Math.max(...node.children.map(getMaxDepthOffset));
    };
    const maxOffset = getMaxDepthOffset(editingNode);

    const descendantIds = new Set();
    const collectDescendants = (node) => {
      if (!node || !node.children) return;
      node.children.forEach((child) => {
        descendantIds.add(child._id);
        collectDescendants(child);
      });
    };
    collectDescendants(editingNode);

    return categoryOptions.filter((item) => {
      if (item._id === editingId) return false;
      if (descendantIds.has(item._id)) return false;
      if (item.depth + 1 + maxOffset > 2) return false;
      return true;
    });
  }, [editingId, categoryOptions]);

  return (
    <section className="grid gap-6 p-6">
      <AdminPageHeader
        title="DANH MỤC"
        description=""
      />

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
                  <option value="">Không có (Danh mục cấp 1)</option>
                  {editParentOptions.map((item) => (
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

      <div className="grid gap-6 lg:grid-cols-[1fr_1.55fr] lg:items-stretch">
        <aside className="grid content-start gap-6">
          <section className="border border-gray-200 bg-white p-6 lg:h-[760px] lg:overflow-y-auto">
            <div className="mb-5 grid grid-cols-4 gap-3">
              <div className="border border-gray-200 bg-gray-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Tổng cộng</p>
                <p className="mt-2 text-xl font-bold text-black">{categories.length}</p>
              </div>
              <div className="border border-gray-200 bg-gray-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Cấp 1</p>
                <p className="mt-2 text-xl font-bold text-black">{level1Count}</p>
              </div>
              <div className="border border-gray-200 bg-gray-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Cấp 2</p>
                <p className="mt-2 text-xl font-bold text-black">{level2Count}</p>
              </div>
              <div className="border border-gray-200 bg-gray-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Cấp 3</p>
                <p className="mt-2 text-xl font-bold text-black">{level3Count}</p>
              </div>
            </div>

            <div className="mb-5 flex items-center gap-2 border-b border-gray-200">
              <button
                type="button"
                onClick={() => setActiveForm("root")}
                className={`cursor-pointer border-b-2 px-3 py-2 text-xs font-bold uppercase tracking-widest transition ${
                  activeForm === "root" ? "border-black text-black" : "border-transparent text-gray-400 hover:text-black"
                }`}
              >
                Thêm cấp 1
              </button>
              <button
                type="button"
                onClick={() => setActiveForm("level2")}
                className={`cursor-pointer border-b-2 px-3 py-2 text-xs font-bold uppercase tracking-widest transition ${
                  activeForm === "level2" ? "border-black text-black" : "border-transparent text-gray-400 hover:text-black"
                }`}
              >
                Thêm cấp 2
              </button>
              <button
                type="button"
                onClick={() => setActiveForm("level3")}
                className={`cursor-pointer border-b-2 px-3 py-2 text-xs font-bold uppercase tracking-widest transition ${
                  activeForm === "level3" ? "border-black text-black" : "border-transparent text-gray-400 hover:text-black"
                }`}
              >
                Thêm cấp 3
              </button>
            </div>

            {activeForm === "root" ? (
              <form onSubmit={handleAddRoot} className="grid gap-4">
                <label className={labelClass}>
                  Tên danh mục cấp 1
                  <input
                    className={inputClass}
                    value={rootForm.name}
                    placeholder="Ví dụ: Nam, Nữ..."
                    onChange={(event) => setRootForm((current) => ({ ...current, name: event.target.value }))}
                  />
                </label>
                <ImageUpload
                  label="Hình danh mục cấp 1 (Tùy chọn)"
                  value={rootForm.imageUrl}
                  onChange={(url) => setRootForm((current) => ({ ...current, imageUrl: url }))}
                />
                <button
                  type="submit"
                  disabled={!rootForm.name.trim()}
                  className="w-fit cursor-pointer border-none bg-black px-5 py-3 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Thêm danh mục cấp 1
                </button>
              </form>
            ) : null}

            {activeForm === "level2" ? (
              <form onSubmit={handleAddLevel2} className="grid gap-4">
                <label className={labelClass}>
                  Chọn danh mục cấp 1
                  <select
                    className={inputClass}
                    value={level2Form.parentId}
                    onChange={(event) => setLevel2Form((current) => ({ ...current, parentId: event.target.value }))}
                    required
                  >
                    <option value="">Chọn danh mục cấp 1...</option>
                    {level1Options.map((item) => (
                      <option key={item._id} value={item._id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={labelClass}>
                  Tên danh mục cấp 2
                  <input
                    className={inputClass}
                    value={level2Form.name}
                    placeholder="Ví dụ: Tất cả áo nam, Tất cả quần nam..."
                    onChange={(event) => setLevel2Form((current) => ({ ...current, name: event.target.value }))}
                  />
                </label>

                <ImageUpload
                  label="Hình danh mục cấp 2"
                  value={level2Form.imageUrl}
                  onChange={(url) => setLevel2Form((current) => ({ ...current, imageUrl: url }))}
                />

                <button
                  type="submit"
                  disabled={!level2Form.name.trim() || !level2Form.parentId}
                  className="w-fit cursor-pointer border-none bg-black px-5 py-3 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Thêm danh mục cấp 2
                </button>
              </form>
            ) : null}

            {activeForm === "level3" ? (
              <form onSubmit={handleAddLevel3} className="grid gap-4">
                <label className={labelClass}>
                  Chọn danh mục cấp 2
                  <select
                    className={inputClass}
                    value={level3Form.parentId}
                    onChange={(event) => setLevel3Form((current) => ({ ...current, parentId: event.target.value }))}
                    required
                  >
                    <option value="">Chọn danh mục cấp 2...</option>
                    {level2Options.map((item) => (
                      <option key={item._id} value={item._id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={labelClass}>
                  Tên danh mục cấp 3
                  <input
                    className={inputClass}
                    value={level3Form.name}
                    placeholder="Ví dụ: Áo thun, Áo polo, Quần jean..."
                    onChange={(event) => setLevel3Form((current) => ({ ...current, name: event.target.value }))}
                  />
                </label>

                <ImageUpload
                  label="Hình danh mục cấp 3"
                  value={level3Form.imageUrl}
                  onChange={(url) => setLevel3Form((current) => ({ ...current, imageUrl: url }))}
                />

                <button
                  type="submit"
                  disabled={!level3Form.name.trim() || !level3Form.parentId}
                  className="w-fit cursor-pointer border-none bg-black px-5 py-3 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Thêm danh mục cấp 3
                </button>
              </form>
            ) : null}
          </section>
        </aside>

        <section className="flex flex-col border border-gray-200 bg-white p-7 lg:h-[760px]">
          <div className="mb-4 flex items-center justify-between border-b border-gray-200 pb-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-black">Cấu trúc danh mục</h3>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{filteredTree.length} nhóm</p>
          </div>

          <div className="mb-4 flex items-center gap-3 border border-gray-200 px-3 py-2">
            <Search size={16} className="text-gray-400" />
            <input
              className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
              placeholder="Tìm danh mục..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {filteredTree.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">Không có danh mục phù hợp.</p>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="grid gap-2">{renderTreeRows(filteredTree)}</div>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
