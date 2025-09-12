import { RequestHandler } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../middleware/auth";
import { User } from "../models/User";
import { ClassModel } from "../models/Class";
const UserModelAny: any = User as any;
const ClassModelAny: any = ClassModel as any;

export const unenrollClass: RequestHandler = async (req: AuthRequest, res) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ message: "Database not connected" });
  try {
    const { id } = req.params as { id: string };
    const user = await UserModelAny.findById(req.userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const role = (user as any).role || "teacher";
    const isStudent = (user as any).isStudent === true || role === "student";
    if (!isStudent) return res.status(403).json({ message: "Forbidden" });

    const cls = await ClassModel.findById(id);
    if (!cls) return res.status(404).json({ message: "Class not found" });

    // Remove from user's enrolledClasses
    (user as any).enrolledClasses = (
      (user as any).enrolledClasses || []
    ).filter((cid: any) => String(cid) !== String(id));
    await user.save();

    // Optionally remove from class roster by rollNo
    const rollNo = (user as any).rollNo || "";
    if (rollNo) {
      (cls as any).students = (cls as any).students.filter(
        (s: any) => String(s.rollNo) !== String(rollNo),
      );
      await cls.save();
    }

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

export const listStudentClasses: RequestHandler = async (
  req: AuthRequest,
  res,
) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ message: "Database not connected" });
  try {
    const user = await UserModelAny.findById(req.userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const role = (user as any).role || "teacher";
    const isStudent = (user as any).isStudent === true || role === "student";
    if (!isStudent) return res.status(403).json({ message: "Forbidden" });
    const classIds = (user as any).enrolledClasses || [];
    const classes = await ClassModel.find({ _id: { $in: classIds } })
      .select("name joinCode teacher createdAt updatedAt isActive imageUrl")
      .lean();
    res.json({ classes });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

export const joinClass: RequestHandler = async (req: AuthRequest, res) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ message: "Database not connected" });
  try {
    const { joinCode } = req.body as { joinCode: string };
    if (!joinCode)
      return res.status(400).json({ message: "joinCode is required" });

    const user = await UserModelAny.findById(req.userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const role = (user as any).role || "teacher";
    const isStudent = (user as any).isStudent === true || role === "student";
    if (!isStudent) return res.status(403).json({ message: "Forbidden" });

    const cls = await ClassModel.findOne({ joinCode });
    if (!cls) return res.status(404).json({ message: "Class not found" });

    const rollNo = (user as any).rollNo || "";
    const name = user.name;
    if (!rollNo)
      return res
        .status(400)
        .json({ message: "Your profile is missing roll number" });

    const alreadyInClass = cls.students.some((s) => s.rollNo === rollNo);
    if (!alreadyInClass) {
      cls.students.push({ name, rollNo });
      await cls.save();
    }

    const enrolled = new Set([
      ...((user as any).enrolledClasses?.map((id: any) => String(id)) || []),
    ]);
    enrolled.add(String(cls._id));
    (user as any).enrolledClasses = Array.from(enrolled);
    await user.save();

    res
      .status(200)
      .json({ class: { id: cls.id, name: cls.name, joinCode: cls.joinCode } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};
