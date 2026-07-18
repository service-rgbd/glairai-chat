import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { useAuthToken } from "@/hooks/useAuthToken";
import { getApiBaseUrl } from "@/lib/api-config";
import { isRealtimeSocketEnabled } from "@/lib/runtime-env";

import {
  createChannel,
  createChannelPost,
  deleteChannel,
  deleteChannelPost,
  fetchChannel,
  fetchChannelDiscovery,
  fetchChannelFeed,
  fetchChannelPosts,
  fetchChannels,
  followChannel,
  reactToChannelPost,
  recordChannelPostView,
  reportChannel,
  unfollowChannel,
  updateChannel,
} from "../api";
import type { Channel, ChannelDiscoverySection, ChannelPost } from "../types";

type ChannelsContextValue = {
  discoverySections: ChannelDiscoverySection[];
  followedChannelIds: string[];
  feedPosts: ChannelPost[];
  isLoadingDiscovery: boolean;
  isLoadingFeed: boolean;
  discoveryError: boolean;
  socketConnected: boolean;
  refreshDiscovery: () => Promise<void>;
  refreshFeed: () => Promise<void>;
  searchChannels: (query: string) => Promise<Channel[]>;
  getChannel: (channelId: string) => Promise<Channel>;
  getChannelPosts: (channelId: string) => Promise<ChannelPost[]>;
  createNewChannel: typeof createChannel;
  updateExistingChannel: typeof updateChannel;
  removeChannel: typeof deleteChannel;
  follow: typeof followChannel;
  unfollow: typeof unfollowChannel;
  publishPost: typeof createChannelPost;
  reactToPost: typeof reactToChannelPost;
  reportChannel: typeof reportChannel;
  recordView: typeof recordChannelPostView;
  removePost: typeof deleteChannelPost;
};

const ChannelsContext = createContext<ChannelsContextValue | null>(null);

export function ChannelsProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const authToken = useAuthToken();
  const queryClient = useQueryClient();
  const socketRef = useRef<import("socket.io-client").Socket | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);

  const discoveryQuery = useQuery({
    queryKey: ["channels", "discovery"],
    queryFn: fetchChannelDiscovery,
    enabled: isAuthenticated,
    staleTime: 30_000,
    retry: 1,
  });

  const feedQuery = useQuery({
    queryKey: ["channels", "feed"],
    queryFn: () => fetchChannelFeed(),
    enabled: isAuthenticated,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!isAuthenticated || !authToken || !isRealtimeSocketEnabled()) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      const { io } = await import("socket.io-client");
      if (cancelled) return;

      const socket = io(getApiBaseUrl(), {
        auth: { token: authToken },
        transports: ["websocket", "polling"],
      });
      socketRef.current = socket;

      socket.on("connect", () => setSocketConnected(true));
      socket.on("disconnect", () => setSocketConnected(false));

      socket.on("channel.post.created", () => {
        void queryClient.invalidateQueries({ queryKey: ["channels", "feed"] });
      });
      socket.on("channel.updated", () => {
        void queryClient.invalidateQueries({ queryKey: ["channels"] });
      });
      socket.on("channel.post.deleted", () => {
        void queryClient.invalidateQueries({ queryKey: ["channels", "feed"] });
      });
      socket.on("channel.post.reacted", () => {
        void queryClient.invalidateQueries({ queryKey: ["channels", "feed"] });
      });
    })();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, [authToken, isAuthenticated, queryClient]);

  const refreshDiscovery = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["channels", "discovery"] });
  }, [queryClient]);

  const refreshFeed = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["channels", "feed"] });
  }, [queryClient]);

  const searchChannels = useCallback(async (query: string) => {
    const result = await fetchChannels({ search: query, limit: 30 });
    return result.channels;
  }, []);

  const getChannel = useCallback(async (channelId: string) => {
    const result = await fetchChannel(channelId);
    return result.channel;
  }, []);

  const getChannelPosts = useCallback(async (channelId: string) => {
    const result = await fetchChannelPosts(channelId);
    return result.posts;
  }, []);

  const value = useMemo<ChannelsContextValue>(
    () => ({
      discoverySections: discoveryQuery.data?.sections ?? [],
      followedChannelIds: discoveryQuery.data?.followedChannelIds ?? [],
      feedPosts: feedQuery.data?.posts ?? [],
      isLoadingDiscovery: discoveryQuery.isLoading,
      isLoadingFeed: feedQuery.isLoading,
      discoveryError: discoveryQuery.isError,
      socketConnected,
      refreshDiscovery,
      refreshFeed,
      searchChannels,
      getChannel,
      getChannelPosts,
      createNewChannel: createChannel,
      updateExistingChannel: updateChannel,
      removeChannel: deleteChannel,
      follow: followChannel,
      unfollow: unfollowChannel,
      publishPost: createChannelPost,
      reactToPost: reactToChannelPost,
      reportChannel,
      recordView: recordChannelPostView,
      removePost: deleteChannelPost,
    }),
    [
      discoveryQuery.data,
      discoveryQuery.isLoading,
      discoveryQuery.isError,
      feedQuery.data,
      feedQuery.isLoading,
      socketConnected,
      refreshDiscovery,
      refreshFeed,
      searchChannels,
      getChannel,
      getChannelPosts,
    ],
  );

  return <ChannelsContext.Provider value={value}>{children}</ChannelsContext.Provider>;
}

export function useChannels() {
  const context = useContext(ChannelsContext);
  if (!context) {
    throw new Error("useChannels doit être utilisé dans ChannelsProvider");
  }
  return context;
}
