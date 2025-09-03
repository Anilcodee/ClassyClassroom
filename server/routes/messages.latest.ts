import { RequestHandler } from "express";
import mongoose, { Types } from "mongoose";
import { Message } from "../models/Message";
import { AuthRequest } from "../middleware/auth";

export const listLatestForClasses: RequestHandler = async (
  req: AuthRequest,
  res,
) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ message: "Database not connected" });
  try {
    const raw = String((req.query as any)?.classIds || "").trim();
    if (!raw) return res.json({ latest: {} });
    const ids = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const objIds = ids.map((id) => new Types.ObjectId(id));

    const agg = await Message.aggregate([
      { $match: { classId: { $in: objIds } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$classId",
          latestAt: { $first: "$createdAt" },
          latestBy: { $first: "$teacherId" },
        },
      },
    ]);
    const latest: Record<string, { latestAt: string; latestBy: string }> =
      {} as any;
    for (const row of agg) {
      latest[String(row._id)] = {
        latestAt: row.latestAt,
        latestBy: String(row.latestBy),
      } as any;
    }
    res.json({ latest });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};
