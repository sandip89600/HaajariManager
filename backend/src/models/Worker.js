"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Worker = void 0;
var mongoose_1 = require("mongoose");
var WorkerSchema = new mongoose_1.Schema({
    tenantId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Tenant", required: true },
    projectId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Project" },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true },
    dailyRate: { type: Number, required: true, min: 0 },
    phone: { type: String },
    address: { type: String },
    notes: { type: String },
    photoUri: { type: String },
    isArchived: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
});
WorkerSchema.index({ tenantId: 1 });
WorkerSchema.index({ tenantId: 1, name: 1 });
exports.Worker = mongoose_1.default.model("Worker", WorkerSchema);
