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
      execSync('powershell -Command "Stop-Process -Id (Get-NetTCPConnection -LocalPort 8081).OwningProcess -Force"', { stdio: "ignore" });
      console.log("[Expo Setup] Terminated existing process on port 8081.");
    } catch (e) {}
  } else {
    try {
      execSync("fuser -k 8081/tcp", { stdio: "ignore" });
      console.log("[Expo Setup] Terminated existing process on port 8081.");
    } catch (e) {}
  }
} catch (err) {}

const args = ["expo", "start"];

// Forward any arguments from command line
process.argv.slice(2).forEach((arg) => {
  args.push(arg);
});

const child = spawn("npx", args, {
  stdio: "inherit",
  shell: true,
  env,
});

child.on("close", (code) => {
  process.exit(code);
});
