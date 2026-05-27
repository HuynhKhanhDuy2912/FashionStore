import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Camera, Check, Eye, EyeOff, Heart, Loader2, MapPin, User as UserIcon, Package } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { apiRequest } from "../lib/api.js";
import AddressManager from "../components/AddressManager.jsx";
import OrdersTab from "../components/OrdersTab.jsx";
import WishlistTab from "../components/WishlistTab.jsx";

const TABS = [
  { id: "account", label: "Tài khoản", icon: UserIcon },
  { id: "orders", label: "Đơn hàng", icon: Package },
  { id: "wishlist", label: "Sản phẩm yêu thích", icon: Heart },
  { id: "address", label: "Địa chỉ giao nhận", icon: MapPin }
];

const GENDER_OPTIONS = [
  { value: "male", label: "Nam" },
  { value: "female", label: "Nữ" },
  { value: "other", label: "Khác" }
];

const COLOR_OPTIONS = [
  { value: "white", label: "Trắng", hex: "#ffffff" },
  { value: "black", label: "Đen", hex: "#1A1A1A" },
  { value: "beige", label: "Be", hex: "#E8D5C4" },
  { value: "brown", label: "Nâu", hex: "#A0522D" },
  { value: "green", label: "Xanh lá", hex: "#14cc1a" },
  { value: "navy", label: "Xanh navy", hex: "#013162" },
  { value: "gray", label: "Xám", hex: "#9E9E9E" },
  { value: "blue", label: "Xanh dương", hex: "#0a06e8" },
  { value: "red", label: "Đỏ", hex: "#f22214" },
  { value: "pink", label: "Hồng", hex: "#f01b94" },
  { value: "yellow", label: "Vàng", hex: "#FFC107" },
  { value: "orange", label: "Cam", hex: "#ff6f00" }
];

const STYLE_OPTIONS = [
  { value: "minimal", label: "Minimal", labelVi: "Tối giản" },
  { value: "streetwear", label: "Streetwear", labelVi: "Đường phố" },
  { value: "casual", label: "Casual", labelVi: "Thường ngày" },
  { value: "elegant", label: "Elegant", labelVi: "Thanh lịch" },
  { value: "sporty", label: "Sporty", labelVi: "Thể thao" },
  { value: "vintage", label: "Vintage", labelVi: "Cổ điển" },
  { value: "smart_casual", label: "Smart Casual", labelVi: "Lịch sự thoải mái" }
];

