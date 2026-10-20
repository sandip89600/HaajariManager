const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

config.resolver.blockList = [
  /\.local\/skills\/\.tmp-.*/,
  /\.local\/skills\/artifacts\/.*/,
  /\.local\/.*/,
];

const originalWatchFolders = config.watchFolders || [];
config.watchFolders = [
  ...originalWatchFolders.filter((f) => !f.includes(".local")),
  projectRoot,
];

// Handle Metro redirect middleware for custom runtimes on Android
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      if (
        req.url &&
        req.url.includes("runtime=custom") &&
        req.url.includes("platform=android")
      ) {
        res.setHeader("Access-Control-Allow-Origin", "*");
      }
      return middleware(req, res, next);
    };
  },
};

module.exports = withNativeWind(config, { input: "./global.css" });
