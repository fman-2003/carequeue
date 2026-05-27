import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is not defined");
}

declare global {
  var mongooseCache: {
    conn: mongoose.Connection | null;
    promise: Promise<mongoose.Connection> | null;
  };
}

const cached = global.mongooseCache || { conn: null, promise: null };
global.mongooseCache = cached;

export async function connectDB() {
  // return immediately if already connected
  if (cached.conn) {
    return cached.conn;
  }

  // wait if connection still in progress so as not to start another one
  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 20000, // wait up to 20s to find a server
        socketTimeoutMS: 45000, // wait up to 45s for operations
        family: 4, // force IPv4 — fixes most DNS issues in Nigeria
      })
      .then((m) => {
        console.log("Connected to MongoDB");
        return m.connection;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
