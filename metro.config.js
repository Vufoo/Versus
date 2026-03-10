const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable inline requires so that require() calls inside functions are evaluated
// lazily (only when the function runs), not eagerly at bundle startup.
// This prevents native-module-heavy packages like expo-notifications from being
// evaluated at startup in Expo Go, where those native modules don't exist.
config.transformer.getTransformOptions = async () => ({
  transform: {
    inlineRequires: true,
  },
});

module.exports = config;
