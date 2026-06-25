const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

// Gửi 1 request nhẹ để "đánh thức" server Render khỏi trạng thái ngủ
const BACKEND_ROOT = API_BASE_URL.replace(/\/api\/?$/, "");
export function warmUpServer() {
  fetch(BACKEND_ROOT, { method: "GET", mode: "no-cors" }).catch(() => {});
}

export async function apiRequest(path, { method = "GET", body, token, isFormData = false, timeoutMs = 60000 } = {}) {
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  // Timeout để tránh chờ vô hạn khi Render cold start
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      signal: controller.signal,
      ...(body ? { body: isFormData ? body : JSON.stringify(body) } : {})
    });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw new Error("Server đang khởi động, vui lòng thử lại sau ít giây.");
    }
    throw error;
  }
  clearTimeout(timeoutId);

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  const normalizedMethod = method.toUpperCase();
  const changesCart =
    (path.startsWith("/carts/me/items") && ["POST", "PUT", "PATCH", "DELETE"].includes(normalizedMethod)) ||
    (path === "/carts/me" && ["DELETE"].includes(normalizedMethod)) ||
    (path === "/orders/checkout" && normalizedMethod === "POST");
  const changesCategories =
    path.startsWith("/categories") && ["POST", "PUT", "PATCH", "DELETE"].includes(normalizedMethod);
  const changesProducts =
    path.startsWith("/products") && ["POST", "PUT", "PATCH", "DELETE"].includes(normalizedMethod);
  const changesContact =
    path.startsWith("/contact") && ["POST", "PUT", "PATCH", "DELETE"].includes(normalizedMethod);

  if (changesCart && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("cart:changed"));
  }

  if (changesCategories && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("categories:changed"));
  }

  if (changesProducts && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("products:changed"));
  }

  if (changesContact && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("contact:changed"));
  }

  return data;
}
