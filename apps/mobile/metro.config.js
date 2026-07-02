const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Firebase JS SDK + Expo SDK 50+ fix: Metro's package-exports resolution (on by
// default) loads Firebase's ESM build, which fails to register the auth component
// under Hermes ("Component auth has not been registered yet"). Disabling package
// exports and adding `cjs` makes Metro use Firebase's CommonJS/RN entry instead.
config.resolver.sourceExts.push('cjs');
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
