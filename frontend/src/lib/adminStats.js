import { apiRequest } from "./api.js";

export async function fetchAdminDashboardStats(token, filters = {}) {
  const params = new URLSearchParams();
  if (filters.statusFrom) params.set("statusFrom", filters.statusFrom);
  if (filters.statusTo) params.set("statusTo", filters.statusTo);

  const query = params.toString();
  const response = await apiRequest(`/orders/admin/stats${query ? `?${query}` : ""}`, { token });
  return response.data;
}

export function formatCurrency(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")} ₫`;
}

export function formatCompactCurrency(value) {
  const amount = Number(value || 0);
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return amount.toLocaleString("vi-VN");
}

export function formatPercent(value) {
  const number = Number(value || 0);
  return `${number > 0 ? "+" : ""}${number}%`;
}
