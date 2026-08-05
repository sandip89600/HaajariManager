import mongoose, { Schema, Document } from "mongoose";

export interface IAuditLog extends Document {
  tenantId?: mongoose.Types.ObjectId; // Map to Organization ID
  userId?: mongoose.Types.ObjectId;
  userName?: string;
  role?: string;
  action: string;
  targetType: string; // Entity Type (e.g. WORKER, SITE, ATTENDANCE)
  targetId: string;   // Entity ID
  entityType?: string; // Duplicate for strict compliance with spec
  entityId?: string;   // Duplicate for strict compliance with spec
  changes?: {
    before?: any;
    after?: any;
  };
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  device?: string;
  platform?: string;
  location?: {
    latitude?: number;
    longitude?: number;
    address?: string;
  };
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant" },
  userId: { type: Schema.Types.ObjectId, ref: "User" },
  userName: { type: String },
  role: { type: String },
  action: { type: String, required: true },
  targetType: { type: String, required: true },
  targetId: { type: String, required: true },
  entityType: { type: String },
  entityId: { type: String },
  changes: {
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
  },
  oldValue: { type: Schema.Types.Mixed },
  newValue: { type: Schema.Types.Mixed },
  ipAddress: { type: String },
  device: { type: String },
  platform: { type: String },
  location: {
    latitude: { type: Number },
    longitude: { type: Number },
    address: { type: String },
  },
  timestamp: { type: Date, default: Date.now },
});

AuditLogSchema.index({ tenantId: 1, timestamp: -1 });
AuditLogSchema.index({ timestamp: -1 });

export const AuditLog = mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);

