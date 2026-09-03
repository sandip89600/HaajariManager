import mongoose, { Schema, Document } from "mongoose";

export type FeedbackCategory =
  | "Attendance"
  | "Attendance Grid"
  | "Worker Management"
  | "Site Management"
  | "Reports"
  | "PDF"
  | "CSV"
  | "Print"
  | "GPS / Location"
  | "Notifications"
  | "Login / Authentication"
  | "Payments"
  | "Performance / Slow App"
  | "UI / Design"
  | "Network / Server"
  | "Other";

export type FeedbackStatus = "New" | "In Review" | "Investigating" | "Resolved" | "Closed";
export type FeedbackPriority = "Low" | "Medium" | "High" | "Critical";

export interface IInternalNote {
  note: string;
  adminId?: string;
  adminName: string;
  createdAt: Date;
}

export interface IIssueFeedback extends Document {
  userId?: mongoose.Types.ObjectId;
  userName: string;
  userRole: string;
  userPhone?: string;
  userEmail?: string;
  category: FeedbackCategory;
  feature: string;
  message: string;
  errorType?: string;
  errorMessage?: string;
  httpStatus?: number;
  durationMs?: number;
  platform?: string;
  appVersion?: string;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  internalNotes: IInternalNote[];
  createdAt: Date;
  updatedAt: Date;
}

const InternalNoteSchema = new Schema<IInternalNote>({
  note: { type: String, required: true, trim: true },
  adminId: { type: String },
  adminName: { type: String, required: true, default: "Admin" },
  createdAt: { type: Date, default: Date.now },
});

const IssueFeedbackSchema = new Schema<IIssueFeedback>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    userName: { type: String, required: true, default: "Anonymous User" },
    userRole: { type: String, required: true, default: "user" },
    userPhone: { type: String },
    userEmail: { type: String },
    category: {
      type: String,
      required: true,
      enum: [
        "Attendance",
        "Attendance Grid",
        "Worker Management",
        "Site Management",
        "Reports",
        "PDF",
        "CSV",
        "Print",
        "GPS / Location",
        "Notifications",
        "Login / Authentication",
        "Payments",
        "Performance / Slow App",
        "UI / Design",
        "Network / Server",
        "Other",
      ],
      default: "Other",
    },
    feature: { type: String, required: true, default: "General Application" },
    message: { type: String, required: true, trim: true },
    errorType: { type: String },
    errorMessage: { type: String },
    httpStatus: { type: Number },
    durationMs: { type: Number },
    platform: { type: String, default: "mobile" },
    appVersion: { type: String, default: "1.0.0" },
    status: {
      type: String,
      required: true,
      enum: ["New", "In Review", "Investigating", "Resolved", "Closed"],
      default: "New",
    },
    priority: {
      type: String,
      required: true,
      enum: ["Low", "Medium", "High", "Critical"],
      default: "Medium",
    },
    internalNotes: [InternalNoteSchema],
  },
  { timestamps: true }
);

export const IssueFeedback = mongoose.model<IIssueFeedback>("IssueFeedback", IssueFeedbackSchema);
