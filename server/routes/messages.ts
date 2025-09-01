import { RequestHandler } from "express";
import mongoose from "mongoose";
import { Message } from "../models/Message";
import { AuthRequest } from "../middleware/auth";
import { User } from "../models/User";

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
      attachments: (m.attachments || []).map(a => ({ name: a.name, type: a.type, size: a.size, dataUrl: a.dataUrl })),
      comments: (m.comments || []).map(c => ({ userId: c.userId, name: c.name, content: c.content, createdAt: c.createdAt }))
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
    const { title, content, pinned, attachments } = req.body as { title?: string; content?: string; pinned?: boolean; attachments?: Array<{ name: string; type: string; size: number; dataUrl: string }>; };
    if (!content || content.trim().length === 0)
      return res.status(400).json({ message: "Content is required" });

    const atts = Array.isArray(attachments) ? attachments.slice(0, 5).map(a => ({
      name: String(a.name || "file"),
      type: String(a.type || "application/octet-stream"),
      size: Number(a.size || 0),
      dataUrl: String(a.dataUrl || ""),
    })) : [];

    const msg = await Message.create({ classId: id, teacherId: (req as any).userId, title: title || undefined, content: content.trim(), pinned: !!pinned, attachments: atts, comments: [] });
    res.status(201).json({ message: { id: msg.id, title: msg.title || "", content: msg.content, createdAt: msg.createdAt, pinned: !!msg.pinned, attachments: atts, comments: [] } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

export const addComment: RequestHandler = async (req: AuthRequest, res) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ message: "Database not connected" });
  try {
    const { messageId } = req.params as { messageId: string };
    const { content } = req.body as { content?: string };
    if (!content || !content.trim()) return res.status(400).json({ message: "Content is required" });
    const userId = (req as any).userId as string;
    const user = await User.findById(userId).select("name").lean();
    const name = user?.name || "User";
    const ret = await Message.findByIdAndUpdate(
      messageId,
      { $push: { comments: { userId, name, content: content.trim(), createdAt: new Date() } } },
      { new: true }
    ).lean();
    if (!ret) return res.status(404).json({ message: "Message not found" });
    const added = ret.comments[ret.comments.length - 1];
    res.status(201).json({ comment: added });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};
