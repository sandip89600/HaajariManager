import mongoose, { Schema, Document } from "mongoose";

export interface ISupportFeedback extends Document {
  userId: mongoose.Types.ObjectId;
  userName: string;
  mobileNumber: string;
  rating: number;
  feedback: string;
  createdAt: Date;
}

const SupportFeedbackSchema = new Schema<ISupportFeedback>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  userName: { type: String, required: true },
  mobileNumber: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  feedback: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const SupportFeedback = mongoose.model<ISupportFeedback>("SupportFeedback", SupportFeedbackSchema);
