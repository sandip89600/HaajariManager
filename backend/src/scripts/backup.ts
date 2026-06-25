import { exec } from "child_process";
import path from "path";
import fs from "fs";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/haajari";
const BACKUP_DIR = path.join(__dirname, "../../backups");

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

export function runBackup(): Promise<string> {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const archiveName = `backup_${timestamp}.gz`;
    const outputPath = path.join(BACKUP_DIR, archiveName);

    // Command to execute mongodump and output a gzipped archive
    const cmd = `mongodump --uri="${MONGO_URI}" --archive="${outputPath}" --gzip`;

    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error(`Backup execution failed: ${error.message}`);
        return reject(error);
      }
      console.log(`Database backup completed successfully. Saved to: ${outputPath}`);
      resolve(outputPath);
    });
  });
}

// Execute directly if run via CLI
if (require.main === module) {
  console.log("Starting automated database backup...");
  runBackup()
    .then((path) => console.log(`Backup file created at: ${path}`))
    .catch((err) => {
      console.error("Backup script failed:", err);
      process.exit(1);
    });
}
