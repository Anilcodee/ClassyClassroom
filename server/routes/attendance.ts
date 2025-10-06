import { RequestHandler } from "express";
import { Attendance, AttendanceSession } from "../models/Attendance";
import { ClassModel } from "../models/Class";
import { AuthRequest } from "../middleware/auth";
import mongoose from "mongoose";
const AttendanceModelAny: any = Attendance as any;
const AttendanceSessionModelAny: any = AttendanceSession as any;
const ClassModelAny: any = ClassModel as any;

export const activateClass: RequestHandler = async (req: AuthRequest, res) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ message: "Database not connected" });
  try {
    const { id } = req.params as { id: string };
    const cls = await ClassModelAny.findOne({ _id: id, $or: [ { teacher: req.userId }, { coTeachers: req.userId } ] });
    if (!cls) return res.status(404).json({ message: "Class not found" });

    // If already active and session not expired, return existing
    if (cls.isActive && cls.activeSession) {
      const existing = await AttendanceSessionModelAny.findById(cls.activeSession);
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

    const minutes = Math.max(1, Math.min(10, (cls as any).durationMinutes || 4));
    const expiresAt = new Date(Date.now() + minutes * 60 * 1000);
    const session = await AttendanceSessionModelAny.create({ classId: cls.id, expiresAt, isActive: true });
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
    const session = await AttendanceSessionModelAny.findById(sessionId);
    if (!session) return res.status(404).json({ message: "Session not found" });
    const now = new Date();
    if (now > session.expiresAt && session.isActive) {
      session.isActive = false;
      await session.save();
      await ClassModelAny.updateOne({ _id: session.classId }, { isActive: false, activeSession: null });
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
    const session = await AttendanceSessionModelAny.findById(sessionId);
    if (!session || !session.isActive) return res.status(400).json({ message: "Session inactive" });
    const date = new Date();
    const key = date.toISOString().slice(0, 10);
    let attendance = await AttendanceModelAny.findOne({ classId: session.classId, date: { $gte: new Date(key), $lt: new Date(new Date(key).getTime() + 24*60*60*1000) } });
    if (!attendance) attendance = await AttendanceModelAny.create({ classId: session.classId, date: new Date(key), records: [] });
    attendance.records.push({ student: { name, rollNo }, markedAt: new Date() });
    await attendance.save();
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

export const manualMarkAttendance: RequestHandler = async (req: AuthRequest, res) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ message: "Database not connected" });
  try {
    const { id } = req.params as { id: string };
    const { name, rollNo, present } = req.body as { name: string; rollNo: string; present: boolean };
    if (!name || !rollNo) return res.status(400).json({ message: "Missing student info" });

    const cls = await ClassModelAny.findById(id).select("teacher coTeachers").lean();
    const userId = String((req as any).userId || "");
    const isOwnerOrCo = cls && (String(cls.teacher) === userId || (cls.coTeachers||[]).some((t:any)=> String(t) === userId));
    if (!isOwnerOrCo) return res.status(403).json({ message: "Unauthorized" });

    const todayKey = new Date().toISOString().slice(0,10);
    const dayStart = new Date(todayKey);
    const dayEnd = new Date(dayStart.getTime() + 24*60*60*1000);
    let doc = await AttendanceModelAny.findOne({ classId: id, date: { $gte: dayStart, $lt: dayEnd } });
    if (!doc) doc = await AttendanceModelAny.create({ classId: id, date: dayStart, records: [] });

    const idx = doc.records.findIndex(r => String(r.student.rollNo) === String(rollNo));
    if (present) {
      if (idx === -1) {
        doc.records.push({ student: { name, rollNo }, markedAt: new Date() });
      } else {
        doc.records[idx].student.name = name;
      }
    } else {
      if (idx !== -1) {
        doc.records.splice(idx, 1);
      }
    }

    await doc.save();
    res.json({ records: doc.records });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};
