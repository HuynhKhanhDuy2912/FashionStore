/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "brand-bg": "#ffffff",
        "brand-surface": "#ffffff",
        "brand-surface-soft": "#fafafa",
        "brand-text": "#111111",
        "brand-muted": "#666666",
        "brand-line": "#e5e5e5",
        "brand-primary": "#000000",
        "brand-primary-deep": "#222222",
      },
      fontFamily: {
        sans: ["Inter", "Roboto", "system-ui", "-apple-system", "sans-serif"],
      },
      boxShadow: {
        brand: "none",
      },
    },
  },
  plugins: [],
};
