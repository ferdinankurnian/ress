const { getDefaultConfig } = require("expo/metro-config");
const config = getDefaultConfig(__dirname);
// Keep native builds comfortable on smaller development machines.
config.maxWorkers = 2;
module.exports = config;
