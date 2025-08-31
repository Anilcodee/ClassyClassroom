import mongoose, { Schema, Document, Types } from "mongoose";

export interface IUser extends Document {
  email: string;
  name: string;
  passwordHash: string;
  role: "teacher" | "student";
  rollNo?: string;
  enrolledClasses?: Types.ObjectId[];
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["teacher", "student"], default: "teacher", index: true },
    rollNo: { type: String },
    enrolledClasses: { type: [Schema.Types.ObjectId], ref: "Class", default: [] },
  },
  { timestamps: true }
);

export const User = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
