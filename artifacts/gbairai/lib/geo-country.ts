import { getApiBaseUrl } from "./api-config";

export type GeoCountryResponse = {
  countryCode: string | null;
  source: "ip" | "unknown";
};

export function getDeviceRegionCode() {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const region = locale.split("-")[1]?.toUpperCase();
    if (region && /^[A-Z]{2}$/.test(region)) {
      return region;
    }
  } catch {
    // ignore
  }
  return null;
}

export async function fetchSuggestedCountryCode() {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/metadata/geo`, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as GeoCountryResponse;
    return payload.countryCode;
  } catch {
    return null;
  }
}

export function resolvePreferredCountryCode(
  countries: Array<{ code: string }>,
  options?: { geoCountryCode?: string | null; deviceRegionCode?: string | null },
) {
  const candidates = [
    options?.geoCountryCode,
    options?.deviceRegionCode,
    "US",
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const match = countries.find((country) => country.code === candidate.toUpperCase());
    if (match) return match.code;
  }

  return countries[0]?.code ?? "US";
}
