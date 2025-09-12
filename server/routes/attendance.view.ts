import { RequestHandler } from "express";
import { RequestHandler } from "express";
import mongoose from "mongoose";
import { Attendance } from "../models/Attendance";

function normalizeDate(input?: string | null) {
  if (!input) return new Date(new Date().toISOString().slice(0,10));
  const d = new Date(input);
  if (isNaN(d.getTime())) return new Date(new Date().toISOString().slice(0,10));
  return new Date(d.toISOString().slice(0,10));
}

export const getAttendanceForDate: RequestHandler = async (req, res) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ message: "Database not connected" });
  try {
    const { id } = req.params as { id: string };
    const dateParam = typeof req.query.date === 'string' ? req.query.date : undefined;
    const d = normalizeDate(dateParam);
    const dayStart = d;
    const dayEnd = new Date(dayStart.getTime() + 24*60*60*1000);
    const doc = await Attendance.findOne({ classId: id, date: { $gte: dayStart, $lt: dayEnd } }).lean();
    res.json({ date: dayStart.toISOString().slice(0,10), records: doc?.records || [] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};
