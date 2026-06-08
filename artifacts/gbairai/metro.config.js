const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");
const livekitEnabled = process.env.EXPO_PUBLIC_LIVEKIT_ENABLED === "true";
const nativeCallUiEnabled = process.env.EXPO_PUBLIC_NATIVE_CALL_UI === "true";
const livekitStubPath = path.resolve(projectRoot, "lib/stubs/livekit-react-native.tsx");
const callKeepStubPath = path.resolve(projectRoot, "lib/stubs/react-native-callkeep.ts");
const voipPushStubPath = path.resolve(
  projectRoot,
  "lib/stubs/react-native-voip-push-notification.ts",
);

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];
config.resolver.unstable_enableSymlinks = true;
// pnpm: allow Metro to walk up from nested .pnpm packages (expo-router → expo).
config.resolver.disableHierarchicalLookup = false;

function resolvePackageDir(name) {
  try {
    return path.dirname(require.resolve(`${name}/package.json`, { paths: [projectRoot] }));
  } catch {
    return null;
  }
}

const pinnedPackages = [
  "expo",
  "expo-constants",
  "expo-router",
  "react",
  "react-native",
  "@expo/metro-runtime",
];

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  ...Object.fromEntries(
    pinnedPackages
      .map((name) => [name, resolvePackageDir(name)])
      .filter((entry) => entry[1] != null),
  ),
};

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (!livekitEnabled && moduleName === "@livekit/react-native") {
    return {
      filePath: livekitStubPath,
      type: "sourceFile",
    };
  }

  if (!nativeCallUiEnabled && moduleName === "react-native-callkeep") {
    return {
      filePath: callKeepStubPath,
      type: "sourceFile",
    };
  }

  if (!nativeCallUiEnabled && moduleName === "react-native-voip-push-notification") {
    return {
      filePath: voipPushStubPath,
      type: "sourceFile",
    };
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
