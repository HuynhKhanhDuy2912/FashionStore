import { Navigate, Route, Routes } from "react-router-dom";
import AdminLayout from "./components/AdminLayout.jsx";
import AdminRoute from "./components/AdminRoute.jsx";
import Layout from "./components/Layout.jsx";
import ProtectedRoute, { GuestRoute } from "./components/ProtectedRoute.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { CartProvider } from "./context/CartContext.jsx";
import AdminCategoriesPage from "./pages/admin/AdminCategoriesPage.jsx";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage.jsx";
import AdminOrdersPage from "./pages/admin/AdminOrdersPage.jsx";
import AdminOrderDetailPage from "./pages/admin/AdminOrderDetailPage.jsx";
import { Toaster, toast, resolveValue } from "react-hot-toast";
import { X } from "lucide-react";

import AdminProductAddPage from "./pages/admin/AdminProductAddPage.jsx";
import AdminProductListPage from "./pages/admin/AdminProductListPage.jsx";
import AdminCollectionsPage from "./pages/admin/AdminCollectionsPage.jsx";
import AdminUsersPage from "./pages/admin/AdminUsersPage.jsx";
import AdminBannersPage from "./pages/admin/AdminBannersPage.jsx";
import AdminReviewsPage from "./pages/admin/AdminReviewsPage.jsx";
import AdminSizeGuidesPage from "./pages/admin/AdminSizeGuidesPage.jsx";
import AdminInventoryPage from "./pages/admin/AdminInventoryPage.jsx";
import AdminInventoryHistoryPage from "./pages/admin/AdminInventoryHistoryPage.jsx";
import AdminContactMessagesPage from "./pages/admin/AdminContactMessagesPage.jsx";
import AdminProductQuestionsPage from "./pages/admin/AdminProductQuestionsPage.jsx";
import AdminCouponsPage from "./pages/admin/AdminCouponsPage.jsx";
import AdminAccountPage from "./pages/admin/AdminAccountPage.jsx";

import CartPage from "./pages/CartPage.jsx";
import CheckoutPage from "./pages/CheckoutPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import ProductDetailPage from "./pages/ProductDetailPage.jsx";
import ProductsPage from "./pages/ProductsPage.jsx";
import RecommendationsPage from "./pages/RecommendationsPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import CollectionsPage from "./pages/CollectionsPage.jsx";
import CollectionDetailPage from "./pages/CollectionDetailPage.jsx";
import ContactPage from "./pages/ContactPage.jsx";
import ForgotPasswordPage from "./pages/ForgotPasswordPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import PaymentSuccessPage from "./pages/PaymentSuccessPage.jsx";
import PaymentFailedPage from "./pages/PaymentFailedPage.jsx";
import PayPalCallbackPage from "./pages/PayPalCallbackPage.jsx";
import PayPalCancelPage from "./pages/PayPalCancelPage.jsx";
import OrderSuccessPage from "./pages/OrderSuccessPage.jsx";

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <Toaster position="top-right">
          {(t) => (
            <div
              role="alert"
              style={{
                opacity: t.visible ? 1 : 0,
                transform: t.visible ? "translateY(0) scale(1)" : "translateY(-10px) scale(0.95)",
                transition: "all 0.2s ease-in-out"
              }}
              className={`pointer-events-auto flex max-w-sm w-[350px] items-start gap-3 border px-4 py-3 shadow-lg ${t.type === "error"
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-green-200 bg-green-50 text-green-800"
                }`}
            >
              <div className="flex-1 text-sm font-medium">
                {resolveValue(t.message, t)}
              </div>
              <button
                type="button"
                onClick={() => toast.dismiss(t.id)}
                className="shrink-0 text-gray-400 transition hover:text-black mt-0.5"
                aria-label="Đóng thông báo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </Toaster>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
            <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
            <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/products/:productId" element={<ProductDetailPage />} />
            <Route path="/collections" element={<CollectionsPage />} />
            <Route path="/collections/:collectionId" element={<CollectionDetailPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route
              path="/recommendations"
              element={
                <ProtectedRoute>
                  <RecommendationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cart"
              element={
                <ProtectedRoute>
                  <CartPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/checkout"
              element={
                <ProtectedRoute>
                  <CheckoutPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders"
              element={<Navigate to="/profile?tab=orders" replace />}
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route path="/payment/success" element={<PaymentSuccessPage />} />
            <Route path="/payment/failed" element={<PaymentFailedPage />} />
            <Route path="/payment/paypal/callback" element={<PayPalCallbackPage />} />
            <Route path="/payment/paypal/cancel" element={<PayPalCancelPage />} />
            <Route path="/order/success" element={<OrderSuccessPage />} />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminLayout />
                </AdminRoute>
              }
            >
              <Route index element={<AdminDashboardPage />} />
              <Route path="account" element={<AdminAccountPage />} />
              <Route path="categories" element={<AdminCategoriesPage />} />
              <Route path="products" element={<AdminProductListPage />} />
              <Route path="products/list" element={<AdminProductListPage />} />
              <Route path="products/add" element={<AdminProductAddPage />} />
              <Route path="collections" element={<AdminCollectionsPage />} />

              <Route path="inventory" element={<AdminInventoryPage />} />
              <Route path="inventory/history" element={<AdminInventoryHistoryPage />} />

              <Route path="users" element={<AdminUsersPage />} />
              <Route path="orders" element={<AdminOrdersPage />} />
              <Route path="orders/:orderId" element={<AdminOrderDetailPage />} />
              <Route path="coupons" element={<AdminCouponsPage />} />
              <Route path="banners" element={<AdminBannersPage />} />
              <Route path="reviews" element={<AdminReviewsPage />} />
              <Route path="contact-messages" element={<AdminContactMessagesPage />} />
              <Route path="contact-messages/:requestId" element={<AdminContactMessagesPage />} />
              <Route path="size-guides" element={<AdminSizeGuidesPage />} />
              <Route path="product-questions" element={<AdminProductQuestionsPage />} />
            </Route>
          </Route>
        </Routes>
      </CartProvider>
    </AuthProvider>
  );
}
