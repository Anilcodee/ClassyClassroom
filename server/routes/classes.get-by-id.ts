import { RequestHandler } from "express";
import { AuthRequest } from "../middleware/auth";
import { ClassModel } from "../models/Class";
import mongoose from "mongoose";
const ClassModelAny: any = ClassModel as any;

export const getClass: RequestHandler = async (req: AuthRequest, res) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ message: "Database not connected" });
  try {
    const { id } = req.params as { id: string };
    const cls = await ClassModel.findOne({ _id: id, $or: [ { teacher: req.userId }, { coTeachers: req.userId } ] }).lean();
    if (!cls) return res.status(404).json({ message: "Class not found" });
    res.json({ class: cls });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};
