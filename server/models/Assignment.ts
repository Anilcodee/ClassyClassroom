import mongoose, { Schema, Types, Document } from "mongoose";

export interface IQuestion {
  text: string;
  type: "short" | "mcq";
  options?: string[];
  correct?: number[]; // indices for mcq
}

export interface IAttachment { name: string; type: string; size: number; dataUrl: string }

export interface IAssignment extends Document {
  classId: Types.ObjectId;
  teacherId: Types.ObjectId;
  title: string;
  description?: string;
  type: "assignment" | "quiz";
  questions: IQuestion[];
  attachments: IAttachment[];
  dueAt?: Date | null;
  publishAt?: Date | null;
  isDraft: boolean;
  allowLate: boolean;
  allowedRollNos?: string[]; // if set, only these students see/submit
}

const QuestionSchema = new Schema<IQuestion>({
  text: { type: String, required: true },
  type: { type: String, enum: ["short", "mcq"], default: "short" },
  options: { type: [String], default: [] },
  correct: { type: [Number], default: [] },
}, { _id: false });

const AssignmentSchema = new Schema<IAssignment>({
  classId: { type: Schema.Types.ObjectId, ref: "Class", index: true, required: true },
  teacherId: { type: Schema.Types.ObjectId, ref: "User", index: true, required: true },
  title: { type: String, required: true },
  description: { type: String },
  type: { type: String, enum: ["assignment", "quiz"], default: "assignment" },
  questions: { type: [QuestionSchema], default: [] },
  attachments: { type: [{ name: String, type: String, size: Number, dataUrl: String }], default: [] },
  dueAt: { type: Date, default: null },
  publishAt: { type: Date, default: null },
  isDraft: { type: Boolean, default: true },
  allowLate: { type: Boolean, default: true },
  allowedRollNos: { type: [String], default: [] },
}, { timestamps: true });

export const Assignment = mongoose.models.Assignment || mongoose.model<IAssignment>("Assignment", AssignmentSchema);

export interface ISubmission extends Document {
  assignmentId: Types.ObjectId;
  userId: Types.ObjectId;
  answers: any;
  submittedAt: Date;
  status: "on_time" | "late" | "closed";
}

const SubmissionSchema = new Schema<ISubmission>({
  assignmentId: { type: Schema.Types.ObjectId, ref: "Assignment", index: true, required: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", index: true, required: true },
  answers: { type: Schema.Types.Mixed },
  submittedAt: { type: Date, default: () => new Date() },
  status: { type: String, enum: ["on_time", "late", "closed"], default: "on_time" },
}, { timestamps: true });

SubmissionSchema.index({ assignmentId: 1, userId: 1 }, { unique: true });

export const Submission = mongoose.models.Submission || mongoose.model<ISubmission>("Submission", SubmissionSchema);
