import { RequestHandler, Request, Response, NextFunction } from "express";
import { User } from "../models/User";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

async function verifyIdToken(idToken: string) {
  // Use Google's tokeninfo endpoint for simplicity
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    );
    if (!res.ok) return null;
    const payload = await res.json();
    return payload;
  } catch (e) {
    return null;
  }
}

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
    if (!emailNorm || !nameNorm || !password)
      return res.status(400).json({ message: "Missing fields" });
    const isStudentPath = (req.originalUrl || "").includes("/signup/student");
    const roleToUse: "teacher" | "student" =
      isStudentPath || role === "student" ? "student" : "teacher";
    if (roleToUse === "student" && !rollNo)
      return res
        .status(400)
        .json({ message: "Roll number required for students" });
    const existing = await User.findOne({ email: emailNorm });
    if (existing) {
      // User exists: require matching password, then enable the requested role flag
      const ok = await bcrypt.compare(password, existing.passwordHash);
      if (!ok)
        return res
          .status(401)
          .json({ message: "Invalid password for existing account" });
      if (roleToUse === "student") {
        if (existing.isStudent || (existing as any).role === "student")
          return res
            .status(409)
            .json({ message: "Student account already exists for this email" });
        existing.isStudent = true;
        if (rollNo) existing.rollNo = rollNo;
      } else {
        if (existing.isTeacher || (existing as any).role === "teacher")
          return res
            .status(409)
            .json({ message: "Teacher account already exists for this email" });
        existing.isTeacher = true;
      }
      await existing.save();
      const token = jwt.sign(
        { id: existing.id },
        process.env.JWT_SECRET || "dev-secret",
        { expiresIn: "7d" },
      );
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
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET || "dev-secret",
      { expiresIn: "7d" },
    );
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
    if (e?.code === 11000)
      return res.status(409).json({ message: "Email already in use" });
    res.status(500).json({ message: e?.message || "Server error" });
  }
};

export const login: RequestHandler = async (req, res) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ message: "Database not connected" });
  try {
    const { email, password, role } = req.body as {
      email: string;
      password: string;
      role?: "teacher" | "student";
    };
    const emailNorm = (email || "").trim().toLowerCase();
    if (!emailNorm || !password)
      return res.status(400).json({ message: "Missing fields" });
    const user = await User.findOne({ email: emailNorm });
    if (!user)
      return res.status(401).json({ message: "Invalid email or password" });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok)
      return res.status(401).json({ message: "Invalid email or password" });

    const isStudentLogin =
      (req.originalUrl || "").includes("/login/student") || role === "student";
    const isTeacherLogin =
      (req.originalUrl || "").includes("/login/teacher") || role === "teacher";
    const hasStudent =
      !!(user as any).isStudent || (user as any).role === "student";
    const hasTeacher =
      !!(user as any).isTeacher || (user as any).role === "teacher";

    if (isStudentLogin && !hasStudent) {
      return res
        .status(404)
        .json({ message: "No student account found for this email" });
    }
    if (isTeacherLogin && !hasTeacher) {
      return res
        .status(404)
        .json({ message: "No teacher account found for this email" });
    }

    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET || "dev-secret",
      { expiresIn: "7d" },
    );
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: isStudentLogin
          ? "student"
          : isTeacherLogin
            ? "teacher"
            : (user as any).role || "teacher",
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

