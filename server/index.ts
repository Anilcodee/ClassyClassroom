import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { connectDB } from "./db";
import { signup, login, signupStudent, signupTeacher, loginStudent, loginTeacher } from "./routes/auth";
import { requireAuth } from "./middleware/auth";
import { listClasses, createClass } from "./routes/classes";
import { getClass } from "./routes/classes.get-by-id";
import { activateClass, sessionStatus, markAttendance } from "./routes/attendance";
import { getTodayAttendance } from "./routes/attendance.today";
import { listAttendanceDates, classAttendancePdf, classAttendancePdfAll } from "./routes/attendance.pdf";
import { dbHealth } from "./routes/health";
import { listStudentClasses, joinClass } from "./routes/student";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // DB
  connectDB().catch((e) => {
    console.error("DB connect failed:", e);
  });

  // Health/demo
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });
  app.get("/api/health/db", dbHealth);

  app.get("/api/demo", handleDemo);

  // Auth
  app.post("/api/auth/signup", signup);
  app.post("/api/auth/login", login);

  // Classes
  app.get("/api/classes", requireAuth, listClasses);
  app.post("/api/classes", requireAuth, createClass);
  app.get("/api/classes/:id", requireAuth, getClass);
  app.get("/api/classes/:id/attendance/today", requireAuth, getTodayAttendance);
  app.get("/api/classes/:id/attendance/dates", requireAuth, listAttendanceDates);
  app.get("/api/classes/:id/attendance/pdf", requireAuth, classAttendancePdf);
  app.get("/api/classes/:id/attendance/pdf/all", requireAuth, classAttendancePdfAll);

  // Attendance
  app.post("/api/classes/:id/activate", requireAuth, activateClass);
  app.get("/api/session/:sessionId", sessionStatus);
  app.post("/api/session/:sessionId/mark", markAttendance);

  // Student
  app.get("/api/student/classes", requireAuth, listStudentClasses);
  app.post("/api/student/classes/join", requireAuth, joinClass);

  return app;
}
