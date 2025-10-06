import { RequestHandler } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../middleware/auth";
import { Attendance } from "../models/Attendance";
import { User } from "../models/User";
const UserModelAny: any = User as any;
const AttendanceModelAny: any = Attendance as any;

export const getStudentAttendance: RequestHandler = async (req: AuthRequest, res) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ message: "Database not connected" });
  try {
    const { id } = req.params as { id: string };
    const userId = (req as any).userId as string;
    const user = await User.findById(userId).select("role isStudent enrolledClasses rollNo").lean();
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const isStudent = (user as any).role === "student" || (user as any).isStudent;
    if (!isStudent) return res.status(403).json({ message: "Forbidden" });
    const rollNo = (user as any).rollNo || "";
    if (!rollNo) return res.status(400).json({ message: "Missing roll number" });
    const enrolled = new Set(((user as any).enrolledClasses || []).map((x: any) => String(x)));
    if (!enrolled.has(String(id))) return res.status(403).json({ message: "Not enrolled in class" });

    const days = await Attendance.find({ classId: id }).select("date records.student markedAt").sort({ date: 1 }).lean();
    const items = days.map((d) => ({
      date: d.date.toISOString().slice(0,10),
      present: (d.records || []).some((r: any) => String(r.student.rollNo) === String(rollNo))
    }));
    res.json({ items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};
