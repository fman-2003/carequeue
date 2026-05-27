import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import mongoose from "mongoose";

const uri = process.env.MONGODB_URI!;
console.log("Connecting with URI:", uri);

mongoose
  .connect(uri)
  .then(() => {
    console.log("MongoDB connected successfully ✅");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Connection failed ❌", err.message);
    process.exit(1);
  });
