import mongoose, { Schema, Document, Types } from "mongoose";

export interface IAttendance extends Document {
  classId: Types.ObjectId;
  date: Date;
  records: Array<{
    student: { name: string; rollNo: string };
    markedAt: Date;
  }>;
}

export interface IAttendanceSession extends Document {
  classId: Types.ObjectId;
  expiresAt: Date;
  isActive: boolean;
}

const AttendanceSchema = new Schema<IAttendance>(
  {
    classId: { type: Schema.Types.ObjectId, ref: "Class", required: true },
    date: { type: Date, default: () => new Date(), index: true },
    records: [
      new Schema(
        {
          student: {
            name: { type: String, required: true },
            rollNo: { type: String, required: true },
          },
          markedAt: { type: Date, default: () => new Date() },
        },
        { _id: false }
      ),
    ],
  },
  { timestamps: true }
);

const AttendanceSessionSchema = new Schema<IAttendanceSession>(
  {
    classId: { type: Schema.Types.ObjectId, ref: "Class", required: true },
    expiresAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Attendance =
  mongoose.models.Attendance || mongoose.model<IAttendance>("Attendance", AttendanceSchema);

export const AttendanceSession =
  mongoose.models.AttendanceSession ||
  mongoose.model<IAttendanceSession>("AttendanceSession", AttendanceSessionSchema);
