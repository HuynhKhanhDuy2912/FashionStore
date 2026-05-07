import { useEffect, useState } from "react";
import AdminPageHeader from "../../components/AdminPageHeader.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { apiRequest } from "../../lib/api.js";
import toast from "react-hot-toast";

export default function AdminUsersPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);

  const loadUsers = async () => {
    try {
      const response = await apiRequest("/users", { token });
      setUsers(response.data);
    } catch (loadError) {
      toast.error(loadError.message);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [token]);

  const updateUser = async (user, changes) => {
    try {
      await apiRequest(`/users/${user._id}`, {
        method: "PUT",
        token,
        body: {
          ...user,
          ...changes
        }
      });
      toast.success("Đã cập nhật người dùng");
      loadUsers();
    } catch (updateError) {
      toast.error(updateError.message);
    }
  };

  return (
    <section className="grid gap-6">
      <AdminPageHeader title="NGƯỜI DÙNG" description="Quản lý phân quyền và kích hoạt tài khoản." />
      <section className="bg-white border border-gray-200 p-7">
        <h3 className="text-black text-sm m-0 mb-6 pb-4 border-b border-gray-200 font-bold uppercase tracking-widest">DANH SÁCH NGƯỜI DÙNG</h3>
        <div className="grid gap-0 divide-y divide-gray-100">
          {users.map((user) => (
            <div key={user._id} className="flex justify-between gap-4 py-4 items-center hover:bg-gray-50 transition-colors px-2">
              <div>
                <strong className="block text-black mb-1 text-sm">{user.full_name || user.username}</strong>
                <p className="m-0 text-xs text-gray-500 uppercase tracking-widest">
                  {user.email} · <span className="font-bold text-black">{user.role === 'admin' ? 'QUẢN TRỊ VIÊN' : 'NGƯỜI DÙNG'}</span> ·{" "}
                  <span className={user.isActive ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                    {user.isActive ? "HOẠT ĐỘNG" : "BỊ KHÓA"}
                  </span>
                </p>
              </div>
              <div className="flex gap-3 items-center shrink-0">
                <select
                  className="border border-gray-300 px-3 py-2 bg-white text-black font-bold uppercase tracking-widest transition-colors text-xs focus:border-black focus:outline-none cursor-pointer"
                  value={user.role}
                  onChange={(event) => updateUser(user, { role: event.target.value })}
                >
                  <option value="user">NGƯỜI DÙNG</option>
                  <option value="admin">QUẢN TRỊ VIÊN</option>
                </select>
                <button
                  className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer border ${user.isActive ? "text-red-600 bg-white border-red-600 hover:bg-red-600 hover:text-white" : "text-green-600 bg-white border-green-600 hover:bg-green-600 hover:text-white"}`}
                  onClick={() => updateUser(user, { isActive: !user.isActive })}
                >
                  {user.isActive ? "KHÓA TÀI KHOẢN" : "KÍCH HOẠT"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
