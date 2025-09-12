import { RequestHandler } from "express";
import PDFDocument from "pdfkit";
import mongoose from "mongoose";
import { Attendance } from "../models/Attendance";
import { ClassModel } from "../models/Class";
const AttendanceModelAny: any = Attendance as any;
const ClassModelAny: any = ClassModel as any;

function parseDateParam(input?: string | null) {
  if (!input) return new Date(new Date().toISOString().slice(0,10));
  const d = new Date(input);
  if (isNaN(d.getTime())) return new Date(new Date().toISOString().slice(0,10));
  return new Date(d.toISOString().slice(0,10));
}

export const listAttendanceDates: RequestHandler = async (req, res) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ message: "Database not connected" });
  try {
    const { id } = req.params as { id: string };
    const docs = await Attendance.find({ classId: id }).select("date").lean();
    const dates = docs.map((d) => d.date.toISOString().slice(0,10)).sort().reverse();
    res.json({ dates });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

export const classAttendancePdf: RequestHandler = async (req, res) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ message: "Database not connected" });
  try {
    const { id } = req.params as { id: string };
    const dateParam = typeof req.query.date === 'string' ? req.query.date : undefined;
    const date = parseDateParam(dateParam);
    const dayStart = date;
    const dayEnd = new Date(dayStart.getTime() + 24*60*60*1000);
    const cls = await ClassModel.findById(id).lean();
    if (!cls) return res.status(404).json({ message: "Class not found" });
    const att = await Attendance.findOne({ classId: id, date: { $gte: dayStart, $lt: dayEnd } }).lean();
    const present = new Set((att?.records||[]).map(r => `${r.student.name}|${r.student.rollNo}`));

    const doc = new PDFDocument({ margin: 40 });
    const filename = `${cls.name.replace(/[^a-z0-9]+/gi,'-')}-${dayStart.toISOString().slice(0,10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    doc.fontSize(20).text(cls.name, { align: 'left' });
    doc.moveDown(0.3);
    doc.fontSize(12).fillColor('#666').text(`Date: ${dayStart.toISOString().slice(0,10)}`);
    doc.moveDown(1);

    // Table header
    doc.fillColor('#000');
    doc.fontSize(12).text('Roll', 40, doc.y, { continued: true });
    doc.text('Name', 120, doc.y, { continued: true });
    doc.text('Present', 360);
    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(560, doc.y).stroke();

    const rows = (cls.students || []).map(s => ({
      rollNo: s.rollNo,
      name: s.name,
      present: present.has(`${s.name}|${s.rollNo}`) ? 'Yes' : 'No'
    }));

    for (const r of rows) {
      doc.moveDown(0.5);
      doc.text(r.rollNo, 40, doc.y, { continued: true });
      doc.text(r.name, 120, doc.y, { continued: true });
      doc.text(r.present, 360);
    }

    doc.end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

export const classAttendancePdfAll: RequestHandler = async (req, res) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ message: "Database not connected" });
  try {
    const { id } = req.params as { id: string };
    const cls = await ClassModel.findById(id).lean();
    if (!cls) return res.status(404).json({ message: "Class not found" });
    const days = await Attendance.find({ classId: id }).sort({ date: 1 }).lean();

    const doc = new PDFDocument({ margin: 40 });
    const filename = `${cls.name.replace(/[^a-z0-9]+/gi,'-')}-all-days.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    doc.fontSize(22).text(cls.name, { align: 'left' });
    doc.moveDown(0.2);
    doc.fontSize(12).fillColor('#666').text(`Attendance (all days)`);
    doc.moveDown(0.8);

    for (let d = 0; d < days.length; d++) {
      const day = days[d];
      const present = new Set((day.records||[]).map(r => `${r.student.name}|${r.student.rollNo}`));
      doc.fillColor('#000').fontSize(14).text(`Date: ${day.date.toISOString().slice(0,10)}`);
      doc.moveDown(0.3);
      doc.fontSize(12).text('Roll', 40, doc.y, { continued: true });
      doc.text('Name', 120, doc.y, { continued: true });
      doc.text('Present', 360);
      doc.moveDown(0.5);
      doc.moveTo(40, doc.y).lineTo(560, doc.y).stroke();

      const rows = (cls.students || []).map(s => ({
        rollNo: s.rollNo,
        name: s.name,
        present: present.has(`${s.name}|${s.rollNo}`) ? 'Yes' : 'No'
      }));

      for (const r of rows) {
        doc.moveDown(0.5);
        doc.text(r.rollNo, 40, doc.y, { continued: true });
        doc.text(r.name, 120, doc.y, { continued: true });
        doc.text(r.present, 360);
      }

      if (d < days.length - 1) doc.addPage();
    }

    if (days.length === 0) {
      doc.text('No attendance records yet.');
    }

    doc.end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};
