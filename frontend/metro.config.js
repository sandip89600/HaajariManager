const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
  /\.local\/skills\/\.tmp-.*/,
  /\.local\/skills\/artifacts\/.*/,
  /\.local\/.*/,
];

const originalWatchFolders = config.watchFolders || [];
config.watchFolders = originalWatchFolders.filter((f) => !f.includes(".local"));

module.exports = withNativeWind(config, { input: './global.css' });
