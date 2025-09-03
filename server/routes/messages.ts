import { RequestHandler } from "express";
import mongoose from "mongoose";
import { Message } from "../models/Message";
import { ClassModel } from "../models/Class";
import { AuthRequest } from "../middleware/auth";
import { User } from "../models/User";

export const listMessages: RequestHandler = async (req: AuthRequest, res) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ message: "Database not connected" });
  try {
    const { id } = req.params as { id: string };
    const msgs = await Message.find({ classId: id }).sort({ createdAt: -1 }).lean();
    const cls = await ClassModel.findById(id).select("teacher coTeachers students").lean();
    const userId = String((req as any).userId || "");
    const isOwnerOrCo = cls ? (String(cls.teacher) === userId || (cls.coTeachers||[]).some((t:any)=> String(t) === userId)) : false;
    const user = await User.findById(userId).select("enrolledClasses rollNo").lean();
    const enrolled = new Set((user?.enrolledClasses || []).map((x: any) => String(x)));
    const inRoster = (cls?.students || []).some((s: any) => String(s.rollNo) === String((user as any)?.rollNo || ""));
    const isMember = Boolean(userId) && (isOwnerOrCo || enrolled.has(String(id)) || inRoster);
    res.json({ messages: msgs.map(m => ({
      id: m._id,
      title: m.title || "",
      content: m.content,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      pinned: !!m.pinned,
      attachments: (m.attachments || []).map(a => ({ name: a.name, type: a.type, size: a.size, dataUrl: a.dataUrl })),
      comments: (m.comments || []).map(c => ({ userId: c.userId, name: c.name, content: c.content, createdAt: c.createdAt })),
      canEdit: Boolean(userId) && (String(m.teacherId) === userId || isOwnerOrCo),
      canComment: isMember && String(m.teacherId) !== userId
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

    const cls = await ClassModel.findById(id).select("teacher coTeachers students").lean();
    const userId = String((req as any).userId || "");
    const isOwnerOrCo = cls ? (String(cls.teacher) === userId || (cls.coTeachers||[]).some((t:any)=> String(t) === userId)) : false;
    // Allow any class member (teacher, co-teacher, or student in class) to post
    const user = await User.findById(userId).select("enrolledClasses rollNo").lean();
    const enrolled = new Set((user?.enrolledClasses || []).map((x: any) => String(x)));
    const inRoster = (cls?.students || []).some((s: any) => String(s.rollNo) === String((user as any)?.rollNo || ""));
    const isMember = Boolean(userId) && (isOwnerOrCo || enrolled.has(String(id)) || inRoster);
    if (!isMember) return res.status(403).json({ message: "Not a class member" });

    const msg = await Message.create({ classId: id, teacherId: (req as any).userId, title: title || undefined, content: content.trim(), pinned: !!pinned, attachments: atts, comments: [] });
    res.status(201).json({ message: { id: msg.id, title: msg.title || "", content: msg.content, createdAt: msg.createdAt, updatedAt: msg.updatedAt, pinned: !!msg.pinned, attachments: atts, comments: [], canEdit: true, canComment: false } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateMessage: RequestHandler = async (req: AuthRequest, res) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ message: "Database not connected" });
  try {
    const { messageId } = req.params as { messageId: string };
    const { title, content, attachments } = req.body as { title?: string; content?: string; attachments?: Array<{ name: string; type: string; size: number; dataUrl: string }>; };

    const update: any = {};
    if (typeof title === 'string') update.$set = { ...(update.$set||{}), title: title || undefined };
    if (typeof content === 'string') {
      const trimmed = content.trim();
      if (!trimmed) return res.status(400).json({ message: "Content is required" });
      update.$set = { ...(update.$set||{}), content: trimmed };
    }
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      const atts = attachments.slice(0, 5).map(a => ({
        name: String(a.name || "file"),
        type: String(a.type || "application/octet-stream"),
        size: Number(a.size || 0),
        dataUrl: String(a.dataUrl || ""),
      }));
      update.$push = { attachments: { $each: atts } };
    }

    const msg = await Message.findById(messageId).lean();
    if (!msg) return res.status(404).json({ message: "Message not found" });
    const cls = await ClassModel.findById(msg.classId).select("teacher coTeachers").lean();
    const userId = String((req as any).userId || "");
    const isPoster = String(msg.teacherId) === userId;
    const isOwnerOrCo = cls ? (String(cls.teacher) === userId || (cls.coTeachers||[]).some((t:any)=> String(t) === userId)) : false;
    if (!isPoster && !isOwnerOrCo) return res.status(403).json({ message: "Unauthorized" });

    const updated = await Message.findByIdAndUpdate(messageId, update, { new: true }).lean();

    res.json({ message: {
      id: updated!._id,
      title: updated!.title || "",
      content: updated!.content,
      createdAt: updated!.createdAt,
      updatedAt: updated!.updatedAt,
      pinned: !!updated!.pinned,
      attachments: (updated!.attachments || []).map(a => ({ name: a.name, type: a.type, size: a.size, dataUrl: a.dataUrl })),
      comments: (updated!.comments || []).map(c => ({ userId: c.userId, name: c.name, content: c.content, createdAt: c.createdAt })),
      canEdit: true,
      canComment: isOwner && !isPoster
    }});
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
    const userId = String((req as any).userId || "");

    const msg = await Message.findById(messageId).select("classId teacherId").lean();
    if (!msg) return res.status(404).json({ message: "Message not found" });
    // Poster cannot comment
    if (String(msg.teacherId) === userId)
      return res.status(403).json({ message: "Poster cannot comment on own message" });

    const cls = await ClassModel.findById(msg.classId).select("teacher coTeachers students").lean();
    const user = await User.findById(userId).select("name enrolledClasses rollNo").lean();
    const isOwnerOrCo = cls ? (String(cls.teacher) === userId || (cls.coTeachers||[]).some((t:any)=> String(t) === userId)) : false;
    const enrolled = new Set((user?.enrolledClasses || []).map((x: any) => String(x)));
    const inRoster = (cls?.students || []).some((s: any) => String(s.rollNo) === String((user as any)?.rollNo || ""));
    const isMember = isOwnerOrCo || enrolled.has(String(msg.classId)) || inRoster;
    if (!isMember) return res.status(403).json({ message: "Not a class member" });

    const name = user?.name || "User";
    const ret = await Message.findByIdAndUpdate(
      messageId,
      { $push: { comments: { userId, name, content: content.trim(), createdAt: new Date() } } },
      { new: true }
    ).lean();
    const added = ret!.comments[ret!.comments.length - 1];
    res.status(201).json({ comment: added });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteMessage: RequestHandler = async (req: AuthRequest, res) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ message: "Database not connected" });
  try {
    const { messageId } = req.params as { messageId: string };
    const msg = await Message.findById(messageId).lean();
    if (!msg) return res.status(404).json({ message: "Message not found" });
    const cls = await ClassModel.findById(msg.classId).select("teacher coTeachers").lean();
    const userId = String((req as any).userId || "");
    const isPoster = String(msg.teacherId) === userId;
    const isOwnerOrCo = cls ? (String(cls.teacher) === userId || (cls.coTeachers||[]).some((t:any)=> String(t) === userId)) : false;
    if (!isPoster && !isOwnerOrCo) return res.status(403).json({ message: "Unauthorized" });

    await Message.findByIdAndDelete(messageId).lean();
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};
