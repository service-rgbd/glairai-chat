import { type Href, router } from "expo-router";

const SEARCH_FALLBACK: Href = "/(tabs)/(main)";

/** Retour sûr : back si possible, sinon replace (évite GO_BACK non géré). */
export function goBackOrReplace(fallbackHref: Href) {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace(fallbackHref);
}

/** Ferme la recherche globale (écran dans la pile tabs). */
export function leaveOverlayScreen(fallbackHref: Href = SEARCH_FALLBACK) {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace(fallbackHref);
}

/** Ouvre la recherche globale dans la pile tabs (retour fiable). */
export function openGlobalSearch() {
  router.push("/(tabs)/search");
}
