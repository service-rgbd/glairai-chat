import "./bootstrap-env";
import { createServer } from "node:http";

import app from "./app";
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

httpServer.listen(port, () => {
  logger.info({ port }, "Server listening");
  logger.info(getOtpSmsStatus(), "OTP SMS configuration");
  void getEmoji3dCatalog()
    .then((catalog) => {
      logger.info({ count: catalog.items.length }, "Emoji 3D catalog ready");
    })
    .catch((error: unknown) => {
      logger.warn({ err: error }, "Emoji 3D catalog unavailable");
    });
});
