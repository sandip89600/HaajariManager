const { execSync, spawn } = require("child_process");
const os = require("os");

const env = { ...process.env };

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        if (iface.address.startsWith("192.168.")) {
          return iface.address;
        }
      }
    }
  }
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}

if (process.env.REPLIT_DEV_DOMAIN) {
  env.EXPO_PACKAGER_PROXY_URL = `https://${process.env.REPLIT_DEV_DOMAIN}`;
  env.REACT_NATIVE_PACKAGER_HOSTNAME = process.env.REPLIT_DEV_DOMAIN;
  console.log(
    `[Expo Setup] Detected Replit Dev Domain. Setting proxy to https://${process.env.REPLIT_DEV_DOMAIN}`,
  );
} else {
  const localIp = getLocalIpAddress();
  if (localIp) {
    env.REACT_NATIVE_PACKAGER_HOSTNAME = localIp;
    console.log(
      `[Expo Setup] Auto-detected active LAN IP: ${localIp}. Setting REACT_NATIVE_PACKAGER_HOSTNAME.`,
    );
  }
}
try {
  console.log("[Expo Setup] Brute-forcing release of port 8081...");
  if (process.platform === "win32") {
    try {
      const output = execSync('netstat -ano | findstr ":8081"', {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
      });
      const lines = output.trim().split("\n");
      const pids = new Set();
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid) && pid !== "0") {
          pids.add(pid);
        }
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
          console.log(
            `[Expo Setup] Terminated existing process PID ${pid} on port 8081.`,
          );
        } catch (kErr) {}
      }
    } catch (e) {}
  } else {
    try {
      execSync("fuser -k 8081/tcp", { stdio: "ignore" });
      console.log("[Expo Setup] Terminated existing process on port 8081.");
    } catch (e) {}
  }
} catch (err) {}

const args = ["expo", "start"];

const userArgs = process.argv.slice(2);
if (!userArgs.includes("--dev-client") && !userArgs.includes("--go")) {
  args.push("--go");
}

userArgs.forEach((arg) => {
  args.push(arg);
});

const isWin = process.platform === "win32";
const command = isWin ? "cmd.exe" : "npx";
const commandArgs = isWin ? ["/c", "npx", ...args] : args;

const child = spawn(command, commandArgs, {
  stdio: "inherit",
  env,
});

child.on("close", (code) => {
  process.exit(code);
});
