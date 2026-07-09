"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var multer_1 = require("multer");
var path_1 = require("path");
var fs_1 = require("fs");
var s3_1 = require("../utils/s3");
var auth_1 = require("../middleware/auth");
var router = (0, express_1.Router)();
// Setup Multer memory storage
var storage = multer_1.default.memoryStorage();
var upload = (0, multer_1.default)({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // limit size to 5MB
    },
    fileFilter: function (req, file, cb) {
        var filetypes = /jpeg|jpg|png/;
        var mimetype = filetypes.test(file.mimetype);
        var extname = filetypes.test(path_1.default.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error("Only JPEG, JPG, and PNG images are allowed"));
    },
});
router.post("/", auth_1.authenticateJWT, upload.single("image"), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var url_1, uploadsDir, uniqueSuffix, fileExtension, fileName, filePath, host, url, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                if (!req.file) {
                    return [2 /*return*/, res.status(400).json({ error: "No image file provided" })];
                }
                if (!(0, s3_1.isS3Configured)()) return [3 /*break*/, 2];
                return [4 /*yield*/, (0, s3_1.uploadToS3)(req.file.buffer, req.file.originalname, req.file.mimetype)];
            case 1:
                url_1 = _a.sent();
                return [2 /*return*/, res.json({ url: url_1 })];
            case 2:
                uploadsDir = path_1.default.join(__dirname, "../../uploads");
                // Verify uploads directory exists, if not, create it
                if (!fs_1.default.existsSync(uploadsDir)) {
                    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
                }
                uniqueSuffix = Date.now() + "_" + Math.round(Math.random() * 1e9);
                fileExtension = path_1.default.extname(req.file.originalname).toLowerCase();
                fileName = "".concat(uniqueSuffix).concat(fileExtension);
                filePath = path_1.default.join(uploadsDir, fileName);
                // Write file buffer to local disk
                fs_1.default.writeFileSync(filePath, req.file.buffer);
                host = req.get("host");
                url = "".concat(req.protocol, "://").concat(host, "/uploads/").concat(fileName);
                res.json({ url: url });
                return [3 /*break*/, 4];
            case 3:
                error_1 = _a.sent();
                res.status(500).json({ error: error_1.message });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
exports.default = router;
