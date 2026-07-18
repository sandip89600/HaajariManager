const { spawn } = require("child_process");
const os = require("os");
const net = require("net");

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

function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (err) => {
      if (err.code === "EADDRINUSE") {
        resolve(false);
      } else {
        resolve(true);
      }
    });
    server.once("listening", () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

async function findFreePort(startPort) {
  let port = startPort;
  while (true) {
    const available = await checkPort(port);
    if (available) {
      return port;
    }
    port++;
  }
}

async function main() {
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

  const defaultPort = 8081;
  const targetPort = await findFreePort(defaultPort);

  const args = ["expo", "start"];

  const hasPortArg = process.argv.includes("--port") || process.argv.includes("-p");
  if (!hasPortArg && targetPort !== defaultPort) {
    console.log(`[Expo Setup] Port ${defaultPort} is busy. Automatically switching to free port: ${targetPort}`);
    args.push("--port", String(targetPort));
  }

  // Forward any other arguments from command line
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
}

main().catch((err) => {
  console.error("Failed to start Expo dev server:", err);
  process.exit(1);
});
