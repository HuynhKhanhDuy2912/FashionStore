import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import apiRoutes from "./routes/index.js";
import { notFoundHandler } from "./middlewares/notFound.middleware.js";
import { errorHandler } from "./middlewares/error.middleware.js";

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "*"
  })
);
app.use(helmet());
// app.use(morgan("dev")); log request HTTP
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
  return res.status(200).json({
    success: true,
    message: "FashionStore backend is running"
  });
});

app.use("/api", apiRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
