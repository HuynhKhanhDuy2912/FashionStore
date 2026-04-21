import { apiRequest } from "./api.js";

export async function fetchAdminBundle(token) {
  const [users, categories, products, variants, outfits, orders] = await Promise.all([
    apiRequest("/users", { token }),
    apiRequest("/categories", { token }),
    apiRequest("/products", { token }),
    apiRequest("/product-variants", { token }),
    apiRequest("/outfits", { token }),
    apiRequest("/orders/admin/all", { token })
  ]);

  return {
    users: users.data,
    userPagination: users.pagination,
    categories: categories.data,
    products: products.data,
    variants: variants.data,
    outfits: outfits.data,
    orders: orders.data
  };
}
