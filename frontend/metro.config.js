const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules")];

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

// Stub out native-only Fabric spec files that cannot be resolved in Expo Go / bare
// bundler environments where the native TurboModule is not compiled in.
// This prevents "Unable to resolve SignInButtonNativeComponent.js" during Android
// and iOS bundling when using Expo Go (development without EAS Build).
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.includes("SignInButtonNativeComponent")) {
    // Return an empty stub so Metro can complete the bundle graph
    return {
      filePath: path.resolve(
        projectRoot,
        "stubs/SignInButtonNativeComponent.js"
      ),
      type: "sourceFile",
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });
