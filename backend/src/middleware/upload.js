"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadAudio = void 0;
var multer_1 = require("multer");
var path = require("path");
var storage = multer_1.default.memoryStorage();
exports.uploadAudio = (0, multer_1.default)({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // limit size to 10MB
    },
    fileFilter: function (req, file, cb) {
        var filetypes = /mp3|mp4|mpeg|mpga|m4a|wav|webm|ogg/;
        var mimetype = filetypes.test(file.mimetype);
        var extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype || extname) {
            return cb(null, true);
        }
        cb(new Error("Only audio files are allowed (mp3, mp4, mpeg, mpga, m4a, wav, webm, ogg)"));
    },
});
