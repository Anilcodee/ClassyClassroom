import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { connectDB } from "./db";
import { signup, login, signupStudent, signupTeacher, loginStudent, loginTeacher } from "./routes/auth";
import { requireAuth } from "./middleware/auth";
import { listClasses, createClass, updateClassImage } from "./routes/classes";
import { getClass } from "./routes/classes.get-by-id";
import { activateClass, sessionStatus, markAttendance } from "./routes/attendance";
import { getTodayAttendance } from "./routes/attendance.today";
import { listAttendanceDates, classAttendancePdf, classAttendancePdfAll } from "./routes/attendance.pdf";
import { getStudentAttendance } from "./routes/student.attendance";
import { getAttendanceForDate } from "./routes/attendance.view";
import { listMessages, createMessage, addComment, updateMessage, deleteMessage } from "./routes/messages";
import { dbHealth } from "./routes/health";
import { listStudentClasses, joinClass } from "./routes/student";
import { updateClassDetails } from "./routes/classes.update";
import { joinClassAsTeacher } from "./routes/classes.join-teacher";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

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
  app.post("/api/auth/signup/student", signupStudent);
  app.post("/api/auth/signup/teacher", signupTeacher);
  app.post("/api/auth/login/student", loginStudent);
  app.post("/api/auth/login/teacher", loginTeacher);

  // Classes
  app.get("/api/classes", requireAuth, listClasses);
  app.post("/api/classes", requireAuth, createClass);
  app.patch("/api/classes/:id/image", requireAuth, updateClassImage);
  app.patch("/api/classes/:id", requireAuth, updateClassDetails);
  app.get("/api/classes/:id", requireAuth, getClass);

  // Attendance (teacher view)
  app.get("/api/classes/:id/attendance/today", requireAuth, getTodayAttendance);
  app.get("/api/classes/:id/attendance", requireAuth, getAttendanceForDate);
  app.get("/api/classes/:id/attendance/dates", requireAuth, listAttendanceDates);
  app.get("/api/classes/:id/attendance/pdf", requireAuth, classAttendancePdf);
  app.get("/api/classes/:id/attendance/pdf/all", requireAuth, classAttendancePdfAll);

  // Attendance (session)
  app.post("/api/classes/:id/activate", requireAuth, activateClass);
  app.get("/api/session/:sessionId", sessionStatus);
  app.post("/api/session/:sessionId/mark", markAttendance);

  // Messages
  app.get("/api/classes/:id/messages", requireAuth, listMessages);
  app.post("/api/classes/:id/messages", requireAuth, createMessage);
  app.patch("/api/messages/:messageId", requireAuth, updateMessage);
  app.delete("/api/messages/:messageId", requireAuth, deleteMessage);
  app.post("/api/messages/:messageId/comments", requireAuth, addComment);

  // Student
  app.get("/api/student/classes", requireAuth, listStudentClasses);
  app.post("/api/student/classes/join", requireAuth, joinClass);
  app.get("/api/student/classes/:id/attendance", requireAuth, getStudentAttendance);

  // Teachers: join as co-teacher
  app.post("/api/classes/join-as-teacher", requireAuth, joinClassAsTeacher);

  return app;
}
