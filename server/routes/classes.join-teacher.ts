import mongoose from "mongoose";
import { RequestHandler } from "express";
import { AuthRequest } from "../middleware/auth";
import { User } from "../models/User";
import { ClassModel } from "../models/Class";
const UserModelAny: any = User as any;
const ClassModelAny: any = ClassModel as any;

export const joinClassAsTeacher: RequestHandler = async (
  req: AuthRequest,
  res,
) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ message: "Database not connected" });
  try {
    const { joinCode } = req.body as { joinCode?: string };
    if (!joinCode || typeof joinCode !== "string")
      return res.status(400).json({ message: "joinCode is required" });

    const user = await UserModelAny.findById((req as any).userId)
      .select("role")
      .lean();
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const role = (user as any).role || "teacher";
    const isTeacher = role === "teacher" && (user as any).isStudent !== true;
    if (!isTeacher)
      return res.status(403).json({ message: "Teacher account required" });

    const cls = await ClassModelAny.findOne({ joinCode });
    if (!cls) return res.status(404).json({ message: "Class not found" });

    const uid = String((req as any).userId);
    if (String(cls.teacher) === uid)
      return res
        .status(200)
        .json({
          class: { id: cls.id, name: cls.name, joinCode: cls.joinCode },
        });

    const existing = (cls.coTeachers || []).some((t: any) => String(t) === uid);
    if (!existing) {
      (cls.coTeachers as any) = [
        ...(cls.coTeachers || []),
        (req as any).userId,
      ];
      await cls.save();
    }

    return res
      .status(200)
      .json({ class: { id: cls.id, name: cls.name, joinCode: cls.joinCode } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};
