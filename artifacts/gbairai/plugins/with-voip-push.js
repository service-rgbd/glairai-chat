const { withAppDelegate } = require("@expo/config-plugins");

/**
 * Branche react-native-voip-push-notification dans AppDelegate (iOS).
 * Nécessite un rebuild EAS ; ignoré en Expo Go (stub Metro).
 */
function withVoipPush(config) {
  return withAppDelegate(config, (config) => {
    if (config.modResults.language !== "objc" && config.modResults.language !== "objcpp") {
      return config;
    }

    let contents = config.modResults.contents;

    if (!contents.includes("RNVoipPushNotificationManager.h")) {
      contents = contents.replace(
        /#import "AppDelegate.h"/,
        `#import "AppDelegate.h"\n#import "RNVoipPushNotificationManager.h"`,
      );
    }

    if (!contents.includes("[RNVoipPushNotificationManager voipRegistration]")) {
      contents = contents.replace(
        /self\.initialProps = @{};/,
        `self.initialProps = @{};\n  [RNVoipPushNotificationManager voipRegistration];`,
      );
    }

    if (!contents.includes("didReceiveIncomingPushWithPayload")) {
      const pushHandler = `
- (void)pushRegistry:(PKPushRegistry *)registry didUpdatePushCredentials:(PKPushCredentials *)credentials forType:(PKPushType)type {
  [RNVoipPushNotificationManager didUpdatePushCredentials:credentials forType:(NSString *)type];
}

- (void)pushRegistry:(PKPushRegistry *)registry didReceiveIncomingPushWithPayload:(PKPushPayload *)payload forType:(PKPushType)type withCompletionHandler:(void (^)(void))completion {
  [RNVoipPushNotificationManager didReceiveIncomingPushWithPayload:payload forType:(NSString *)type];
  completion();
}
`;
      contents = contents.replace(/\n@end\s*$/, `${pushHandler}\n@end\n`);
    }

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = withVoipPush;
