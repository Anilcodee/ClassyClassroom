import { RequestHandler } from "express";
import { Attendance, AttendanceSession } from "../models/Attendance";
import { ClassModel } from "../models/Class";
import { AuthRequest } from "../middleware/auth";
import mongoose from "mongoose";

export const activateClass: RequestHandler = async (req: AuthRequest, res) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ message: "Database not connected" });
  try {
    const { id } = req.params as { id: string };
    const cls = await ClassModel.findOne({ _id: id, teacher: req.userId });
    if (!cls) return res.status(404).json({ message: "Class not found" });

    // If already active and session not expired, return existing
    if (cls.isActive && cls.activeSession) {
      const existing = await AttendanceSession.findById(cls.activeSession);
      if (existing && existing.isActive && existing.expiresAt > new Date()) {
        return res.json({ sessionId: existing.id, expiresAt: existing.expiresAt });
      }
      // Cleanup if expired
      if (existing && existing.expiresAt <= new Date()) {
        existing.isActive = false;
        await existing.save();
      }
      cls.isActive = false;
      cls.activeSession = null;
      await cls.save();
    }

    const expiresAt = new Date(Date.now() + 4 * 60 * 1000);
    const session = await AttendanceSession.create({ classId: cls.id, expiresAt, isActive: true });
    cls.isActive = true;
    cls.activeSession = session._id;
    await cls.save();
    res.json({ sessionId: session.id, expiresAt });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

export const sessionStatus: RequestHandler = async (req, res) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ message: "Database not connected" });
  try {
    const { sessionId } = req.params as { sessionId: string };
    const session = await AttendanceSession.findById(sessionId);
    if (!session) return res.status(404).json({ message: "Session not found" });
    const now = new Date();
    if (now > session.expiresAt && session.isActive) {
      session.isActive = false;
      await session.save();
      await ClassModel.updateOne({ _id: session.classId }, { isActive: false, activeSession: null });
    }
    res.json({ isActive: session.isActive, expiresAt: session.expiresAt });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

export const markAttendance: RequestHandler = async (req, res) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ message: "Database not connected" });
  try {
    const { sessionId } = req.params as { sessionId: string };
    const { name, rollNo } = req.body as { name: string; rollNo: string };
    const session = await AttendanceSession.findById(sessionId);
    if (!session || !session.isActive) return res.status(400).json({ message: "Session inactive" });
    const date = new Date();
    const key = date.toISOString().slice(0, 10);
    let attendance = await Attendance.findOne({ classId: session.classId, date: { $gte: new Date(key), $lt: new Date(new Date(key).getTime() + 24*60*60*1000) } });
    if (!attendance) attendance = await Attendance.create({ classId: session.classId, date: new Date(key), records: [] });
    attendance.records.push({ student: { name, rollNo }, markedAt: new Date() });
    await attendance.save();
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};
