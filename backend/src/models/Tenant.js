"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tenant = void 0;
var mongoose_1 = require("mongoose");
var TenantSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true, lowercase: true, trim: true },
    plan: { type: String, enum: ["free", "professional", "business"], default: "free" },
    planExpiresAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
});
exports.Tenant = mongoose_1.default.model("Tenant", TenantSchema);
