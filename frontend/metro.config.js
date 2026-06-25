const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
  /\.local\/skills\/\.tmp-.*/,
  /\.local\/skills\/artifacts\/.*/,
  /\.local\/.*/,
];

const originalWatchFolders = config.watchFolders || [];
config.watchFolders = originalWatchFolders.filter((f) => !f.includes(".local"));

module.exports = config;
