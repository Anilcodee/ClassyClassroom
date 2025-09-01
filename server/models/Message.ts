import mongoose, { Schema, Document, Types } from "mongoose";

export interface IMessage extends Document {
  classId: Types.ObjectId;
  teacherId: Types.ObjectId;
  title?: string;
  content: string;
  pinned?: boolean;
}

const MessageSchema = new Schema<IMessage>(
  {
    classId: { type: Schema.Types.ObjectId, ref: "Class", required: true, index: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String },
    content: { type: String, required: true },
    pinned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Message = mongoose.models.Message || mongoose.model<IMessage>("Message", MessageSchema);
