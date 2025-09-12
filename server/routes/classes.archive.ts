import { RequestHandler } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../middleware/auth";
import { ClassModel } from "../models/Class";
const ClassModelAny: any = ClassModel as any;

export const archiveClass: RequestHandler = async (req: AuthRequest, res) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ message: "Database not connected" });
  try {
    const { id } = req.params as { id: string };
    const cls = await ClassModel.findOne({
      _id: id,
      $or: [{ teacher: req.userId }, { coTeachers: req.userId }],
    });
    if (!cls) return res.status(404).json({ message: "Class not found" });
    (cls as any).isArchived = true;
    await cls.save();
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};
