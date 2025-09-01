import { RequestHandler } from "express";
import { User } from "../models/User";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

export const signup: RequestHandler = async (req, res) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ message: "Database not connected" });
  try {
    const { email, name, password, role, rollNo } = req.body as {
      email: string;
      name: string;
      password: string;
      role?: "teacher" | "student";
      rollNo?: string;
    };
    const emailNorm = (email || "").trim().toLowerCase();
    const nameNorm = (name || "").trim();
    if (!emailNorm || !nameNorm || !password) return res.status(400).json({ message: "Missing fields" });
    const isStudentPath = (req.originalUrl || "").includes("/signup/student");
    const roleToUse: "teacher" | "student" = isStudentPath || role === "student" ? "student" : "teacher";
    if (roleToUse === "student" && !rollNo) return res.status(400).json({ message: "Roll number required for students" });
    const existing = await User.findOne({ email: emailNorm });
    if (existing) {
      // User exists: require matching password, then enable the requested role flag
      const ok = await bcrypt.compare(password, existing.passwordHash);
      if (!ok) return res.status(401).json({ message: "Invalid password for existing account" });
      if (roleToUse === "student") {
        if (existing.isStudent || (existing as any).role === "student")
          return res.status(409).json({ message: "Student account already exists for this email" });
        existing.isStudent = true;
        if (rollNo) existing.rollNo = rollNo;
      } else {
        if (existing.isTeacher || (existing as any).role === "teacher")
          return res.status(409).json({ message: "Teacher account already exists for this email" });
        existing.isTeacher = true;
      }
      await existing.save();
      const token = jwt.sign({ id: existing.id }, process.env.JWT_SECRET || "dev-secret", { expiresIn: "7d" });
      return res.status(201).json({
        token,
        user: {
          id: existing.id,
          email: existing.email,
          name: existing.name,
          role: roleToUse,
          isTeacher: !!existing.isTeacher,
          isStudent: !!existing.isStudent,
          rollNo: existing.rollNo || null,
        },
      });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: emailNorm,
      name: nameNorm,
      passwordHash,
      role: roleToUse,
      isTeacher: roleToUse === "teacher",
      isStudent: roleToUse === "student",
      rollNo: roleToUse === "student" ? rollNo : undefined,
    } as any);
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || "dev-secret", { expiresIn: "7d" });
    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: roleToUse,
        isTeacher: !!user.isTeacher,
        isStudent: !!user.isStudent,
        rollNo: user.rollNo || null,
      },
    });
  } catch (e: any) {
    console.error("Signup error:", e);
    if (e?.code === 11000) return res.status(409).json({ message: "Email already in use" });
    res.status(500).json({ message: e?.message || "Server error" });
  }
};

export const login: RequestHandler = async (req, res) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ message: "Database not connected" });
  try {
    const { email, password, role } = req.body as { email: string; password: string; role?: "teacher" | "student" };
    const emailNorm = (email || "").trim().toLowerCase();
    if (!emailNorm || !password) return res.status(400).json({ message: "Missing fields" });
    const user = await User.findOne({ email: emailNorm });
    if (!user) return res.status(401).json({ message: "Invalid email or password" });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid email or password" });

    const isStudentLogin = (req.originalUrl || "").includes("/login/student") || role === "student";
    const isTeacherLogin = (req.originalUrl || "").includes("/login/teacher") || role === "teacher";
    const hasStudent = !!(user as any).isStudent || (user as any).role === "student";
    const hasTeacher = !!(user as any).isTeacher || (user as any).role === "teacher";

    if (isStudentLogin && !hasStudent) {
      return res.status(404).json({ message: "No student account found for this email" });
    }
    if (isTeacherLogin && !hasTeacher) {
      return res.status(404).json({ message: "No teacher account found for this email" });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || "dev-secret", { expiresIn: "7d" });
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: isStudentLogin ? "student" : isTeacherLogin ? "teacher" : ((user as any).role || "teacher"),
        isTeacher: hasTeacher,
        isStudent: hasStudent,
        rollNo: (user as any).rollNo || null,
      },
    });
  } catch (e: any) {
    console.error("Login error:", e);
    res.status(500).json({ message: e?.message || "Server error" });
  }
};

export const signupStudent: RequestHandler = async (req, res, next) => {
  (req as any).body = { ...(req as any).body, role: "student" };
  return signup(req, res, next as any);
};
export const signupTeacher: RequestHandler = async (req, res, next) => {
  (req as any).body = { ...(req as any).body, role: "teacher" };
  return signup(req, res, next as any);
};

export const loginStudent: RequestHandler = async (req, res, next) => {
  (req as any).body = { ...(req as any).body, role: "student" };
  return login(req, res, next as any);
};
export const loginTeacher: RequestHandler = async (req, res, next) => {
  (req as any).body = { ...(req as any).body, role: "teacher" };
  return login(req, res, next as any);
};
