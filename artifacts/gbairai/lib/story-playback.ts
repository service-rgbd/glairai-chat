import { router } from "expo-router";

import type { GStory, GUser } from "@/contexts/chats-types";

export function sortStoriesChronologically(stories: GStory[]) {
  return [...stories].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
}

export function getFirstStoryToPlay(stories: GStory[], viewerId: string) {
  const sorted = sortStoriesChronologically(stories);
  return sorted.find((story) => !story.viewerIds.includes(viewerId)) ?? sorted[0] ?? null;
}

function latestStoryTime(stories: GStory[]) {
  return Math.max(...stories.map((story) => new Date(story.createdAt).getTime()));
}

function fallbackStoryUser(userId: string): GUser {
  return {
    id: userId,
    name: "Contact",
    phone: "",
    avatar: null,
    bio: "",
    status: "",
    lastSeen: null,
    initials: "?",
    color: "#6D4AFF",
  };
}

export function groupStoriesByUser(options: {
  stories: GStory[];
  users: Record<string, GUser>;
  currentUserId: string;
  isUserBlocked?: (userId: string) => boolean;
}) {
  const { stories, users, currentUserId, isUserBlocked } = options;
  const byUserId = new Map<string, GStory[]>();

  for (const story of stories) {
    if (story.userId === currentUserId) continue;
    if (isUserBlocked?.(story.userId)) continue;
    const list = byUserId.get(story.userId) ?? [];
    list.push(story);
    byUserId.set(story.userId, list);
  }

  return Array.from(byUserId.entries())
    .map(([userId, userStories]) => ({
      user: users[userId] ?? fallbackStoryUser(userId),
      stories: sortStoriesChronologically(userStories),
    }))
    .sort((left, right) => latestStoryTime(right.stories) - latestStoryTime(left.stories));
}

export function buildStoryViewerQueue(
  stories: GStory[],
  users: Record<string, GUser>,
  currentUserId: string,
) {
  const groups = groupStoriesByUser({ stories, users, currentUserId }).map((group) => ({
    userId: group.user.id,
    stories: group.stories,
  }));

  const recent = groups
    .filter((group) => group.stories.some((story) => !story.viewerIds.includes(currentUserId)))
    .sort((left, right) => latestStoryTime(right.stories) - latestStoryTime(left.stories));

  const viewed = groups
    .filter((group) => group.stories.every((story) => story.viewerIds.includes(currentUserId)))
    .sort((left, right) => latestStoryTime(right.stories) - latestStoryTime(left.stories));

  return [...recent, ...viewed].map((group) => group.userId);
}

export function encodeStoryQueue(queue: string[]) {
  return queue.join(",");
}

export function decodeStoryQueue(raw: string | string[] | undefined) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value?.trim()) return [];
  return value.split(",").filter(Boolean);
}

export function openStoryViewer(options: {
  storyId: string;
  userId: string;
  queue?: string[];
}) {
  const queue = options.queue?.length ? encodeStoryQueue(options.queue) : undefined;
  router.push({
    pathname: "/story/[id]",
    params: {
      id: options.storyId,
      userId: options.userId,
      ...(queue ? { queue } : {}),
    },
  });
}

export function replaceStoryViewer(options: {
  storyId: string;
  userId: string;
  queue?: string[];
}) {
  const queue = options.queue?.length ? encodeStoryQueue(options.queue) : undefined;
  router.replace({
    pathname: "/story/[id]",
    params: {
      id: options.storyId,
      userId: options.userId,
      ...(queue ? { queue } : {}),
    },
  });
}

export function openUserStories(options: {
  stories: GStory[];
  users: Record<string, GUser>;
  targetUserId: string;
  currentUserId: string;
  includeQueue?: boolean;
}) {
  const userStories = options.stories.filter((story) => story.userId === options.targetUserId);
  const first = getFirstStoryToPlay(userStories, options.currentUserId);
  if (!first) return;

  const queue =
    options.includeQueue !== false && options.targetUserId !== options.currentUserId
      ? buildStoryViewerQueue(options.stories, options.users, options.currentUserId)
      : [options.targetUserId];

  openStoryViewer({
    storyId: first.id,
    userId: options.targetUserId,
    queue,
  });
}

export function getNextStoryNavigation(options: {
  stories: GStory[];
  users: Record<string, GUser>;
  currentUserId: string;
  userId: string;
  storyId: string;
  queue: string[];
}) {
  const userStories = sortStoriesChronologically(
    options.stories.filter((story) => story.userId === options.userId),
  );
  const currentIndex = userStories.findIndex((story) => story.id === options.storyId);

  if (currentIndex >= 0 && currentIndex < userStories.length - 1) {
    return {
      storyId: userStories[currentIndex + 1]!.id,
      userId: options.userId,
      queue: options.queue,
    };
  }

  const queueIndex = options.queue.indexOf(options.userId);
  if (queueIndex >= 0) {
    for (let index = queueIndex + 1; index < options.queue.length; index += 1) {
      const nextUserId = options.queue[index]!;
      const nextStories = options.stories.filter((story) => story.userId === nextUserId);
      const first = getFirstStoryToPlay(nextStories, options.currentUserId);
      if (first) {
        return {
          storyId: first.id,
          userId: nextUserId,
          queue: options.queue,
        };
      }
    }
  }

  return null;
}

export function getPreviousStoryNavigation(options: {
  stories: GStory[];
  currentUserId: string;
  userId: string;
  storyId: string;
  queue: string[];
}) {
  const userStories = sortStoriesChronologically(
    options.stories.filter((story) => story.userId === options.userId),
  );
  const currentIndex = userStories.findIndex((story) => story.id === options.storyId);

  if (currentIndex > 0) {
    return {
      storyId: userStories[currentIndex - 1]!.id,
      userId: options.userId,
      queue: options.queue,
    };
  }

  const queueIndex = options.queue.indexOf(options.userId);
  if (queueIndex > 0) {
    for (let index = queueIndex - 1; index >= 0; index -= 1) {
      const previousUserId = options.queue[index]!;
      const previousStories = sortStoriesChronologically(
        options.stories.filter((story) => story.userId === previousUserId),
      );
      const last = previousStories[previousStories.length - 1];
      if (last) {
        return {
          storyId: last.id,
          userId: previousUserId,
          queue: options.queue,
        };
      }
    }
  }

  return null;
}
