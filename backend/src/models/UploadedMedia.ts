import mongoose, { Schema, Document } from "mongoose";

export interface IUploadedMedia extends Document {
  data: Buffer;
  mimeType: string;
  originalName: string;
  size: number;
  uploadedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const UploadedMediaSchema = new Schema<IUploadedMedia>(
  {
    data: { type: Buffer, required: true },
    mimeType: { type: String, required: true, trim: true },
    originalName: { type: String, default: "upload.jpg", trim: true },
    size: { type: Number, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

export const UploadedMedia = mongoose.model<IUploadedMedia>(
  "UploadedMedia",
  UploadedMediaSchema,
);