// Google OAuth endpoints
export const googleRedirect: RequestHandler = async (req, res) => {
  const role = req.query.role === "student" ? "student" : "teacher";
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return res.status(500).send("Google client id not configured");
  const origin = process.env.ORIGIN || `${req.protocol}://${req.get("host")}`;
  const redirectUri = `${origin}/api/auth/google/callback`;
  const state = encodeURIComponent(JSON.stringify({ role }));
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent("openid email profile")}&prompt=select_account&state=${state}`;
  res.redirect(url);
};

export const googleCallback: RequestHandler = async (req, res) => {
  try {
    const code = req.query.code as string | undefined;
    const stateRaw = req.query.state as string | undefined;
    let role: "teacher" | "student" = "teacher";
    if (stateRaw) {
      try {
        const st = JSON.parse(decodeURIComponent(stateRaw));
        if (st?.role === "student") role = "student";
      } catch {}
    }
    if (!code) return res.status(400).send("Missing code");
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const origin = process.env.ORIGIN || `${req.protocol}://${req.get("host")}`;
    const redirectUri = `${origin}/api/auth/google/callback`;
    if (!clientId || !clientSecret)
      return res.status(500).send("Google client credentials not configured");

    // Exchange code for tokens
    const params = new URLSearchParams();
    params.set("code", code);
    params.set("client_id", clientId);
    params.set("client_secret", clientSecret);
    params.set("redirect_uri", redirectUri);
    params.set("grant_type", "authorization_code");

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    if (!tokenRes.ok) {
      const txt = await tokenRes.text().catch(() => "");
      console.error("Token exchange failed", txt);
      return res.status(500).send("Failed to exchange token");
    }
    const tokenJson = await tokenRes.json();
    const idToken = tokenJson.id_token;
    if (!idToken) return res.status(500).send("No id_token returned");

    const payload = await verifyIdToken(idToken);
    if (!payload || !payload.email)
      return res.status(400).send("Failed to verify id token");
    const email = (payload.email || "").toLowerCase();
    const name = payload.name || "";

    const existing = await User.findOne({ email });
    // If existing user and already has the requested role, issue JWT and redirect with token
    const hasStudent =
      !!existing?.isStudent || (existing as any)?.role === "student";
    const hasTeacher =
      !!existing?.isTeacher || (existing as any)?.role === "teacher";
    const needsRole = role === "student" ? hasStudent : hasTeacher;

    if (existing && needsRole) {
      const token = jwt.sign(
        { id: existing.id },
        process.env.JWT_SECRET || "dev-secret",
        { expiresIn: "7d" },
      );
      const clientRedirect =
        role === "student" ? `${origin}/student-auth` : `${origin}/auth`;
      return res.redirect(
        `${clientRedirect}?token=${encodeURIComponent(token)}`,
      );
    }

    // Otherwise, redirect to completion flow on frontend with info
    const clientRedirect = `${origin}/auth/google/complete`;
    // include id_token so client can complete creation securely
    const paramsOut = new URLSearchParams({
      email,
      name,
      role,
      id_token: idToken,
    });
    if (existing) paramsOut.set("existing", "1");
    return res.redirect(`${clientRedirect}?${paramsOut.toString()}`);
  } catch (e) {
    console.error("Google callback error", e);
    res.status(500).send("Google callback failed");
  }
};

export const googleComplete: RequestHandler = async (req, res) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ message: "Database not connected" });
  try {
    const { idToken, email, name, password, role, rollNo } = req.body as any;
    const roleToUse: "teacher" | "student" =
      role === "student" ? "student" : "teacher";
    const emailNorm = (email || "").trim().toLowerCase();
    if (!emailNorm || !password)
      return res.status(400).json({ message: "Missing fields" });

    // If idToken provided, verify it matches email
    if (idToken) {
      const payload = await verifyIdToken(idToken);
      if (!payload || (payload.email || "").toLowerCase() !== emailNorm) {
        return res.status(400).json({ message: "Invalid id token" });
      }
    }

    const existing = await User.findOne({ email: emailNorm });
    if (existing) {
      // Verify the provided password matches existing password to allow linking role
      const ok = await bcrypt.compare(password, existing.passwordHash);
      if (!ok)
        return res
          .status(401)
          .json({ message: "Invalid password for existing account" });
      if (roleToUse === "student") {
        if (existing.isStudent || (existing as any).role === "student")
          return res
            .status(409)
            .json({ message: "Student account already exists for this email" });
        existing.isStudent = true;
        if (rollNo) existing.rollNo = rollNo;
      } else {
        if (existing.isTeacher || (existing as any).role === "teacher")
          return res
            .status(409)
            .json({ message: "Teacher account already exists for this email" });
        existing.isTeacher = true;
        if (name) existing.name = name;
      }
      await existing.save();
      const token = jwt.sign(
        { id: existing.id },
        process.env.JWT_SECRET || "dev-secret",
        { expiresIn: "7d" },
      );
      return res.json({
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

    // Create new user
    const nameNorm = (name || "").trim();
    if (!nameNorm) return res.status(400).json({ message: "Name is required" });
    if (roleToUse === "student" && !rollNo)
      return res
        .status(400)
        .json({ message: "Roll number required for students" });

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
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET || "dev-secret",
      { expiresIn: "7d" },
    );
    res.json({
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
    console.error("googleComplete error", e);
    res.status(500).json({ message: e?.message || "Server error" });
  }
};

export const me: RequestHandler = async (req: any, res) => {
  try {
    const id = req.userId;
    if (!id) return res.status(401).json({ message: "Unauthorized" });
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role:
        (user as any).role ||
        (user.isStudent ? "student" : user.isTeacher ? "teacher" : "teacher"),
      isTeacher: !!user.isTeacher,
      isStudent: !!user.isStudent,
      rollNo: (user as any).rollNo || null,
    });
  } catch (e: any) {
    console.error("me error", e);
    res.status(500).json({ message: e?.message || "Server error" });
  }
};
