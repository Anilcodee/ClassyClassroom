import { RequestHandler } from "express";
import mongoose from "mongoose";
import { Message } from "../models/Message";
import { AuthRequest } from "../middleware/auth";

export const listMessages: RequestHandler = async (req: AuthRequest, res) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ message: "Database not connected" });
  try {
    const { id } = req.params as { id: string };
    const msgs = await Message.find({ classId: id }).sort({ createdAt: -1 }).lean();
    res.json({ messages: msgs.map(m => ({
      id: m._id,
      title: m.title || "",
      content: m.content,
      createdAt: m.createdAt,
      pinned: !!m.pinned,
    })) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

export const createMessage: RequestHandler = async (req: AuthRequest, res) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ message: "Database not connected" });
  try {
    const { id } = req.params as { id: string };
    const { title, content, pinned } = req.body as { title?: string; content?: string; pinned?: boolean };
    if (!content || content.trim().length === 0)
      return res.status(400).json({ message: "Content is required" });
    const msg = await Message.create({ classId: id, teacherId: (req as any).userId, title: title || undefined, content: content.trim(), pinned: !!pinned });
    res.status(201).json({ message: { id: msg.id, title: msg.title || "", content: msg.content, createdAt: msg.createdAt, pinned: !!msg.pinned } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};
