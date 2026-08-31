import mongoose, { Schema, Document } from "mongoose";

export interface IEmailNotification extends Document {
  subject: string;
  type: "Announcement" | "Update" | "Maintenance" | "Security" | "Reminder" | "Promotional" | "System";
  category: "General" | "Attendance" | "Workforce" | "Payment" | "Site Management" | "Reports" | "Security" | "System Update";
  priority: "Normal" | "Important" | "Urgent";
  recipients: {
    roles: string[]; // ["All Users"], ["Contractor", "Supervisor"], etc.
    specificUserIds?: mongoose.Types.ObjectId[];
  };
  heading: string;
  message: string;
  cta?: {
    enabled: boolean;
    buttonText?: string;
    actionTarget?: string;
    customUrl?: string;
  };
  createdBy: mongoose.Types.ObjectId;
  status: "Draft" | "Sending" | "Sent" | "Partially Sent" | "Failed";
  createdAt: Date;
  sentAt?: Date;
  deliveryStats: {
    totalRecipients: number;
    successfulSends: number;
    failedSends: number;
    failedEmails?: string[];
  };
}

const EmailNotificationSchema = new Schema<IEmailNotification>({
  subject: { type: String, required: true },
  type: {
    type: String,
    enum: ["Announcement", "Update", "Maintenance", "Security", "Reminder", "Promotional", "System"],
    default: "Announcement",
  },
  category: {
    type: String,
    enum: ["General", "Attendance", "Workforce", "Payment", "Site Management", "Reports", "Security", "System Update"],
    default: "General",
  },
  priority: {
    type: String,
    enum: ["Normal", "Important", "Urgent"],
    default: "Normal",
  },
  recipients: {
    roles: [{ type: String }],
    specificUserIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  heading: { type: String, required: true },
  message: { type: String, required: true },
  cta: {
    enabled: { type: Boolean, default: false },
    buttonText: { type: String },
    actionTarget: { type: String },
    customUrl: { type: String },
  },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  status: {
    type: String,
    enum: ["Draft", "Sending", "Sent", "Partially Sent", "Failed"],
    default: "Draft",
    index: true,
  },
  createdAt: { type: Date, default: Date.now, index: true },
  sentAt: { type: Date },
  deliveryStats: {
    totalRecipients: { type: Number, default: 0 },
    successfulSends: { type: Number, default: 0 },
    failedSends: { type: Number, default: 0 },
    failedEmails: [{ type: String }],
  },
});

export const EmailNotification = mongoose.model<IEmailNotification>(
  "EmailNotification",
  EmailNotificationSchema
);
