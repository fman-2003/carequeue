import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("MONGODB_URI is not set");
  process.exit(1);
}

/**
 * The full URI was printed here, which puts the database username and
 * password into the terminal, into scrollback, and into any CI log this
 * ever runs in. Only the host is shown — that is all this check needs.
 */
console.log("Connecting to:", new URL(uri).host);

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
