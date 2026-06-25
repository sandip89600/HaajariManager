import mongoose, { Schema, Document } from "mongoose";

export interface IAttendance extends Document {
  tenantId: mongoose.Types.ObjectId;
  workerId: mongoose.Types.ObjectId;
  projectId?: mongoose.Types.ObjectId;
  year: number;
  month: number;
  day: number;
  value: string | number;
  dailyRate?: number;
  customWage?: number;
  finalPay?: number;
  overtimeHours?: number;
  overtimeWage?: number;
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  timestamp: Date;
}

const AttendanceSchema = new Schema<IAttendance>({
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  workerId: { type: Schema.Types.ObjectId, ref: "Worker", required: true },
  projectId: { type: Schema.Types.ObjectId, ref: "Project" },
  year: { type: Number, required: true },
  month: { type: Number, required: true },
  day: { type: Number, required: true },
  value: { type: Schema.Types.Mixed, required: true },
  dailyRate: { type: Number },
  customWage: { type: Number },
  finalPay: { type: Number },
  overtimeHours: { type: Number },
  overtimeWage: { type: Number },
  location: {
    latitude: { type: Number },
    longitude: { type: Number },
    accuracy: { type: Number },
  },
  timestamp: { type: Date, default: Date.now },
});

AttendanceSchema.index({ tenantId: 1, workerId: 1, year: 1, month: 1, day: 1 }, { unique: true });
AttendanceSchema.index({ tenantId: 1, year: 1, month: 1 });

export const Attendance = mongoose.model<IAttendance>("Attendance", AttendanceSchema);
