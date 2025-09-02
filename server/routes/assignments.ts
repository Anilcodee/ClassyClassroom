import mongoose from "mongoose";
import { RequestHandler } from "express";
import { AuthRequest } from "../middleware/auth";
import { Assignment, Submission } from "../models/Assignment";
import { ClassModel } from "../models/Class";
import { User } from "../models/User";

function isOwnerOrCo(cls: any, userId: string) {
  return cls && (String(cls.teacher) === userId || (cls.coTeachers || []).some((t: any) => String(t) === userId));
}

export const listAssignments: RequestHandler = async (req: AuthRequest, res) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ message: "Database not connected" });
  try {
    const { id } = req.params as { id: string }; // class id
    const userId = String((req as any).userId || "");
    const user = await User.findById(userId).select("role enrolledClasses rollNo").lean();
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const cls = await ClassModel.findById(id).select("teacher coTeachers students").lean();
    if (!cls) return res.status(404).json({ message: "Class not found" });

    const teacherView = isOwnerOrCo(cls, userId);
    const now = new Date();

    let query: any = { classId: id };
    if (!teacherView) {
      const roll = String((user as any).rollNo || "");
      query.$and = [
        { $or: [{ isDraft: false }, { isDraft: { $exists: false } }] },
        { $or: [{ publishAt: null }, { publishAt: { $lte: now } }] },
        { $or: [{ allowedRollNos: { $size: 0 } }, { allowedRollNos: roll }] },
      ];
    }

    const docs = await Assignment.find(query).sort({ createdAt: -1 }).lean();
    res.json({ assignments: docs });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

export const createAssignment: RequestHandler = async (req: AuthRequest, res) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ message: "Database not connected" });
  try {
    const { id } = req.params as { id: string }; // class id
    const { title, description, type, questions, dueAt, publishAt, isDraft, allowLate, allowedRollNos } = req.body as any;

    const cls = await ClassModel.findById(id).select("teacher coTeachers").lean();
    const userId = String((req as any).userId || "");
    if (!isOwnerOrCo(cls, userId)) return res.status(403).json({ message: "Unauthorized" });

    if (!title || !String(title).trim()) return res.status(400).json({ message: "Title is required" });

    const doc = await Assignment.create({
      classId: id,
      teacherId: userId,
      title: String(title).trim(),
      description: description ? String(description) : undefined,
      type: type === "quiz" ? "quiz" : "assignment",
      questions: Array.isArray(questions) ? questions : [],
      dueAt: dueAt ? new Date(dueAt) : null,
      publishAt: publishAt ? new Date(publishAt) : null,
      isDraft: Boolean(isDraft),
      allowLate: allowLate !== false,
      allowedRollNos: Array.isArray(allowedRollNos) ? allowedRollNos.filter((x: any) => typeof x === 'string' && x.trim()).map((x: any) => x.trim()) : [],
    });

    res.status(201).json({ assignment: doc });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateAssignment: RequestHandler = async (req: AuthRequest, res) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ message: "Database not connected" });
  try {
    const { assignmentId } = req.params as { assignmentId: string };
    const a = await Assignment.findById(assignmentId);
    if (!a) return res.status(404).json({ message: "Not found" });
    const cls = await ClassModel.findById(a.classId).select("teacher coTeachers").lean();
    const userId = String((req as any).userId || "");
    if (!isOwnerOrCo(cls, userId)) return res.status(403).json({ message: "Unauthorized" });

    const payload = req.body as any;
    if (typeof payload.title === 'string') a.title = payload.title.trim() || a.title;
    if (typeof payload.description === 'string') a.description = payload.description;
    if (typeof payload.type === 'string') a.type = payload.type === 'quiz' ? 'quiz' : 'assignment';
    if (Array.isArray(payload.questions)) a.questions = payload.questions;
    if (payload.dueAt !== undefined) a.dueAt = payload.dueAt ? new Date(payload.dueAt) : null;
    if (payload.publishAt !== undefined) a.publishAt = payload.publishAt ? new Date(payload.publishAt) : null;
    if (typeof payload.isDraft === 'boolean') a.isDraft = payload.isDraft;
    if (typeof payload.allowLate === 'boolean') a.allowLate = payload.allowLate;
    if (Array.isArray(payload.allowedRollNos)) a.allowedRollNos = payload.allowedRollNos.map((x: any)=> String(x||'').trim()).filter(Boolean);

    await a.save();
    res.json({ assignment: a });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

export const getAssignment: RequestHandler = async (req: AuthRequest, res) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ message: "Database not connected" });
  try {
    const { assignmentId } = req.params as { assignmentId: string };
    const a = await Assignment.findById(assignmentId).lean();
    if (!a) return res.status(404).json({ message: "Not found" });

    // Visibility check for students
    const userId = String((req as any).userId || "");
    const user = await User.findById(userId).select("role rollNo").lean();
    const cls = await ClassModel.findById(a.classId).select("teacher coTeachers students").lean();
    if (!cls) return res.status(404).json({ message: "Class not found" });

    const teacherView = isOwnerOrCo(cls, userId);
    if (!teacherView) {
      const now = new Date();
      const roll = String((user as any)?.rollNo || "");
      const allowed = (a.allowedRollNos || []).length === 0 || (a.allowedRollNos || []).includes(roll);
      const published = !a.isDraft && (!a.publishAt || a.publishAt <= now);
      if (!allowed || !published) return res.status(403).json({ message: "Unauthorized" });
    }

    res.json({ assignment: a });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

export const submitAssignment: RequestHandler = async (req: AuthRequest, res) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ message: "Database not connected" });
  try {
    const { assignmentId } = req.params as { assignmentId: string };
    const a = await Assignment.findById(assignmentId);
    if (!a) return res.status(404).json({ message: "Not found" });

    const userId = String((req as any).userId || "");
    const u = await User.findById(userId).select("rollNo role").lean();
    if (!u) return res.status(401).json({ message: "Unauthorized" });

    // Check student
    const roll = String((u as any).rollNo || "");
    const now = new Date();
    const published = !a.isDraft && (!a.publishAt || a.publishAt <= now);
    const allowed = (a.allowedRollNos || []).length === 0 || (a.allowedRollNos || []).includes(roll);
    if (!published || !allowed) return res.status(403).json({ message: "Unauthorized" });

    const answers = (req.body as any).answers ?? {};

    if (a.dueAt && now > a.dueAt) {
      if (!a.allowLate) return res.status(400).json({ message: "Late submissions disabled" });
    }

    const status: "on_time" | "late" = a.dueAt && now > a.dueAt ? "late" : "on_time";

    const existing = await Submission.findOne({ assignmentId, userId });
    if (existing) {
      existing.answers = answers;
      existing.submittedAt = now;
      existing.status = status;
      await existing.save();
      return res.json({ submission: existing });
    }

    const sub = await Submission.create({ assignmentId, userId, answers, submittedAt: now, status });
    res.status(201).json({ submission: sub });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

export const listSubmissions: RequestHandler = async (req: AuthRequest, res) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ message: "Database not connected" });
  try {
    const { assignmentId } = req.params as { assignmentId: string };
    const a = await Assignment.findById(assignmentId).lean();
    if (!a) return res.status(404).json({ message: "Not found" });
    const cls = await ClassModel.findById(a.classId).select("teacher coTeachers").lean();
    const userId = String((req as any).userId || "");
    if (!isOwnerOrCo(cls, userId)) return res.status(403).json({ message: "Unauthorized" });

    const subs = await Submission.find({ assignmentId }).sort({ submittedAt: -1 }).lean();
    res.json({ submissions: subs });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};
