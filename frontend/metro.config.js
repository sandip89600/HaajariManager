const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
];

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

module.exports = withNativeWind(config, { input: "./global.css" });
