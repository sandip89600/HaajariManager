"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Payment = void 0;
var mongoose_1 = require("mongoose");
var PaymentSchema = new mongoose_1.Schema({
    tenantId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Tenant", required: true },
    workerId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Worker", required: true },
    year: { type: Number, required: true },
    month: { type: Number, required: true },
    amount: { type: Number, required: true, min: 0 },
    paidAt: { type: Date, default: Date.now },
    note: { type: String },
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    method: { type: String, enum: ["Cash", "UPI", "Bank Transfer"], default: "Cash" },
});
PaymentSchema.index({ tenantId: 1, workerId: 1, year: 1, month: 1 });
exports.Payment = mongoose_1.default.model("Payment", PaymentSchema);
