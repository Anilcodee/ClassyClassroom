import { RequestHandler } from "express";
import { RequestHandler } from "express";
import mongoose from "mongoose";
import { Attendance } from "../models/Attendance";
import { AuthRequest } from "../middleware/auth";

export const getTodayAttendance: RequestHandler = async (req: AuthRequest, res) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ message: "Database not connected" });
  try {
    const { id } = req.params as { id: string };
    const today = new Date();
    const key = today.toISOString().slice(0, 10);
    const doc = await Attendance.findOne({
      classId: id,
      date: { $gte: new Date(key), $lt: new Date(new Date(key).getTime() + 24 * 60 * 60 * 1000) },
    }).lean();
    res.json({ records: doc?.records || [] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};
