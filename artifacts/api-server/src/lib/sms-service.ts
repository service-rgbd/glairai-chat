import { logger } from "./logger";

const AFRICA_COUNTRY_CODES = new Set([
  "DZ", "AO", "BJ", "BW", "BF", "BI", "CM", "CV", "CF", "TD", "KM", "CG", "CD", "CI", "DJ",
  "EG", "GQ", "ER", "SZ", "ET", "GA", "GM", "GH", "GN", "GW", "KE", "LS", "LR", "LY", "MG",
  "MW", "ML", "MR", "MU", "MA", "MZ", "NA", "NE", "NG", "RW", "ST", "SN", "SC", "SL", "SO",
  "ZA", "SS", "SD", "TZ", "TG", "TN", "UG", "ZM", "ZW",
]);

type AfricasTalkingResponse = {
  SMSMessageData?: {
    Message?: string;
    Recipients?: Array<{
      number?: string;
      status?: string;
      statusCode?: number;
      cost?: string;
    }>;
  };
};

export function isAfricasTalkingCountry(countryCode: string) {
  return AFRICA_COUNTRY_CODES.has(countryCode.toUpperCase());
}

export function isOtpSmsEnabled() {
  return process.env["OTP_SMS_ENABLED"] === "true";
}

function getAfricasTalkingConfig() {
  const apiKey = process.env["AFRICAS_TALKING_API_KEY"]?.trim();
  const username = process.env["AFRICAS_TALKING_USERNAME"]?.trim();
  if (!apiKey || !username) {
    return null;
  }

  const sandbox =
    process.env["AFRICAS_TALKING_SANDBOX"] === "true" || username.toLowerCase() === "sandbox";

  return {
    apiKey,
    username,
    sandbox,
    senderId: process.env["AFRICAS_TALKING_SENDER_ID"]?.trim() || undefined,
    baseUrl: sandbox
      ? "https://api.sandbox.africastalking.com/version1/messaging"
      : "https://api.africastalking.com/version1/messaging",
  };
}

export function getOtpSmsStatus() {
  const config = getAfricasTalkingConfig();
  return {
    enabled: isOtpSmsEnabled(),
    africasTalkingConfigured: Boolean(config),
    sandbox: config?.sandbox ?? false,
    username: config?.username ?? null,
  };
}

/** Renvoie le code OTP dans la réponse API uniquement hors production explicite. */
export function shouldExposeOtpDemoCode() {
  if (process.env["NODE_ENV"] === "production") {
    return process.env["OTP_DEMO_CODE_ENABLED"] === "true";
  }
  return process.env["OTP_DEMO_CODE_ENABLED"] !== "false";
}

export async function sendOtpSms(input: {
  phoneE164: string;
  code: string;
  countryCode: string;
}) {
  if (!isOtpSmsEnabled()) {
    logger.warn("OTP SMS skipped: OTP_SMS_ENABLED is not true");
    return { sent: false as const, provider: null, reason: "disabled" as const };
  }

  if (!isAfricasTalkingCountry(input.countryCode)) {
    logger.warn({ countryCode: input.countryCode }, "OTP SMS skipped: unsupported region");
    return { sent: false as const, provider: null, reason: "unsupported_region" as const };
  }

  const config = getAfricasTalkingConfig();
  if (!config) {
    throw new Error("Configuration Africa's Talking manquante (AFRICAS_TALKING_USERNAME / API KEY)");
  }

  const body = new URLSearchParams({
    username: config.username,
    to: input.phoneE164,
    message: `Gbairai: votre code de verification est ${input.code}. Il expire dans 5 minutes.`,
  });

  if (config.senderId && !config.sandbox) {
    body.set("from", config.senderId);
  }

  const response = await fetch(config.baseUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      apiKey: config.apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  let payload: AfricasTalkingResponse;
  try {
    payload = (await response.json()) as AfricasTalkingResponse;
  } catch {
    throw new Error("Réponse SMS invalide");
  }

  if (!response.ok) {
    throw new Error(payload.SMSMessageData?.Message ?? "Impossible d'envoyer le SMS OTP");
  }

  const recipient = payload.SMSMessageData?.Recipients?.[0];
  const isSuccess =
    recipient?.status === "Success" ||
    recipient?.statusCode === 101 ||
    payload.SMSMessageData?.Message === "Sent to 1/1 Total Cost";

  if (!isSuccess) {
    throw new Error(recipient?.status ?? payload.SMSMessageData?.Message ?? "SMS non délivré");
  }

  logger.info(
    {
      provider: "africas_talking",
      countryCode: input.countryCode,
      sandbox: config.sandbox,
      cost: recipient?.cost ?? null,
    },
    "OTP SMS sent",
  );

  return { sent: true as const, provider: "africas_talking" as const };
}
