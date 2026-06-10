import { and, eq, inArray } from "drizzle-orm";

import {
  channelFollowersTable,
  channelsTable,
  db,
  deviceTokensTable,
  hasDatabase,
  usersTable,
} from "@workspace/db";

import { logger } from "./logger";

type ChannelPostNotificationInput = {
  channelId: string;
  channelName: string;
  postPreview: string;
  excludeUserId?: string;
};

async function sendExpoChannelPush(
  devices: { pushToken: string }[],
  title: string,
  body: string,
  channelId: string,
) {
  const validTokens = devices
    .map((device) => device.pushToken)
    .filter((token) => token.startsWith("ExponentPushToken["));

  if (!validTokens.length) return;

  const payload = validTokens.map((to) => ({
    to,
    title,
    body: body.slice(0, 160),
    sound: "default",
    priority: "high" as const,
    channelId: "channels",
    data: {
      type: "channel_post",
      channelId,
    },
  }));

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      logger.warn({ status: response.status }, "Channel push request failed");
    }
  } catch (error) {
    logger.warn({ err: error }, "Channel push request error");
  }
}

export async function notifyChannelSubscribersOfNewPost(input: ChannelPostNotificationInput) {
  if (!hasDatabase || !db) return;

  const followers = await db
    .select({ userId: channelFollowersTable.userId })
    .from(channelFollowersTable)
    .where(eq(channelFollowersTable.channelId, input.channelId));

  const recipientIds = followers
    .map((row) => row.userId)
    .filter((userId) => userId !== input.excludeUserId);

  if (!recipientIds.length) return;

  const devices = await db
    .select({ pushToken: deviceTokensTable.pushToken, userId: deviceTokensTable.userId })
    .from(deviceTokensTable)
    .innerJoin(usersTable, eq(usersTable.id, deviceTokensTable.userId))
    .where(
      and(
        inArray(deviceTokensTable.userId, recipientIds),
        eq(usersTable.notificationsEnabled, true),
      ),
    );

  if (!devices.length) return;

  const [channel] = await db
    .select({ name: channelsTable.name })
    .from(channelsTable)
    .where(eq(channelsTable.id, input.channelId))
    .limit(1);

  const title = channel?.name ?? input.channelName;
  await sendExpoChannelPush(devices, title, input.postPreview, input.channelId);
}
