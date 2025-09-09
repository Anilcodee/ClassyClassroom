import mongoose, { Schema, Document, Types } from "mongoose";

export interface IMessageAttachment {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}

export interface IMessageComment {
  userId: Types.ObjectId;
  name: string;
  content: string;
  createdAt: Date;
}

export interface IMessage extends Document {
  classId: Types.ObjectId;
  teacherId: Types.ObjectId;
  title?: string;
  content: string;
  pinned?: boolean;
  attachments: IMessageAttachment[];
  comments: IMessageComment[];
  assignmentId?: Types.ObjectId;
}

const AttachmentSchema = new Schema<IMessageAttachment>(
  {
    name: { type: String, required: true },
    type: { type: String, required: true },
    size: { type: Number, required: true },
    dataUrl: { type: String, required: true },
  },
  { _id: false }
);

const CommentSchema = new Schema<IMessageComment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const MessageSchema = new Schema<IMessage>(
  {
    classId: { type: Schema.Types.ObjectId, ref: "Class", required: true, index: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String },
    content: { type: String, required: true },
    pinned: { type: Boolean, default: false },
    attachments: { type: [AttachmentSchema], default: [] },
    comments: { type: [CommentSchema], default: [] },
    assignmentId: { type: Schema.Types.ObjectId, ref: 'Assignment', required: false },
  },
  { timestamps: true }
);

export const Message = mongoose.models.Message || mongoose.model<IMessage>("Message", MessageSchema);
