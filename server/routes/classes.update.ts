import { RequestHandler } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../middleware/auth";
import { ClassModel } from "../models/Class";

export const updateClassDetails: RequestHandler = async (req: AuthRequest, res) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ message: "Database not connected" });
  try {
    const { id } = req.params as { id: string };
    const { name, durationMinutes, students, imageUrl } = req.body as {
      name?: string;
      durationMinutes?: number;
      students?: { name: string; rollNo: string }[];
      imageUrl?: string | null;
    };

    const cls = await ClassModel.findOne({ _id: id, teacher: (req as any).userId });
    if (!cls) return res.status(404).json({ message: "Class not found" });

    if (typeof name === 'string' && name.trim()) cls.name = name.trim();
    if (typeof durationMinutes === 'number') {
      const dm = Math.max(1, Math.min(10, Math.floor(durationMinutes)));
      cls.durationMinutes = dm;
    }
    if (Array.isArray(students)) {
      const clean = students
        .filter((s) => s && typeof s.name === 'string' && typeof s.rollNo === 'string')
        .map((s) => ({ name: s.name.trim(), rollNo: s.rollNo.trim() }))
        .filter((s) => s.name && s.rollNo);
      (cls as any).students = clean;
    }
    if (imageUrl !== undefined) {
      if (imageUrl === null) (cls as any).imageUrl = undefined;
      else (cls as any).imageUrl = imageUrl;
    }

    await cls.save();
    res.json({ class: cls });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};
