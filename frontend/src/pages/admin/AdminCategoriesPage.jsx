import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  ChevronDown,
  ChevronRight,
  Trash2,
  Edit2,
  Plus,
  FolderTree,
  Image as ImageIcon,
  Filter,
  X,
  AlertTriangle,
} from "lucide-react";
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
    [...items].sort(
      (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0),
    );

  const walk = (parentId = "root", depth = 0) => {
    const children = sortByCreatedAt(byParent.get(parentId) || []);
    return children.map((child) => ({
      ...child,
      depth,
      children: walk(child._id, depth + 1),
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

function filterTree(nodes, query, levelFilter, imageFilter) {
  if (!query.trim() && levelFilter === "all" && imageFilter === "all")
    return nodes;
  const normalized = query.trim().toLowerCase();

  const walk = (items) => {
    const filtered = [];

    items.forEach((item) => {
      const children = walk(item.children || []);
      const nameMatch =
        !query.trim() || (item.name || "").toLowerCase().includes(normalized);
      const levelMatch =
        levelFilter === "all" || item.depth === parseInt(levelFilter);
      const imageMatch =
        imageFilter === "all" ||
        (imageFilter === "with" && item.imageUrl) ||
        (imageFilter === "without" && !item.imageUrl);

      const isMatch = nameMatch && levelMatch && imageMatch;
      if (isMatch || children.length > 0) filtered.push({ ...item, children });
    });

    return filtered;
  };

  return walk(nodes);
}

export default function AdminCategoriesPage() {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const globalSearch = searchParams.get("q") || "";

  const [categories, setCategories] = useState([]);
  const [rootForm, setRootForm] = useState(initialRootForm);
  const [level2Form, setLevel2Form] = useState(initialLevel2Form);
  const [level3Form, setLevel3Form] = useState(initialLevel3Form);
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState(initialEditForm);
  const [activeForm, setActiveForm] = useState("root");
  const [search, setSearch] = useState(globalSearch);
  const [levelFilter, setLevelFilter] = useState("all");
  const [imageFilter, setImageFilter] = useState("all");
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const inputClass =
    "w-full border border-gray-300 bg-white px-4 py-3 text-sm text-black outline-none transition focus:border-black";
  const labelClass =
    "flex flex-col gap-2 text-xs font-bold uppercase tracking-widest text-black";

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

  useEffect(() => {
    setSearch(globalSearch);
  }, [globalSearch]);

  const categoryTree = useMemo(
    () => buildCategoryTree(categories),
    [categories],
  );
  const filteredTree = useMemo(
    () => filterTree(categoryTree, search, levelFilter, imageFilter),
    [categoryTree, search, levelFilter, imageFilter],
  );
  const categoryOptions = useMemo(
    () => flattenTree(categoryTree),
    [categoryTree],
  );

  const depthById = useMemo(() => {
    const map = new Map();
    categoryOptions.forEach((item) => map.set(item._id, item.depth));
    return map;
  }, [categoryOptions]);

  const level1Options = useMemo(
    () => categoryOptions.filter((item) => item.depth === 0),
    [categoryOptions],
  );

  const level2Options = useMemo(
    () => categoryOptions.filter((item) => item.depth === 1),
    [categoryOptions],
  );

  const level1Count = useMemo(
    () => categoryOptions.filter((item) => item.depth === 0).length,
    [categoryOptions],
  );

  const level2Count = useMemo(
    () => categoryOptions.filter((item) => item.depth === 1).length,
    [categoryOptions],
  );

  const level3Count = useMemo(
    () => categoryOptions.filter((item) => item.depth === 2).length,
    [categoryOptions],
  );

  const categoriesWithImages = useMemo(
    () => categoryOptions.filter((item) => item.imageUrl).length,
    [categoryOptions],
  );

  const toggleNode = (nodeId) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const expandAll = () => {
    const allIds = new Set(categoryOptions.map((item) => item._id));
    setExpandedNodes(allIds);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

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
          imageUrl: rootForm.imageUrl ? rootForm.imageUrl.trim() : "",
        },
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
          imageUrl: level2Form.imageUrl.trim(),
        },
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
          imageUrl: level3Form.imageUrl.trim(),
        },
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
      imageUrl: category.imageUrl || "",
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
          imageUrl: editForm.imageUrl.trim(),
        },
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
        token,
      });

      toast.success("Đã xóa danh mục");
      setDeleteConfirm(null);
      await loadCategories();
    } catch (submitError) {
      toast.error(submitError.message);
    }
  };

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

  const renderTreeRows = (nodes) =>
    nodes.map((node) => {
      const isExpanded = expandedNodes.has(node._id);
      const hasChildren = node.children && node.children.length > 0;

      return (
        <div key={node._id} className="grid gap-2">
          <div className="flex items-center justify-between gap-3 rounded border border-gray-200 bg-white px-4 py-3 shadow-sm transition hover:shadow-md">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {hasChildren ? (
                <button
                  onClick={() => toggleNode(node._id)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-gray-300 bg-gray-50 transition hover:bg-gray-100"
                >
                  {isExpanded ? (
                    <ChevronDown size={14} className="text-gray-600" />
                  ) : (
                    <ChevronRight size={14} className="text-gray-600" />
                  )}
                </button>
              ) : (
                <div className="h-6 w-6 shrink-0" />
              )}

              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-gray-200 bg-gray-50"
                style={{ marginLeft: `${node.depth * 16}px` }}
              >
                {node.imageUrl ? (
                  <img
                    src={node.imageUrl}
                    alt={node.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImageIcon size={20} className="text-gray-300" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {node.name}
                  </p>
                  <span className="shrink-0 rounded bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-600">
                    Cấp {node.depth + 1}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  {hasChildren
                    ? `${node.children.length} mục con`
                    : "Không có mục con"}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 gap-2">
              <button
                className="flex items-center gap-1.5 rounded border border-blue-600 bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                onClick={() => handleEdit(node)}
              >
                <Edit2 size={12} />
                Sửa
              </button>
              <button
                className="flex items-center gap-1.5 rounded border border-red-600 bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
                onClick={() => setDeleteConfirm(node)}
              >
                <Trash2 size={12} />
                Xóa
              </button>
            </div>
          </div>
          {hasChildren && isExpanded ? (
            <div className="ml-6 grid gap-2 border-l-2 border-gray-200 pl-4">
              {renderTreeRows(node.children)}
            </div>
          ) : null}
        </div>
      );
    });

  return (
    <section className="grid gap-4 p-6">
      <AdminPageHeader
        title="QUẢN LÝ DANH MỤC"
        description="Quản lý cấu trúc danh mục sản phẩm 3 cấp"
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: "Tổng cộng",
            value: categories.length,
            icon: FolderTree,
            iconBg: "bg-blue-50",
            iconColor: "text-blue-600",
          },
          {
            label: "Cấp 1",
            value: level1Count,
            symbol: "1",
            iconBg: "bg-green-50",
            iconColor: "text-green-600",
            valueClass: "text-green-600",
          },
          {
            label: "Cấp 2",
            value: level2Count,
            symbol: "2",
            iconBg: "bg-purple-50",
            iconColor: "text-purple-600",
            valueClass: "text-purple-600",
          },
          {
            label: "Cấp 3",
            value: level3Count,
            symbol: "3",
            iconBg: "bg-orange-50",
            iconColor: "text-orange-600",
            valueClass: "text-orange-600",
          },
        ].map(
          ({
            label,
            value,
            icon: Icon,
            symbol,
            iconBg,
            iconColor,
            valueClass,
          }) => (
            <div
              key={label}
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="mb-1 text-xs font-bold uppercase tracking-widest text-gray-500">
                    {label}
                  </p>
                  <p
                    className={`text-3xl font-bold ${valueClass || "text-gray-900"}`}
                  >
                    {value}
                  </p>
                </div>
                <div
                  className={`grid h-12 w-12 place-items-center rounded-xl ${iconBg}`}
                >
                  {Icon ? (
                    <Icon className={`h-6 w-6 ${iconColor}`} />
                  ) : (
                    <span className={`text-xl font-bold ${iconColor}`}>
                      {symbol}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ),
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
        <aside className="grid content-start gap-6">
          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between border-b border-gray-200 pb-4">
              <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-900">
                <Plus size={18} />
                Thêm danh mục
              </h3>
            </div>

            <div className="mb-5 flex gap-2 border-b border-gray-100">
              <button
                type="button"
                onClick={() => setActiveForm("root")}
                className={`flex-1 border-b-2 px-3 py-2.5 text-xs font-bold uppercase tracking-widest transition ${
                  activeForm === "root"
                    ? "border-black text-black font-bold"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                Cấp 1
              </button>
              <button
                type="button"
                onClick={() => setActiveForm("level2")}
                className={`flex-1 border-b-2 px-3 py-2.5 text-xs font-bold uppercase tracking-widest transition ${
                  activeForm === "level2"
                    ? "border-black text-black font-bold"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                Cấp 2
              </button>
              <button
                type="button"
                onClick={() => setActiveForm("level3")}
                className={`flex-1 border-b-2 px-3 py-2.5 text-xs font-bold uppercase tracking-widest transition ${
                  activeForm === "level3"
                    ? "border-black text-black font-bold"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                Cấp 3
              </button>
            </div>

            {activeForm === "root" ? (
              <form onSubmit={handleAddRoot} className="grid gap-4">
                <label className={labelClass}>
                  Tên danh mục cấp 1
                  <input
                    className={inputClass}
                    value={rootForm.name}
                    placeholder="Ví dụ: Nam, Nữ, Trẻ em..."
                    onChange={(event) =>
                      setRootForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                </label>
                <ImageUpload
                  label="Hình danh mục"
                  value={rootForm.imageUrl}
                  onChange={(url) =>
                    setRootForm((current) => ({ ...current, imageUrl: url }))
                  }
                />
                <button
                  type="submit"
                  disabled={!rootForm.name.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded bg-black px-5 py-3 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus size={16} />
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
                    onChange={(event) =>
                      setLevel2Form((current) => ({
                        ...current,
                        parentId: event.target.value,
                      }))
                    }
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
                    placeholder="Ví dụ: Áo nam, Quần nam..."
                    onChange={(event) =>
                      setLevel2Form((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                </label>

                <ImageUpload
                  label="Hình danh mục (Bắt buộc)"
                  value={level2Form.imageUrl}
                  onChange={(url) =>
                    setLevel2Form((current) => ({ ...current, imageUrl: url }))
                  }
                />

                <button
                  type="submit"
                  disabled={!level2Form.name.trim() || !level2Form.parentId}
                  className="flex w-full items-center justify-center gap-2 rounded bg-black px-5 py-3 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus size={16} />
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
                    onChange={(event) =>
                      setLevel3Form((current) => ({
                        ...current,
                        parentId: event.target.value,
                      }))
                    }
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
                    placeholder="Ví dụ: Áo thun, Áo polo..."
                    onChange={(event) =>
                      setLevel3Form((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                </label>

                <ImageUpload
                  label="Hình danh mục (Bắt buộc)"
                  value={level3Form.imageUrl}
                  onChange={(url) =>
                    setLevel3Form((current) => ({ ...current, imageUrl: url }))
                  }
                />

                <button
                  type="submit"
                  disabled={!level3Form.name.trim() || !level3Form.parentId}
                  className="flex w-full items-center justify-center gap-2 rounded bg-black px-5 py-3 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus size={16} />
                  Thêm danh mục cấp 3
                </button>
              </form>
            ) : null}
          </section>
        </aside>

        <section className="flex flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-900">
                <FolderTree size={18} />
                Cấu trúc danh mục
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={expandAll}
                  className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  Mở tất cả
                </button>
                <button
                  onClick={collapseAll}
                  className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  Thu tất cả
                </button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
              <div className="flex items-center gap-2 rounded border border-gray-300 bg-white px-3 py-2">
                <Search size={16} className="text-gray-400" />
                <input
                  className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
                  placeholder="Tìm kiếm danh mục..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <select
                className="rounded border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-600"
                value={levelFilter}
                onChange={(event) => setLevelFilter(event.target.value)}
              >
                <option value="all">Tất cả cấp</option>
                <option value="0">Chỉ cấp 1</option>
                <option value="1">Chỉ cấp 2</option>
                <option value="2">Chỉ cấp 3</option>
              </select>

              <select
                className="rounded border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-600"
                value={imageFilter}
                onChange={(event) => setImageFilter(event.target.value)}
              >
                <option value="all">Tất cả ảnh</option>
                <option value="with">Có ảnh</option>
                <option value="without">Không có ảnh</option>
              </select>
            </div>

            {(search || levelFilter !== "all" || imageFilter !== "all") && (
              <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
                <Filter size={14} />
                <span>
                  Đang lọc: {filteredTree.length} nhóm / {categories.length}{" "}
                  tổng
                </span>
                <button
                  onClick={() => {
                    setSearch("");
                    setLevelFilter("all");
                    setImageFilter("all");
                  }}
                  className="ml-auto text-blue-600 hover:underline"
                >
                  Xóa bộ lọc
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {filteredTree.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FolderTree size={48} className="mb-3 text-gray-300" />
                <p className="text-sm font-medium text-gray-600">
                  Không tìm thấy danh mục
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Thử điều chỉnh bộ lọc hoặc thêm danh mục mới
                </p>
              </div>
            ) : (
              <div className="grid gap-3">{renderTreeRows(filteredTree)}</div>
            )}
          </div>
        </section>
      </div>

      {editingId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleUpdate}
            className="grid w-full max-w-2xl gap-5 rounded-lg border border-gray-300 bg-white p-8 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-gray-200 pb-4">
              <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-900">
                <Edit2 size={18} />
                Sửa danh mục
              </h3>
              <button
                type="button"
                onClick={() => {
                  setEditingId("");
                  setEditForm(initialEditForm);
                }}
                className="text-gray-400 transition hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label className={labelClass}>
                Tên danh mục
                <input
                  className={inputClass}
                  value={editForm.name}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </label>
              <label className={labelClass}>
                Danh mục cha
                <select
                  className={inputClass}
                  value={editForm.parentId}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      parentId: event.target.value,
                    }))
                  }
                >
                  <option value="">Không có (Cấp 1)</option>
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
              onChange={(url) =>
                setEditForm((current) => ({ ...current, imageUrl: url }))
              }
            />

            <div className="flex gap-3 border-t border-gray-200 pt-4">
              <button
                type="submit"
                className="flex items-center gap-2 rounded bg-black px-6 py-3 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-gray-800"
              >
                <Edit2 size={14} />
                Lưu thay đổi
              </button>
              <button
                type="button"
                className="rounded border border-gray-300 bg-white px-6 py-3 text-xs font-bold uppercase tracking-widest text-gray-700 transition hover:bg-gray-50"
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

      {deleteConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-gray-300 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-full bg-red-100 p-3">
                <Trash2 size={24} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Xác nhận xóa
                </h3>
                <p className="text-sm text-gray-600">
                  Hành động này không thể hoàn tác
                </p>
              </div>
            </div>

            <div className="mb-6 rounded border border-gray-200 bg-gray-50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
                Danh mục sẽ bị xóa:
              </p>
              <p className="text-sm font-semibold text-gray-900">
                {deleteConfirm.name}
              </p>
              {deleteConfirm.children && deleteConfirm.children.length > 0 && (
                <p className="flex gap-2 mt-2 text-xs text-red-600 rounded-md bg-red-50 px-3 py-2">
                  <AlertTriangle className="h-4 w-4" /> Cảnh báo: Danh mục này
                  có {deleteConfirm.children.length} mục con sẽ bị xóa theo
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(deleteConfirm._id)}
                className="flex flex-1 items-center justify-center gap-2 rounded bg-red-600 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-red-700"
              >
                <Trash2 size={14} />
                Xóa ngay
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 rounded border border-gray-300 bg-white px-4 py-3 text-xs font-bold uppercase tracking-widest text-gray-700 transition hover:bg-gray-50"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
