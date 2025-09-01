import mongoose, { Schema, Document, Types } from "mongoose";

export interface IStudent {
  name: string;
  rollNo: string;
}

export interface IClass extends Document {
  name: string;
  teacher: Types.ObjectId;
  joinCode: string;
  students: IStudent[];
  isActive: boolean;
  activeSession?: Types.ObjectId | null;
  imageUrl?: string;
  durationMinutes: number;
}

const StudentSchema = new Schema<IStudent>(
  {
    name: { type: String, required: true },
    rollNo: { type: String, required: true },
  },
  { _id: false }
);

const ClassSchema = new Schema<IClass>(
  {
    name: { type: String, required: true },
    teacher: { type: Schema.Types.ObjectId, ref: "User", required: true },
    joinCode: { type: String, required: true, unique: true, index: true },
    students: { type: [StudentSchema], default: [] },
    isActive: { type: Boolean, default: false },
    activeSession: { type: Schema.Types.ObjectId, ref: "AttendanceSession", default: null },
    imageUrl: { type: String },
    durationMinutes: { type: Number, default: 4, min: 1, max: 10 },
  },
  { timestamps: true }
);

export const ClassModel = mongoose.models.Class || mongoose.model<IClass>("Class", ClassSchema);
