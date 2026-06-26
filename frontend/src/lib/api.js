const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

// Gửi 1 request nhẹ để "đánh thức" server Render khỏi trạng thái ngủ
const BACKEND_ROOT = API_BASE_URL.replace(/\/api\/?$/, "");
export function warmUpServer() {
  fetch(BACKEND_ROOT, { method: "GET", mode: "no-cors" }).catch(() => {});
}

// Số lần retry tối đa khi gặp lỗi cold start
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 2000; // 2 giây

// Kiểm tra xem lỗi có phải do cold start / server chưa sẵn sàng
function isColdStartError(error, response) {
  if (error?.name === "AbortError") return true;
  if (error?.message?.includes("Failed to fetch")) return true;
  if (error?.message?.includes("NetworkError")) return true;
  if (error?.message?.includes("Load failed")) return true;
  if (response && [502, 503, 504].includes(response.status)) return true;
  return false;
}

// Delay helper
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function apiRequest(
  path,
  { method = "GET", body, token, isFormData = false, timeoutMs = 60000 } = {},
) {
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Nếu đây là lần retry, đợi với exponential backoff
    if (attempt > 0) {
      const retryDelay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      console.log(
        `[API] Retry ${attempt}/${MAX_RETRIES} cho ${method} ${path} sau ${retryDelay}ms...`,
      );
      await delay(retryDelay);
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
        ...(body ? { body: isFormData ? body : JSON.stringify(body) } : {}),
      });
    } catch (error) {
      clearTimeout(timeoutId);

      // Nếu là lỗi cold start và còn lần retry → thử lại
      if (isColdStartError(error, null) && attempt < MAX_RETRIES) {
        lastError = error;
        continue;
      }

      if (error.name === "AbortError") {
        throw new Error("Server đang khởi động, vui lòng thử lại sau ít giây.");
      }
      throw error;
    }
    clearTimeout(timeoutId);

    // Xử lý lỗi gateway (502, 503, 504) - Render trả về khi cold start
    if ([502, 503, 504].includes(response.status) && attempt < MAX_RETRIES) {
      lastError = new Error(`Server trả về ${response.status}`);
      continue;
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Request failed");
    }

    // Log nếu retry thành công
    if (attempt > 0) {
      console.log(
        `[API] Request thành công sau ${attempt} lần retry: ${method} ${path}`,
      );
    }

    const normalizedMethod = method.toUpperCase();
    const changesCart =
      (path.startsWith("/carts/me/items") &&
        ["POST", "PUT", "PATCH", "DELETE"].includes(normalizedMethod)) ||
      (path === "/carts/me" && ["DELETE"].includes(normalizedMethod)) ||
      (path === "/orders/checkout" && normalizedMethod === "POST");
    const changesCategories =
      path.startsWith("/categories") &&
      ["POST", "PUT", "PATCH", "DELETE"].includes(normalizedMethod);
    const changesProducts =
      path.startsWith("/products") &&
      ["POST", "PUT", "PATCH", "DELETE"].includes(normalizedMethod);
    const changesContact =
      path.startsWith("/contact") &&
      ["POST", "PUT", "PATCH", "DELETE"].includes(normalizedMethod);

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

  // Nếu hết retry mà vẫn lỗi
  throw new Error("Server đang khởi động, vui lòng thử lại sau ít giây.");
}
