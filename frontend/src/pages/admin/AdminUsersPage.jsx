import { useEffect, useState } from "react";
import AdminPageHeader from "../../components/AdminPageHeader.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { apiRequest } from "../../lib/api.js";

export default function AdminUsersPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadUsers = async () => {
    try {
      const response = await apiRequest("/users", { token });
      setUsers(response.data);
    } catch (loadError) {
      setError(loadError.message);
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
      setMessage("User updated");
      loadUsers();
    } catch (updateError) {
      setError(updateError.message);
    }
  };

  return (
    <section>
      <AdminPageHeader title="Users" description="Manage roles and account activation." />
      {message ? <p className="success-text">{message}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      <section className="card admin-panel">
        <div className="stack compact">
          {users.map((user) => (
            <div key={user._id} className="admin-list-row">
              <div>
                <strong>{user.full_name || user.username}</strong>
                <p className="muted">
                  {user.email} · {user.role} · {user.isActive ? "active" : "inactive"}
                </p>
              </div>
              <div className="inline-actions">
                <select
                  value={user.role}
                  onChange={(event) => updateUser(user, { role: event.target.value })}
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
                <button
                  className="secondary-button"
                  onClick={() => updateUser(user, { isActive: !user.isActive })}
                >
                  {user.isActive ? "Deactivate" : "Activate"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
