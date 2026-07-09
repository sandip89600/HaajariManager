"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runBackup = runBackup;
var child_process_1 = require("child_process");
var path_1 = require("path");
var fs_1 = require("fs");
var MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/haajari";
var BACKUP_DIR = path_1.default.join(__dirname, "../../backups");
if (!fs_1.default.existsSync(BACKUP_DIR)) {
    fs_1.default.mkdirSync(BACKUP_DIR, { recursive: true });
}
function runBackup() {
    return new Promise(function (resolve, reject) {
        var timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        var archiveName = "backup_".concat(timestamp, ".gz");
        var outputPath = path_1.default.join(BACKUP_DIR, archiveName);
        // Command to execute mongodump and output a gzipped archive
        var cmd = "mongodump --uri=\"".concat(MONGO_URI, "\" --archive=\"").concat(outputPath, "\" --gzip");
        (0, child_process_1.exec)(cmd, function (error, stdout, stderr) {
            if (error) {
                console.error("Backup execution failed: ".concat(error.message));
                return reject(error);
            }
            console.log("Database backup completed successfully. Saved to: ".concat(outputPath));
            resolve(outputPath);
        });
    });
}
// Execute directly if run via CLI
if (require.main === module) {
    console.log("Starting automated database backup...");
    runBackup()
        .then(function (path) { return console.log("Backup file created at: ".concat(path)); })
        .catch(function (err) {
        console.error("Backup script failed:", err);
        process.exit(1);
    });
}
