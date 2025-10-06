import { RequestHandler } from "express";
import mongoose from "mongoose";

export const dbHealth: RequestHandler = (_req, res) => {
  const state = mongoose.connection.readyState; // 0=disconnected 1=connected 2=connecting 3=disconnecting
  res.json({ state });
};
