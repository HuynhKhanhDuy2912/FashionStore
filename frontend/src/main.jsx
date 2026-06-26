import React from "react";
import ReactDOM from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { warmUpServer } from "./lib/api.js";
import "./styles.css";

// Đánh thức server Render ngay khi app load
warmUpServer();

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const routerFutureFlags = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <>
    {googleClientId ? (
      <GoogleOAuthProvider clientId={googleClientId}>
        <BrowserRouter future={routerFutureFlags}>
          <App />
        </BrowserRouter>
      </GoogleOAuthProvider>
    ) : (
      <BrowserRouter future={routerFutureFlags}>
        <App />
      </BrowserRouter>
    )}
  </>
);
