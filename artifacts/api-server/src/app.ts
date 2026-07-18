import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { existsSync } from "node:fs";
import router from "./routes";
import { getChannelAssetsRoot } from "./lib/channel-assets";
import { getFluentEmojiAssetsRoot } from "./lib/emoji-assets";
import { enforceRateLimit, getClientIp } from "./lib/rate-limit";
import { logger } from "./lib/logger";

const app: Express = express();
app.set("trust proxy", true);
const isProduction = process.env["NODE_ENV"] === "production";
const allowedOrigins = (process.env["CORS_ORIGINS"] ?? (isProduction ? "" : "*"))
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  next();
});
app.use(
  cors({
    origin:
      allowedOrigins.length === 0
        ? false
        : allowedOrigins.length === 1 && allowedOrigins[0] === "*"
          ? true
          : allowedOrigins,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: true, limit: "64kb" }));
app.use((req, res, next) => {
  if (!req.path.startsWith("/api/")) {
    next();
    return;
  }
  if (req.path.startsWith("/api/auth/request-otp") || req.path.startsWith("/api/auth/verify-otp")) {
    next();
    return;
  }
  try {
    enforceRateLimit(`api:${getClientIp(req)}`, {
      windowMs: 60_000,
      maxRequests: process.env["NODE_ENV"] === "production" ? 240 : 600,
    });
    next();
  } catch (error) {
    res.status(429).json({
      message: error instanceof Error ? error.message : "Trop de requêtes",
    });
  }
});

const emojiAssetsRoot = getFluentEmojiAssetsRoot();
if (existsSync(emojiAssetsRoot)) {
  logger.info({ emojiAssetsRoot }, "Serving local Fluent Emoji assets");
  app.use(
    "/emojis",
    (_req, res, next) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Cache-Control", "public, max-age=86400");
      next();
    },
    express.static(emojiAssetsRoot, { fallthrough: false, index: false }),
  );
} else {
  logger.warn({ emojiAssetsRoot }, "Fluent Emoji assets folder not found");
}

const channelAssetsRoot = getChannelAssetsRoot();
if (existsSync(channelAssetsRoot)) {
  logger.info({ channelAssetsRoot }, "Serving channel avatar assets");
  app.use(
    "/channel-assets",
    (_req, res, next) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Cache-Control", "public, max-age=604800");
      next();
    },
    express.static(channelAssetsRoot, { fallthrough: false, index: false }),
  );
} else {
  logger.warn({ channelAssetsRoot }, "Channel assets folder not found");
}

app.use("/api", router);

export default app;
