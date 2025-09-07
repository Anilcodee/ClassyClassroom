import mongoose from "mongoose";
import { RequestHandler } from "express";
import { AuthRequest } from "../middleware/auth";
import { Assignment, Submission } from "../models/Assignment";
import { ClassModel } from "../models/Class";
import { User } from "../models/User";
import { Message } from "../models/Message";

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

    const status = String((req.query as any).status || 'published');

    let query: any = { classId: id };
    if (status === 'drafts') {
      if (!teacherView) return res.status(403).json({ message: 'Unauthorized' });
      query.$and = [ { $or: [{ isDraft: true }] } ];
    } else {
      const andConds: any[] = [
        { $or: [{ isDraft: false }, { isDraft: { $exists: false } }] },
        { $or: [{ publishAt: null }, { publishAt: { $lte: now } }] },
      ];
      if (!teacherView) {
        const roll = String((user as any).rollNo || "");
        andConds.push({ $or: [{ allowedRollNos: { $size: 0 } }, { allowedRollNos: roll }] });
      }
      query.$and = andConds;
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
    const { title, description, type, questions, dueAt, publishAt, points, isDraft, allowLate, allowedRollNos, attachments } = req.body as any;

    const cls = await ClassModel.findById(id).select("teacher coTeachers").lean();
    const userId = String((req as any).userId || "");
    if (!isOwnerOrCo(cls, userId)) return res.status(403).json({ message: "Unauthorized" });

    if (!title || !String(title).trim()) return res.status(400).json({ message: "Title is required" });

    const atts = Array.isArray(attachments) ? attachments.slice(0, 5).map((a:any)=> ({
      name: String(a.name || 'file'),
      type: String(a.type || 'application/octet-stream'),
      size: Number(a.size || 0),
      dataUrl: String(a.dataUrl || ''),
    })) : [];

    const doc = await Assignment.create({
      classId: id,
      teacherId: userId,
      title: String(title).trim(),
      description: description ? String(description) : undefined,
      type: type === "quiz" ? "quiz" : "assignment",
      questions: Array.isArray(questions) ? questions : [],
      attachments: atts,
      dueAt: dueAt ? new Date(dueAt) : null,
      publishAt: publishAt ? new Date(publishAt) : null,
      points: typeof points === 'number' ? points : (typeof points === 'string' && points.trim() ? Number(points) : 100),
      isDraft: Boolean(isDraft),
      allowLate: allowLate !== false,
      allowedRollNos: Array.isArray(allowedRollNos) ? allowedRollNos.filter((x: any) => typeof x === 'string' && x.trim()).map((x: any) => x.trim()) : [],
    });

    // Auto-post only if published now (not draft and publishAt <= now)
    try {
      const nowIso = new Date();
      const published = !doc.isDraft && (!doc.publishAt || doc.publishAt <= nowIso);
      if (published) {
        const fmt = (v?: Date | null) => {
          if (!v) return "";
          const d = new Date(v);
          const dd = String(d.getDate()).padStart(2, '0');
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const yyyy = d.getFullYear();
          const hh = String(d.getHours()).padStart(2, '0');
          const mi = String(d.getMinutes()).padStart(2, '0');
          return `${dd}-${mm}-${yyyy}, ${hh}:${mi}`;
        };
        const parts: string[] = [];
        parts.push(`${doc.type === 'quiz' ? 'Quiz' : 'Assignment'}: ${doc.title}`);
        if (doc.dueAt) parts.push(`Due on ${fmt(doc.dueAt)}`);
        const content = [doc.description || "", parts.join(" | ")].filter(Boolean).join("\n\n");
        await Message.create({ classId: id, teacherId: userId, title: doc.type === 'quiz' ? `Quiz: ${doc.title}` : `Assignment: ${doc.title}`, content: content || (doc.type === 'quiz' ? 'New quiz assigned.' : 'New assignment assigned.'), attachments: atts.slice(0, 5), comments: [] });
      }
    } catch (e) {
      console.error('Failed to post assignment message', e);
    }

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
    if (Array.isArray(payload.attachments) && payload.attachments.length > 0) {
      const atts = payload.attachments.slice(0,5).map((a:any)=> ({
        name: String(a.name || 'file'), type: String(a.type || 'application/octet-stream'), size: Number(a.size || 0), dataUrl: String(a.dataUrl || '')
      }));
      (a as any).attachments = [ ...((a as any).attachments || []), ...atts ].slice(0, 5);
    }
    if (payload.dueAt !== undefined) a.dueAt = payload.dueAt ? new Date(payload.dueAt) : null;
    if (payload.publishAt !== undefined) a.publishAt = payload.publishAt ? new Date(payload.publishAt) : null;
    if (typeof payload.isDraft === 'boolean') a.isDraft = payload.isDraft;
    if (typeof payload.allowLate === 'boolean') a.allowLate = payload.allowLate;
    if (Array.isArray(payload.allowedRollNos)) a.allowedRollNos = payload.allowedRollNos.map((x: any)=> String(x||'').trim()).filter(Boolean);

    const wasDraft = a.isDraft;
    const prevPublishAt = a.publishAt ? new Date(a.publishAt) : null;
    await a.save();

    // If it just became published (not draft and publishAt <= now), post a message
    try {
      const now = new Date();
      const nowPublished = !a.isDraft && (!a.publishAt || a.publishAt <= now);
      const wasPublished = !wasDraft && (!!prevPublishAt ? prevPublishAt <= now : true);
      if (nowPublished && !wasPublished) {
        const atts = (a as any).attachments || [];
        const fmt = (v?: Date | null) => {
          if (!v) return "";
          const d = new Date(v);
          const dd = String(d.getDate()).padStart(2, '0');
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const yyyy = d.getFullYear();
          const hh = String(d.getHours()).padStart(2, '0');
          const mi = String(d.getMinutes()).padStart(2, '0');
          return `${dd}-${mm}-${yyyy}, ${hh}:${mi}`;
        };
        const parts: string[] = [];
        parts.push(`${a.type === 'quiz' ? 'Quiz' : 'Assignment'}: ${a.title}`);
        if (a.dueAt) parts.push(`Due on ${fmt(a.dueAt)}`);
        const content = [a.description || "", parts.join(" | ")].filter(Boolean).join("\n\n");
        await Message.create({ classId: a.classId, teacherId: (req as any).userId, title: a.type === 'quiz' ? `Quiz: ${a.title}` : `Assignment: ${a.title}`, content, attachments: atts.slice(0, 5), comments: [] });
      }
    } catch (e) { console.error('Failed to post assignment message on publish', e); }

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

    const body = (req.body as any) || {};
    const answers = body.answers ?? {};
    const attachments = Array.isArray(body.attachments) ? body.attachments.slice(0, 5).map((a:any)=> ({
      name: String(a.name || 'file'),
      type: String(a.type || 'application/octet-stream'),
      size: Number(a.size || 0),
      dataUrl: String(a.dataUrl || ''),
    })) : [];

    if (a.dueAt && now > a.dueAt) {
      if (!a.allowLate) return res.status(400).json({ message: "Late submissions disabled" });
    }

    const status: "on_time" | "late" = a.dueAt && now > a.dueAt ? "late" : "on_time";

    const existing = await Submission.findOne({ assignmentId, userId });
    if (existing) {
      existing.answers = answers;
      (existing as any).attachments = attachments;
      existing.submittedAt = now;
      existing.status = status;
      await existing.save();
      return res.json({ submission: existing });
    }

    const sub = await Submission.create({ assignmentId, userId, answers, attachments, submittedAt: now, status });
    res.status(201).json({ submission: sub });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteAssignment: RequestHandler = async (req: AuthRequest, res) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ message: "Database not connected" });
  try {
    const { assignmentId } = req.params as { assignmentId: string };
    const a = await Assignment.findById(assignmentId);
    if (!a) return res.status(404).json({ message: "Not found" });
    const cls = await ClassModel.findById(a.classId).select("teacher coTeachers").lean();
    const userId = String((req as any).userId || "");
    if (!isOwnerOrCo(cls, userId)) return res.status(403).json({ message: "Unauthorized" });
    await Assignment.findByIdAndDelete(assignmentId);
    res.json({ ok: true });
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
