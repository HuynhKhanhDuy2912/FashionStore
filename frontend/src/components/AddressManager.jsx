import { useEffect, useState } from "react";
import { Check, Loader2, Plus, Trash2, X } from "lucide-react";
import { apiRequest } from "../lib/api.js";

export default function AddressManager({ token }) {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [wards, setWards] = useState([]);

  const [formData, setFormData] = useState({
    fullName: "",
    phoneNumber: "",
    province: "",
    district: "",
    ward: "",
    street: "",
    addressDetail: "",
    isDefault: false
  });

  useEffect(() => {
    loadAddresses();
    loadProvinces();
  }, []);

  const loadProvinces = async () => {
    try {
      const res = await fetch("https://provinces.open-api.vn/api/p/");
      const data = await res.json();
      setProvinces(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadDistricts = async (provinceCode) => {
    try {
      const res = await fetch(`https://provinces.open-api.vn/api/p/${provinceCode}?depth=2`);
      const data = await res.json();
      const districtList = data.districts || [];
      setDistricts(districtList);
      setWards([]);
      return districtList;
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  const loadWards = async (districtCode) => {
    try {
      const res = await fetch(`https://provinces.open-api.vn/api/d/${districtCode}?depth=2`);
      const data = await res.json();
      const wardList = data.wards || [];
      setWards(wardList);
      return wardList;
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  const loadAddresses = async () => {
    try {
      const response = await apiRequest("/addresses/me", { token });
      setAddresses(response.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleProvinceChange = (e) => {
    const selectedProvince = provinces.find((p) => p.name === e.target.value);
    setFormData((prev) => ({ ...prev, province: e.target.value, district: "", ward: "" }));
    if (selectedProvince) {
      loadDistricts(selectedProvince.code);
    }
  };

  const handleDistrictChange = (e) => {
    const selectedDistrict = districts.find((d) => d.name === e.target.value);
    setFormData((prev) => ({ ...prev, district: e.target.value, ward: "" }));
    if (selectedDistrict) {
      loadWards(selectedDistrict.code);
    }
  };

  const openModal = async (address = null) => {
    if (address) {
      setEditingId(address._id);
      setFormData({
        fullName: address.fullName,
        phoneNumber: address.phoneNumber,
        province: address.province,
        district: address.district,
        ward: address.ward,
        street: address.street,
        addressDetail: address.addressDetail || "",
        isDefault: address.isDefault
      });

      const selectedProvince = provinces.find((p) => p.name === address.province);
      if (selectedProvince) {
        const districtList = await loadDistricts(selectedProvince.code);
        const selectedDistrict = districtList.find((d) => d.name === address.district);
        if (selectedDistrict) {
          await loadWards(selectedDistrict.code);
        }
      }
    } else {
      setEditingId(null);
      setFormData({
        fullName: "",
        phoneNumber: "",
        province: "",
        district: "",
        ward: "",
        street: "",
        addressDetail: "",
        isDefault: false
      });
      setDistricts([]);
      setWards([]);
    }
    setShowModal(true);
    setError("");
    setSuccess("");
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (editingId) {
        await apiRequest(`/addresses/${editingId}`, {
          method: "PUT",
          token,
          body: formData
        });
        setSuccess("Cập nhật địa chỉ thành công!");
      } else {
        await apiRequest("/addresses", {
          method: "POST",
          token,
          body: formData
        });
        setSuccess("Thêm địa chỉ thành công!");
      }

      await loadAddresses();
      closeModal();
    } catch (err) {
      setError(err.message || "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Bạn có chắc muốn xóa địa chỉ này?")) return;

    try {
      await apiRequest(`/addresses/${id}`, {
        method: "DELETE",
        token
      });
      await loadAddresses();
      setSuccess("Xóa địa chỉ thành công!");
    } catch (err) {
      setError(err.message || "Có lỗi xảy ra");
    }
  };

  const handleSetDefault = async (id) => {
    try {
      await apiRequest(`/addresses/${id}/default`, {
        method: "PUT",
        token
      });
      await loadAddresses();
      setSuccess("Đã đặt làm địa chỉ mặc định!");
    } catch (err) {
      setError(err.message || "Có lỗi xảy ra");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Địa chỉ giao nhận</h2>
        <button
          type="button"
          onClick={() => openModal()}
          className="flex items-center gap-2 bg-black px-6 py-3 text-sm font-medium text-white transition hover:bg-gray-800"
        >
          <Plus className="h-4 w-4" />
          Thêm địa chỉ
        </button>
      </div>

      {success && (
        <div className="flex items-center gap-2 border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <Check className="h-5 w-5" />
          {success}
        </div>
      )}

      {error && (
        <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {addresses.length === 0 ? (
          <div className="border border-gray-200 p-8 text-center text-gray-500">
            Chưa có địa chỉ nào. Thêm địa chỉ giao hàng của bạn.
          </div>
        ) : (
          addresses.map((address) => (
            <div
              key={address._id}
              className="border border-gray-200 p-6 transition hover:border-gray-400"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-3">
                    <h3 className="font-semibold">{address.fullName}</h3>
                    {address.isDefault && (
                      <span className="border border-black bg-black px-2 py-1 text-xs text-white">
                        Mặc định
                      </span>
                    )}
                  </div>
                  <p className="mb-1 text-sm text-gray-600">{address.phoneNumber}</p>
                  <p className="text-sm text-gray-600">
                    {address.addressDetail ? `${address.addressDetail}, ` : ""}
                    {address.street}, {address.ward}, {address.district}, {address.province}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openModal(address)}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Sửa
                  </button>
                  {!address.isDefault && (
                    <>
                      <span className="text-gray-300">|</span>
                      <button
                        type="button"
                        onClick={() => handleDelete(address._id)}
                        className="text-sm text-red-600 hover:underline"
                      >
                        Xóa
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        type="button"
                        onClick={() => handleSetDefault(address._id)}
                        className="text-sm text-gray-700 hover:underline"
                      >
                        Đặt mặc định
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
              <h3 className="text-lg font-bold uppercase">
                {editingId ? "Sửa địa chỉ" : "Thêm địa chỉ"}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="text-gray-500 hover:text-black"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm">Họ</label>
                    <input
                      type="text"
                      value={formData.fullName.split(" ").slice(0, -1).join(" ") || ""}
                      onChange={(e) => {
                        const lastName = e.target.value;
                        const firstName = formData.fullName.split(" ").slice(-1)[0] || "";
                        setFormData((prev) => ({
                          ...prev,
                          fullName: firstName ? `${lastName} ${firstName}` : lastName
                        }));
                      }}
                      className="w-full border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm">Tên</label>
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName.split(" ").slice(-1)[0] || ""}
                      onChange={(e) => {
                        const firstName = e.target.value;
                        const lastName = formData.fullName.split(" ").slice(0, -1).join(" ");
                        setFormData((prev) => ({
                          ...prev,
                          fullName: lastName ? `${lastName} ${firstName}` : firstName
                        }));
                      }}
                      required
                      className="w-full border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm">Số điện thoại</label>
                  <input
                    type="tel"
                    name="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleInputChange}
                    required
                    placeholder="09xxxxxxxx"
                    className="w-full border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm">Tỉnh/Thành phố</label>
                  <select
                    name="province"
                    value={formData.province}
                    onChange={handleProvinceChange}
                    required
                    className="w-full border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
                  >
                    <option value="">Chọn tỉnh/thành phố</option>
                    {provinces.map((province) => (
                      <option key={province.code} value={province.name}>
                        {province.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm">Quận/Huyện</label>
                  <select
                    name="district"
                    value={formData.district}
                    onChange={handleDistrictChange}
                    required
                    disabled={!formData.province}
                    className="w-full border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black disabled:bg-gray-100"
                  >
                    <option value="">Chọn quận/huyện</option>
                    {districts.map((district) => (
                      <option key={district.code} value={district.name}>
                        {district.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm">Phường/Xã</label>
                  <select
                    name="ward"
                    value={formData.ward}
                    onChange={handleInputChange}
                    required
                    disabled={!formData.district}
                    className="w-full border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black disabled:bg-gray-100"
                  >
                    <option value="">Chọn phường/xã</option>
                    {wards.map((ward) => (
                      <option key={ward.code} value={ward.name}>
                        {ward.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm">
                    Tòa nhà, số nhà, tên đường
                  </label>
                  <input
                    type="text"
                    name="street"
                    value={formData.street}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm">
                    Chi tiết địa chỉ (Vd: Địa chỉ gần đó,...)
                  </label>
                  <input
                    type="text"
                    name="addressDetail"
                    value={formData.addressDetail}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isDefault"
                    name="isDefault"
                    checked={formData.isDefault}
                    onChange={handleInputChange}
                    className="h-4 w-4"
                  />
                  <label htmlFor="isDefault" className="text-sm">
                    Đặt làm địa chỉ mặc định
                  </label>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-black px-8 py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-gray-800 disabled:bg-gray-300"
                >
                  {loading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Lưu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
