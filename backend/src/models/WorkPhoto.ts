import mongoose, { Schema, Document } from "mongoose";

export interface IWorkPhoto extends Document {
  tenantId: mongoose.Types.ObjectId;
  siteId: mongoose.Types.ObjectId;
  workerId?: mongoose.Types.ObjectId;
  photoType: "before" | "after";
  photoUri: string;
  location: {
    latitude: number;
    longitude: number;
  };
  timestamp: Date;
}

const WorkPhotoSchema = new Schema<IWorkPhoto>({
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true },
  workerId: { type: Schema.Types.ObjectId, ref: "Worker" },
  photoType: { type: String, enum: ["before", "after"], required: true },
  photoUri: { type: String, required: true },
  location: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  },
  timestamp: { type: Date, required: true, default: Date.now }
}, {
  timestamps: true
});

WorkPhotoSchema.index({ tenantId: 1, siteId: 1 });
WorkPhotoSchema.index({ siteId: 1, workerId: 1 });

export const WorkPhoto = mongoose.model<IWorkPhoto>("WorkPhoto", WorkPhotoSchema);
