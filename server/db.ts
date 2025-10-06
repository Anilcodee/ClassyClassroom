import mongoose from "mongoose";

export async function connectDB(uri?: string) {
  const mongoUri =
    uri || process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL;
  if (!mongoUri) {
    console.warn("MONGO_URI not set. Database features will be disabled.");
    return;
  }
  try {
    mongoose.set("strictQuery", true);
    // Avoid buffering so app fails fast with clear errors
    mongoose.set("bufferCommands", false);
    await mongoose.connect(mongoUri);
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    throw err;
  }
}
