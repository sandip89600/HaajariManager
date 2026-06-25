import mongoose, { Schema, Document } from "mongoose";

export interface IAuditLog extends Document {
  tenantId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  action: string;
  targetType: string;
  targetId: string;
  changes: {
    before?: any;
    after?: any;
  };
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  action: { type: String, required: true },
  targetType: { type: String, required: true },
  targetId: { type: String, required: true },
  changes: {
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
  },
  timestamp: { type: Date, default: Date.now },
});

AuditLogSchema.index({ tenantId: 1, timestamp: -1 });

export const AuditLog = mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
