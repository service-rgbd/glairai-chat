const { withAppDelegate } = require("@expo/config-plugins");

const VOIP_PUSH_HANDLER = `
- (void)pushRegistry:(PKPushRegistry *)registry didUpdatePushCredentials:(PKPushCredentials *)credentials forType:(PKPushType)type {
  [RNVoipPushNotificationManager didUpdatePushCredentials:credentials forType:(NSString *)type];
}

- (void)pushRegistry:(PKPushRegistry *)registry didReceiveIncomingPushWithPayload:(PKPushPayload *)payload forType:(PKPushType)type withCompletionHandler:(void (^)(void))completion {
  NSDictionary *data = payload.dictionaryPayload;
  NSString *callId = data[@"callId"];
  if (callId == nil || [callId length] == 0) {
    callId = [[NSUUID UUID] UUIDString];
  }
  NSString *callerName = data[@"callerName"];
  if (callerName == nil || [callerName length] == 0) {
    callerName = @"Appel entrant";
  }
  NSString *callType = data[@"callType"];
  BOOL hasVideo = [callType isEqualToString:@"video"];

  [RNVoipPushNotificationManager addCompletionHandler:callId completionHandler:completion];
  [RNVoipPushNotificationManager didReceiveIncomingPushWithPayload:payload forType:(NSString *)type];

  [RNCallKeep reportNewIncomingCall:callId
                               handle:callId
                           handleType:@"generic"
                             hasVideo:hasVideo
                  localizedCallerName:callerName
                      supportsHolding:YES
                         supportsDTMF:YES
                     supportsGrouping:NO
                   supportsUngrouping:NO
                          fromPushKit:YES
                              payload:data
                withCompletionHandler:nil];
}
`;

/**
 * Branche PushKit + CallKit natif dans AppDelegate (iOS).
 * - voipRegistration au démarrage (token VoIP ASAP)
 * - reportNewIncomingCall dans le handler push (écran verrouillé, iOS 13+)
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
        `#import "AppDelegate.h"\n#import <PushKit/PushKit.h>\n#import "RNVoipPushNotificationManager.h"\n#import "RNCallKeep.h"`,
      );
    }

    if (!contents.includes("RNCallKeep.h") && contents.includes("RNVoipPushNotificationManager.h")) {
      contents = contents.replace(
        /#import "RNVoipPushNotificationManager.h"/,
        `#import "RNVoipPushNotificationManager.h"\n#import "RNCallKeep.h"`,
      );
    }

    if (!contents.includes("voipRegistration")) {
      contents = contents.replace(
        /return \[super application:application didFinishLaunchingWithOptions:launchOptions\];/,
        `  [RNVoipPushNotificationManager voipRegistration];\n  return [super application:application didFinishLaunchingWithOptions:launchOptions];`,
      );
    }

    const pushHandlerRegex =
      /- \(void\)pushRegistry:\(PKPushRegistry \*\)registry didUpdatePushCredentials:[\s\S]*?withCompletionHandler:[\s\S]*?\n\}/m;

    if (pushHandlerRegex.test(contents)) {
      contents = contents.replace(pushHandlerRegex, VOIP_PUSH_HANDLER.trim());
    } else if (!contents.includes("didReceiveIncomingPushWithPayload")) {
      contents = contents.replace(/\n@end\s*$/, `${VOIP_PUSH_HANDLER}\n@end\n`);
    }

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = withVoipPush;
