function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function calendarDayDiff(from: Date, to: Date) {
  const fromDay = startOfLocalDay(from).getTime();
  const toDay = startOfLocalDay(to).getTime();
  return Math.round((toDay - fromDay) / 86_400_000);
}

function pluralize(value: number, singular: string, plural: string) {
  return value <= 1 ? singular : plural;
}

/** Clé stable pour regrouper par jour calendaire (fuseau local). */
export function getHistoryDateKey(iso: string) {
  const date = new Date(iso);
  const day = startOfLocalDay(date);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}

/** Libellé de section d'historique : Aujourd'hui, Hier, Avant-hier, dates, semaines, mois, ans. */
export function formatHistorySectionLabel(iso: string, now = new Date()) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const diffDays = calendarDayDiff(date, now);
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Hier";
  if (diffDays === 2) return "Avant-hier";
  if (diffDays < 7) {
    return date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  }

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffDays < 30) {
    return diffWeeks <= 1 ? "Il y a une semaine" : `Il y a ${diffWeeks} semaines`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffDays < 365) {
    return diffMonths <= 1 ? "Il y a un mois" : `Il y a ${diffMonths} mois`;
  }

  const diffYears = Math.floor(diffDays / 365);
  return diffYears <= 1 ? "Il y a 1 an" : `Il y a ${diffYears} ans`;
}

/** Horodatage compact pour listes (conversations, appels). */
export function formatTimestamp(iso: string, now = new Date()) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const diffDays = calendarDayDiff(date, now);
  if (diffDays === 0) {
    return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return "Hier";
  if (diffDays === 2) return "Avant-hier";
  if (diffDays < 7) {
    return date.toLocaleDateString("fr-FR", { weekday: "short" });
  }

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffDays < 30) {
    return diffWeeks <= 1 ? "Il y a une semaine" : `Il y a ${diffWeeks} ${pluralize(diffWeeks, "semaine", "semaines")}`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffDays < 365) {
    return diffMonths <= 1 ? "Il y a un mois" : `Il y a ${diffMonths} mois`;
  }

  const diffYears = Math.floor(diffDays / 365);
  return diffYears <= 1 ? "Il y a 1 an" : `Il y a ${diffYears} ans`;
}

export function groupItemsByHistoryDate<T extends { timestamp: string }>(items: T[]) {
  const sorted = [...items].sort((left, right) => right.timestamp.localeCompare(left.timestamp));
  const sections: Array<{ key: string; title: string; data: T[] }> = [];

  for (const item of sorted) {
    const key = getHistoryDateKey(item.timestamp);
    const title = formatHistorySectionLabel(item.timestamp);
    const last = sections[sections.length - 1];
    if (last?.key === key) {
      last.data.push(item);
    } else {
      sections.push({ key, title, data: [item] });
    }
  }

  return sections;
}
