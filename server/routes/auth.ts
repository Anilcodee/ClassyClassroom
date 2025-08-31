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
    if (role === "student" && !rollNo) return res.status(400).json({ message: "Roll number required for students" });
    const roleToUse: "teacher" | "student" = role === "student" ? "student" : "teacher";
    const existing = await User.findOne({ email: emailNorm, role: roleToUse });
    if (existing) return res.status(409).json({ message: "Email already in use for this role" });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email: emailNorm, name: nameNorm, passwordHash, role: roleToUse, rollNo });
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || "dev-secret", { expiresIn: "7d" });
    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role || "teacher", rollNo: user.rollNo || null },
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
    const query: any = { email: emailNorm };
    if (role) query.role = role;
    const user = await User.findOne(query);
    if (!user) return res.status(401).json({ message: "Invalid email or password" });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid email or password" });
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || "dev-secret", { expiresIn: "7d" });
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: (user as any).role || "teacher", rollNo: (user as any).rollNo || null },
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
