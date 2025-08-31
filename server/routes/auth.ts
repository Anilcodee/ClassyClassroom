import { RequestHandler } from "express";
import { User } from "../models/User";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const signup: RequestHandler = async (req, res) => {
  try {
    const { email, name, password } = req.body as { email: string; name: string; password: string };
    if (!email || !name || !password) return res.status(400).json({ message: "Missing fields" });
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: "Email already in use" });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, name, passwordHash });
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || "dev-secret", { expiresIn: "7d" });
    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (e: any) {
    console.error("Signup error:", e);
    if (e?.code === 11000) return res.status(409).json({ message: "Email already in use" });
    res.status(500).json({ message: e?.message || "Server error" });
  }
};

export const login: RequestHandler = async (req, res) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) return res.status(400).json({ message: "Missing fields" });
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || "dev-secret", { expiresIn: "7d" });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (e: any) {
    console.error("Login error:", e);
    res.status(500).json({ message: e?.message || "Server error" });
  }
};
