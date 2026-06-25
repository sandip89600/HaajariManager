import mongoose, { Schema, Document } from "mongoose";

export interface ISupportProblem extends Document {
  userId: mongoose.Types.ObjectId;
  userName: string;
  mobileNumber: string;
  subject: string;
  description: string;
  screenshot?: string;
  status: "open" | "resolved";
  createdAt: Date;
}

const SupportProblemSchema = new Schema<ISupportProblem>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  userName: { type: String, required: true },
  mobileNumber: { type: String, required: true },
  subject: { type: String, required: true },
  description: { type: String, required: true },
  screenshot: { type: String },
  status: { type: String, enum: ["open", "resolved"], default: "open" },
  createdAt: { type: Date, default: Date.now }
});

export const SupportProblem = mongoose.model<ISupportProblem>("SupportProblem", SupportProblemSchema);
