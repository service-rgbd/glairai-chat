import { Redirect } from "expo-router";

/** Ancienne route racine — renvoie vers les onglets (évite écran bloqué après migration). */
export default function LegacySearchRedirect() {
  return <Redirect href="/(tabs)/(main)" />;
}
