import "./bootstrap-env";
import { createServer } from "node:http";

import { hasDatabase, runSqlMigrations } from "@workspace/db";
import app from "./app";
import { initializeCallSessionStore } from "./lib/call-session-store";
import { getEmoji3dCatalog } from "./lib/emoji-catalog";
import { attachRealtime } from "./lib/realtime";
import { logger } from "./lib/logger";
import { getOtpSmsStatus } from "./lib/sms-service";

const rawPort = process.env["PORT"] ?? "5000";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = createServer(app);
attachRealtime(httpServer);

httpServer.on("error", (err) => {
  logger.error({ err }, "Error listening on port");
  process.exit(1);
});

async function startServer() {
  if (hasDatabase) {
    try {
      const result = await runSqlMigrations();
      if (!result.skipped) {
        logger.info({ applied: result.applied }, "SQL migrations applied");
      }
    } catch (error) {
      logger.error({ err: error }, "SQL migrations failed");
      process.exit(1);
    }
  }

  httpServer.listen(port, () => {
    logger.info({ port }, "Server listening");
    logger.info(getOtpSmsStatus(), "OTP SMS configuration");
    void initializeCallSessionStore()
      .then((loaded) => {
        logger.info({ count: loaded ?? 0 }, "Call sessions hydrated");
      })
      .catch((error: unknown) => {
        logger.warn({ err: error }, "Call session hydration skipped");
      });
    void getEmoji3dCatalog()
      .then((catalog) => {
        logger.info({ count: catalog.items.length }, "Emoji 3D catalog ready");
      })
      .catch((error: unknown) => {
        logger.warn({ err: error }, "Emoji 3D catalog unavailable");
      });
  });
}

void startServer();
