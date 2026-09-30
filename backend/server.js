import dotenv from "dotenv";

dotenv.config({ quiet: true });

import app from "./app.js";
import { connectDatabase } from "./config/db.js";

const PORT = Number(process.env.PORT) || 5000;

const startServer = async () => {
  await connectDatabase();

  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
};

startServer();
