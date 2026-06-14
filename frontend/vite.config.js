import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    headers: {
      // Cho phép popup đăng nhập Google gọi window.postMessage về trang (GSI)
      // mà vẫn giữ cách ly cross-origin cho các cửa sổ khác.
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
  }
});
