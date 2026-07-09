"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLog = void 0;
var mongoose_1 = require("mongoose");
var AuditLogSchema = new mongoose_1.Schema({
    tenantId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Tenant", required: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: { type: String, required: true },
    changes: {
        before: { type: mongoose_1.Schema.Types.Mixed },
        after: { type: mongoose_1.Schema.Types.Mixed },
    },
    timestamp: { type: Date, default: Date.now },
});
AuditLogSchema.index({ tenantId: 1, timestamp: -1 });
exports.AuditLog = mongoose_1.default.model("AuditLog", AuditLogSchema);
