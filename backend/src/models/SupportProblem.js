"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupportProblem = void 0;
var mongoose_1 = require("mongoose");
var SupportProblemSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    userName: { type: String, required: true },
    mobileNumber: { type: String, required: true },
    subject: { type: String, required: true },
    description: { type: String, required: true },
    screenshot: { type: String },
    status: { type: String, enum: ["open", "resolved"], default: "open" },
    createdAt: { type: Date, default: Date.now }
});
exports.SupportProblem = mongoose_1.default.model("SupportProblem", SupportProblemSchema);
