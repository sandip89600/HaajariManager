"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Project = void 0;
var mongoose_1 = require("mongoose");
var ProjectSchema = new mongoose_1.Schema({
    tenantId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Tenant", required: true },
    name: { type: String, required: true, trim: true },
    location: { type: String },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    createdAt: { type: Date, default: Date.now },
});
ProjectSchema.index({ tenantId: 1 });
exports.Project = mongoose_1.default.model("Project", ProjectSchema);
