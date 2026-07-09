import multer = require("multer");
import * as path from "path";

const storage = multer.memoryStorage();

export const uploadAudio = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // limit size to 10MB
  },
  fileFilter: (req, file, cb) => {
    const filetypes = /mp3|mp4|mpeg|mpga|m4a|wav|webm|ogg/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype || extname) {
      return cb(null, true);
    }
    cb(new Error("Only audio files are allowed (mp3, mp4, mpeg, mpga, m4a, wav, webm, ogg)"));
  },
});
