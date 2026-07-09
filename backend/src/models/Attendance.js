"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Attendance = void 0;
var mongoose_1 = require("mongoose");
var AttendanceSchema = new mongoose_1.Schema({
    tenantId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Tenant", required: true },
    workerId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Worker", required: true },
    projectId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Project" },
    year: { type: Number, required: true },
    month: { type: Number, required: true },
    day: { type: Number, required: true },
    value: { type: mongoose_1.Schema.Types.Mixed, required: true },
    dailyRate: { type: Number },
    customWage: { type: Number },
    finalPay: { type: Number },
    overtimeHours: { type: Number },
    overtimeWage: { type: Number },
    location: {
        latitude: { type: Number },
        longitude: { type: Number },
        accuracy: { type: Number },
    },
    timestamp: { type: Date, default: Date.now },
});
AttendanceSchema.index({ tenantId: 1, workerId: 1, year: 1, month: 1, day: 1 }, { unique: true });
AttendanceSchema.index({ tenantId: 1, year: 1, month: 1 });
exports.Attendance = mongoose_1.default.model("Attendance", AttendanceSchema);
