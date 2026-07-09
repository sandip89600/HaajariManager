"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WageHistory = void 0;
var mongoose_1 = require("mongoose");
var WageHistorySchema = new mongoose_1.Schema({
    tenantId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Tenant", required: true },
    workerId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Worker", required: true },
    dailyRate: { type: Number, required: true, min: 0 },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    updatedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    createdAt: { type: Date, default: Date.now },
});
WageHistorySchema.index({ tenantId: 1, workerId: 1, startDate: 1 });
exports.WageHistory = mongoose_1.default.model("WageHistory", WageHistorySchema);
