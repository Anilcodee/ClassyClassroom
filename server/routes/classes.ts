import { RequestHandler } from "express";
import { AuthRequest } from "../middleware/auth";
import { ClassModel } from "../models/Class";
import crypto from "crypto";
const ClassModelAny: any = ClassModel as any;
import mongoose from "mongoose";

export const listClasses: RequestHandler = async (req: AuthRequest, res) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ message: "Database not connected" });
  try {
    const classes = await ClassModelAny.find({
      isArchived: { $ne: true },
      $or: [{ teacher: req.userId }, { coTeachers: req.userId }],
    }).lean();
    res.json({ classes });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

export const createClass: RequestHandler = async (req: AuthRequest, res) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ message: "Database not connected" });
  try {
    const { name, students, imageUrl, durationMinutes } = req.body as {
      name: string;
      students?: { name: string; rollNo: string }[];
      imageUrl?: string;
      durationMinutes?: number;
    };
    if (!name) return res.status(400).json({ message: "Name is required" });
    const joinCode = crypto.randomBytes(4).toString("hex");
    const dm = Math.max(1, Math.min(10, Number(durationMinutes || 4)));
    const cls = await ClassModel.create({
      name,
      teacher: req.userId,
      coTeachers: [],
      students: students || [],
      joinCode,
      imageUrl,
      durationMinutes: dm,
    });
    res.status(201).json({ class: cls });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateClassImage: RequestHandler = async (
  req: AuthRequest,
  res,
) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ message: "Database not connected" });
  try {
    const { id } = req.params as { id: string };
    const { imageUrl } = req.body as { imageUrl?: string };
    if (!imageUrl)
      return res.status(400).json({ message: "imageUrl required" });
    const cls = await ClassModelAny.findOne({
      _id: id,
      $or: [{ teacher: req.userId }, { coTeachers: req.userId }],
    });
    if (!cls) return res.status(404).json({ message: "Class not found" });
    cls.imageUrl = imageUrl;
    await cls.save();
    res.json({ class: { id: cls.id, imageUrl: cls.imageUrl } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};
