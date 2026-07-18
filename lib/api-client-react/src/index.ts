export * from "./generated/api";
export * from "./generated/api.schemas";
export {
  customFetch,
  setBaseUrl,
  setAuthTokenGetter,
  setOfflineMutationGuard,
  setOtpDemoRequests,
  setUnauthorizedHandler,
} from "./custom-fetch";
export type { AuthTokenGetter } from "./custom-fetch";