export default function ProfilePage() {
  const { user, token, refreshMe } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "account";

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    fullname: "",
    email: "",
    phone_number: "",
    gender: "",
    address: "",
    avatar: "",
    favoriteColors: [],
    favoriteStyles: [],
    city: "",
    dateOfBirth: "",
    height: "",
    weight: ""
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [provinces, setProvinces] = useState([]);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    setFormData({
      fullname: user.fullname || "",
      email: user.email || "",
      phone_number: user.phone_number || "",
      gender: user.gender || "",
      address: user.address || "",
      avatar: user.avatar || "",
      favoriteColors: user.favoriteColors || [],
      favoriteStyles: user.favoriteStyles || [],
      city: user.city || "",
      dateOfBirth: user.dateOfBirth ? user.dateOfBirth.split("T")[0] : "",
      height: user.height || "",
      weight: user.weight || ""
    });
  }, [user, navigate]);

  useEffect(() => {
    fetch("https://provinces.open-api.vn/api/p/")
      .then((res) => res.json())
      .then((data) => setProvinces(data || []))
      .catch(() => setProvinces([]));
  }, []);

  const handleTabChange = (tabId) => {
    setSearchParams({ tab: tabId });
    setSuccess("");
    setError("");
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleColor = (colorValue) => {
    setFormData((prev) => {
      const colors = prev.favoriteColors || [];
      if (colors.includes(colorValue)) {
        return { ...prev, favoriteColors: colors.filter((c) => c !== colorValue) };
      }
      return { ...prev, favoriteColors: [...colors, colorValue] };
    });
  };

  const toggleStyle = (styleValue) => {
    setFormData((prev) => {
      const styles = prev.favoriteStyles || [];
      if (styles.includes(styleValue)) {
        return { ...prev, favoriteStyles: styles.filter((s) => s !== styleValue) };
      }
      return { ...prev, favoriteStyles: [...styles, styleValue] };
    });
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await apiRequest("/auth/profile", {
        method: "PUT",
        token,
        body: formData
      });

      await refreshMe();
      setSuccess("Cập nhật thông tin thành công!");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.message || "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError("Mật khẩu mới không khớp");
      setLoading(false);
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setError("Mật khẩu mới phải có ít nhất 6 ký tự");
      setLoading(false);
      return;
    }

    try {
      await apiRequest("/auth/change-password", {
        method: "PUT",
        token,
        body: {
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        }
      });

      setSuccess("Đổi mật khẩu thành công!");
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err.message || "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError("");

    try {
      const formDataUpload = new FormData();
      formDataUpload.append("images", file);

      const uploadResponse = await apiRequest("/upload", {
        method: "POST",
        token,
        body: formDataUpload,
        isFormData: true
      });

      const avatarUrl = uploadResponse.data.urls[0];

      await apiRequest("/auth/profile", {
        method: "PUT",
        token,
        body: { avatar: avatarUrl }
      });

      await refreshMe();
      setFormData((prev) => ({ ...prev, avatar: avatarUrl }));
      setSuccess("Cập nhật ảnh đại diện thành công!");
    } catch (err) {
      setError(err.message || "Có lỗi xảy ra khi tải ảnh");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-6xl mt-4">
      <h1 className="mb-2 text-2xl font-bold uppercase tracking-wide">
        {user.fullname || user.username}
      </h1>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
        <aside className="lg:col-span-1">
          <nav className="space-y-1 border border-gray-200 bg-white">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex w-full items-center gap-3 border-b border-gray-100 px-4 py-4 text-left text-l transition last:border-b-0 ${isActive
                    ? "bg-gray-100 font-semibold text-black"
                    : "text-gray-700 hover:bg-gray-50"
                    }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="lg:col-span-3">
          <div className="border border-gray-200 bg-white p-8">
            {success && (
              <div className="mb-6 flex items-center gap-2 border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                <Check className="h-5 w-5" />
                {success}
              </div>
            )}

            {error && (
              <div className="mb-6 border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                {error}
              </div>
            )}

            {activeTab === "account" && (
              <form onSubmit={handleUpdateProfile} className="space-y-8">
                <div>
                  <h2 className="mb-6 text-xl font-bold">Tài khoản</h2>

                  <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium">Họ</label>
                      <input
                        type="text"
                        name="first_name"
                        value={formData.fullname.split(" ").slice(0, -1).join(" ") || ""}
                        onChange={(e) => {
                          const firstName = e.target.value;
                          const lastName = formData.fullname.split(" ").slice(-1)[0] || "";
                          setFormData((prev) => ({ ...prev, fullname: `${firstName} ${lastName}` }));
                        }}
                        className="w-full border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium">Tên</label>
                      <input
                        type="text"
                        name="last_name"
                        value={formData.fullname.split(" ").slice(-1)[0] || ""}
                        onChange={(e) => {
                          const firstName = formData.fullname.split(" ").slice(0, -1).join(" ") || "";
                          const lastName = e.target.value;
                          setFormData((prev) => ({ ...prev, fullname: `${firstName} ${lastName}` }));
                        }}
                        className="w-full border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-2 block text-sm font-medium">Email</label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        disabled
                        className="w-full border border-gray-300 bg-gray-50 px-4 py-3 text-sm outline-none"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-2 block text-sm font-medium">Số điện thoại</label>
                      <input
                        type="tel"
                        name="phone_number"
                        value={formData.phone_number}
                        onChange={handleInputChange}
                        placeholder="0123 456 789"
                        className="w-full border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-8">
                  <h2 className="mb-6 text-xl font-bold">Thông tin cá nhân</h2>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium">Ngày sinh:</label>
                      <input
                        type="date"
                        name="dateOfBirth"
                        value={formData.dateOfBirth}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium">Giới tính:</label>
                      <select
                        name="gender"
                        value={formData.gender}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                      >
                        <option value="">Chọn giới tính</option>
                        {GENDER_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium">Chiều cao:</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          name="height"
                          value={formData.height}
                          onChange={handleInputChange}
                          placeholder="170"
                          className="w-full border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                        />
                        <span className="text-sm text-gray-500">cm</span>
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium">Cân nặng:</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          name="weight"
                          value={formData.weight}
                          onChange={handleInputChange}
                          placeholder="65"
                          className="w-full border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                        />
                        <span className="text-sm text-gray-500">kg</span>
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-2 block text-sm font-medium">Tỉnh/Thành phố:</label>
                      <select
                        name="city"
                        value={formData.city}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 px-4 py-3 text-sm outline-none focus:border-black"
                      >
                        <option value="">Chọn tỉnh/thành phố</option>
                        {provinces.map((province) => (
                          <option key={province.code} value={province.name}>
                            {province.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-8">
                  <h2 className="mb-3 text-xl font-bold">Màu sắc yêu thích</h2>
                  <p className="mb-6 text-sm text-gray-500">(Chọn một hoặc nhiều)</p>

                  <div className="grid grid-cols-4 gap-4 md:grid-cols-6">
                    {COLOR_OPTIONS.map((color) => {
                      const isSelected = formData.favoriteColors.includes(color.value);
                      return (
                        <button
                          key={color.value}
                          type="button"
                          onClick={() => toggleColor(color.value)}
                          className="flex flex-col items-center gap-2 transition"
                        >
                          <div
                            className="relative h-14 w-14 rounded-full border-2 transition"
                            style={{
                              backgroundColor: color.hex,
                              borderColor: isSelected ? "#000" : "#e5e7eb"
                            }}
                          >
                            {isSelected && (
                              <div className="absolute inset-0 grid place-items-center">
                                <Check className="h-6 w-6 text-white drop-shadow-lg" strokeWidth={3} />
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-gray-700">{color.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-8">
                  <h2 className="mb-3 text-xl font-bold">Phong cách thời trang yêu thích</h2>
                  <p className="mb-6 text-sm text-gray-500">(Chọn một hoặc nhiều)</p>

                  <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                    {STYLE_OPTIONS.map((style) => {
                      const isSelected = formData.favoriteStyles.includes(style.value);
                      return (
                        <button
                          key={style.value}
                          type="button"
                          onClick={() => toggleStyle(style.value)}
                          className={`border-2 px-6 py-4 text-left text-sm transition ${isSelected
                            ? "border-black bg-black text-white"
                            : "border-gray-200 bg-white text-gray-700 hover:border-gray-400"
                            }`}
                        >
                          <div className="font-medium">{style.label}</div>
                          <div className="mt-1 text-xs opacity-80">{style.labelVi}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {user.authProviders?.includes("email") && !user.googleId && (
                  <div className="border-t border-gray-200 pt-8">
                    <h2 className="mb-6 text-xl font-bold">Đổi mật khẩu</h2>
                    <div className="space-y-4">
                      <div>
                        <label className="mb-2 block text-sm font-medium">Mật khẩu hiện tại</label>
                        <div className="relative">
                          <input
                            type={showCurrentPassword ? "text" : "password"}
                            name="currentPassword"
                            value={passwordData.currentPassword}
                            onChange={handlePasswordChange}
                            className="w-full border border-gray-300 px-4 py-3 pr-10 text-sm outline-none focus:border-black"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                          >
                            {showCurrentPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium">Mật khẩu mới</label>
                        <div className="relative">
                          <input
                            type={showNewPassword ? "text" : "password"}
                            name="newPassword"
                            value={passwordData.newPassword}
                            onChange={handlePasswordChange}
                            className="w-full border border-gray-300 px-4 py-3 pr-10 text-sm outline-none focus:border-black"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                          >
                            {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium">Xác nhận mật khẩu mới</label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? "text" : "password"}
                            name="confirmPassword"
                            value={passwordData.confirmPassword}
                            onChange={handlePasswordChange}
                            className="w-full border border-gray-300 px-4 py-3 pr-10 text-sm outline-none focus:border-black"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                          >
                            {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleChangePassword}
                        disabled={loading || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                        className="flex items-center gap-2 bg-black px-6 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:bg-gray-300"
                      >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Đổi mật khẩu
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex justify-end border-t border-gray-200 pt-6">
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-black px-12 py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-gray-800 disabled:bg-gray-300"
                  >
                    {loading ? "Đang lưu..." : "Lưu"}
                  </button>
                </div>
              </form>
            )}

            {activeTab === "orders" && (
              <OrdersTab token={token} />
            )}

            {activeTab === "wishlist" && (
              <WishlistTab token={token} onError={(message) => setError(message)} />
            )}

            {activeTab === "address" && (
              <AddressManager token={token} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
