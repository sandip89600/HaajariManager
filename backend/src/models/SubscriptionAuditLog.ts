import mongoose, { Schema, Document } from 'mongoose';

export interface ISubscriptionAuditLog extends Document {
  actorId: string;
  actorRole: 'ADMIN' | 'SYSTEM' | 'USER';
  tenantId?: string;
  action: string;
  details: Record<string, any>;
  ipAddress?: string;
  createdAt: Date;
}

const SubscriptionAuditLogSchema: Schema = new Schema(
  {
    actorId: { type: String, required: true },
    actorRole: {
      type: String,
      required: true,
      enum: ['ADMIN', 'SYSTEM', 'USER'],
      default: 'SYSTEM',
    },
    tenantId: { type: String, index: true },
    action: { type: String, required: true },
    details: { type: Schema.Types.Mixed, default: {} },
    ipAddress: { type: String },
  },
  { timestamps: true }
);

export const SubscriptionAuditLog = mongoose.model<ISubscriptionAuditLog>(
  'SubscriptionAuditLog',
  SubscriptionAuditLogSchema
);
