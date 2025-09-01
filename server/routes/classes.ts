import { RequestHandler } from "express";
import { AuthRequest } from "../middleware/auth";
import { ClassModel } from "../models/Class";
import crypto from "crypto";
import mongoose from "mongoose";

export const listClasses: RequestHandler = async (req: AuthRequest, res) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ message: "Database not connected" });
  try {
    const classes = await ClassModel.find({ teacher: req.userId }).lean();
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
    const { name, students, imageUrl } = req.body as { name: string; students?: { name: string; rollNo: string }[]; imageUrl?: string };
    if (!name) return res.status(400).json({ message: "Name is required" });
    const joinCode = crypto.randomBytes(4).toString("hex");
    const cls = await ClassModel.create({ name, teacher: req.userId, students: students || [], joinCode, imageUrl });
    res.status(201).json({ class: cls });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};
