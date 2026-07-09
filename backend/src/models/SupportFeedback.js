"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupportFeedback = void 0;
var mongoose_1 = require("mongoose");
var SupportFeedbackSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    userName: { type: String, required: true },
    mobileNumber: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    feedback: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
exports.SupportFeedback = mongoose_1.default.model("SupportFeedback", SupportFeedbackSchema);
