import { eq, inArray, like } from "drizzle-orm";

import {
  channelAdminsTable,
  channelPostsTable,
  channelsTable,
  db,
  hasDatabase,
  pool,
  usersTable,
} from "../src/index";

const DEMO_OWNER_ID = "demo_channels_owner";
const DEMO_CHANNEL_PREFIX = "demo_chn_";

const DEMO_CHANNELS = [
  {
    id: `${DEMO_CHANNEL_PREFIX}actualites_ci`,
    name: "Gouvernement de Côte d'Ivoire",
    description: "Actualités officielles et informations citoyennes.",
    category: "Actualités Et Informations",
    isVerified: true,
    followersCount: 442_000,
    posts: [
      "Bienvenue sur la chaîne officielle. Retrouvez ici les communiqués et annonces importantes.",
      "Rappel : les démarches administratives en ligne restent disponibles 24h/24.",
    ],
  },
  {
    id: `${DEMO_CHANNEL_PREFIX}who`,
    name: "World Health Organization",
    description: "Santé publique, prévention et alertes internationales.",
    category: "Actualités Et Informations",
    isVerified: true,
    followersCount: 7_200_000,
    posts: ["Conseils santé de la semaine : hydratation, sommeil et activité physique modérée."],
  },
  {
    id: `${DEMO_CHANNEL_PREFIX}infos_abidjan`,
    name: "Abidjan Infos",
    description: "Fil d'actualité local : trafic, météo, événements.",
    category: "Actualités Et Informations",
    isVerified: false,
    followersCount: 89_000,
    posts: ["Ce soir : forte affluence attendue sur le boulevard Latrille."],
  },
  {
    id: `${DEMO_CHANNEL_PREFIX}nos_sport`,
    name: "NOS Sport",
    description: "Résultats, analyses et temps forts du sport.",
    category: "Sport",
    isVerified: true,
    followersCount: 230_000,
    posts: ["Match en direct ce soir — suivez le résumé minute par minute sur la chaîne."],
  },
  {
    id: `${DEMO_CHANNEL_PREFIX}marca`,
    name: "Marca",
    description: "Football, transferts et compétitions européennes.",
    category: "Sport",
    isVerified: true,
    followersCount: 1_300_000,
    posts: ["Mercato : les dernières rumeurs du jour en Ligue 1 et Liga."],
  },
  {
    id: `${DEMO_CHANNEL_PREFIX}foot_ci`,
    name: "Football Côte d'Ivoire",
    description: "Éléphants, championnat national et sélection.",
    category: "Sport",
    isVerified: false,
    followersCount: 156_000,
    posts: ["Allez les Éléphants ! Préparation du prochain rassemblement national."],
  },
  {
    id: `${DEMO_CHANNEL_PREFIX}julie_hair`,
    name: "Julie Hair",
    description: "Coiffure, soins et inspirations beauté.",
    category: "Style De Vie",
    isVerified: false,
    followersCount: 41_000,
    posts: ["3 coiffures faciles pour la semaine — tuto photo dans la prochaine publication."],
  },
  {
    id: `${DEMO_CHANNEL_PREFIX}maman_vie`,
    name: "Maman ❤️ ma vie",
    description: "Parentalité, quotidien et astuces famille.",
    category: "Style De Vie",
    isVerified: false,
    followersCount: 67_000,
    posts: ["Organiser la rentrée sans stress : la checklist qui change tout."],
  },
  {
    id: `${DEMO_CHANNEL_PREFIX}ecole_ci`,
    name: "L'École 🏢 Ivoirienne 🇨🇮",
    description: "Éducation, orientation et réussite scolaire.",
    category: "Style De Vie",
    isVerified: false,
    followersCount: 34_000,
    posts: ["Rentrée scolaire : pensez à vérifier les horaires de votre établissement."],
  },
  {
    id: `${DEMO_CHANNEL_PREFIX}ufc`,
    name: "Union des Femmes pour la Charité",
    description: "Actions solidaires et appels aux dons.",
    category: "Organisations",
    isVerified: true,
    followersCount: 28_000,
    posts: ["Merci à toutes les bénévoles mobilisées ce week-end pour la distribution alimentaire."],
  },
  {
    id: `${DEMO_CHANNEL_PREFIX}armee_nation`,
    name: "Armée-Nation CI",
    description: "Informations institutionnelles et civisme.",
    category: "Organisations",
    isVerified: true,
    followersCount: 512_000,
    posts: ["Journée portes ouvertes : programme et conditions d'accès."],
  },
  {
    id: `${DEMO_CHANNEL_PREFIX}gbairai`,
    name: "Gbairai Officiel",
    description: "Nouveautés produit, astuces et annonces de la messagerie.",
    category: "Organisations",
    isVerified: true,
    followersCount: 12_500,
    posts: [
      "Les Chaînes sont disponibles dans Gbairai — suivez vos créateurs préférés !",
      "Astuce : activez les notifications pour ne rien manquer des publications.",
    ],
  },
  {
    id: `${DEMO_CHANNEL_PREFIX}tiktok_music`,
    name: "Tik tok Music 🎧🎶",
    description: "Tendances sonores et playlists du moment.",
    category: "Divertissement",
    isVerified: false,
    followersCount: 890_000,
    posts: ["Top 5 des sons qui cartonnent cette semaine en Afrique de l'Ouest."],
  },
  {
    id: `${DEMO_CHANNEL_PREFIX}spotify`,
    name: "Spotify",
    description: "Sorties albums, playlists éditoriales et découvertes.",
    category: "Divertissement",
    isVerified: true,
    followersCount: 10_300_000,
    posts: ["Nouvelle playlist Afrobeats — écoutez les titres du moment."],
  },
  {
    id: `${DEMO_CHANNEL_PREFIX}poeme_amour`,
    name: "Poème D'amour 💕",
    description: "Textes romantiques et citations à partager.",
    category: "Divertissement",
    isVerified: false,
    followersCount: 124_000,
    posts: ["« L'amour grandit quand on prend le temps de l'écouter. »"],
  },
] as const;

async function ensureDemoOwner() {
  const [existing] = await db!
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, DEMO_OWNER_ID))
    .limit(1);

  if (existing) return existing.id;

  const [firstUser] = await db!.select({ id: usersTable.id }).from(usersTable).limit(1);
  if (firstUser) return firstUser.id;

  await db!.insert(usersTable).values({
    id: DEMO_OWNER_ID,
    phone: "+22500000000",
    normalizedPhone: "+22500000000",
    countryCode: "CI",
    name: "Gbairai Démo",
    bio: "Compte système pour les chaînes d'illustration.",
    statusText: "Chaînes démo",
    color: "#6D4AFF",
    isOnboarded: true,
  });

  return DEMO_OWNER_ID;
}

async function main() {
  if (!hasDatabase || !db) {
    throw new Error("DATABASE_URL manquant — impossible d'exécuter le seed.");
  }

  const ownerId = await ensureDemoOwner();
  const now = new Date();

  await db
    .delete(channelPostsTable)
    .where(like(channelPostsTable.channelId, `${DEMO_CHANNEL_PREFIX}%`));
  await db.delete(channelAdminsTable).where(like(channelAdminsTable.channelId, `${DEMO_CHANNEL_PREFIX}%`));
  await db.delete(channelsTable).where(like(channelsTable.id, `${DEMO_CHANNEL_PREFIX}%`));

  for (const demo of DEMO_CHANNELS) {
    await db.insert(channelsTable).values({
      id: demo.id,
      name: demo.name,
      description: demo.description,
      ownerId,
      category: demo.category,
      isVerified: demo.isVerified,
      isPublic: true,
      followersCount: demo.followersCount,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(channelAdminsTable).values({
      channelId: demo.id,
      userId: ownerId,
      role: "owner",
    });

    for (const [index, content] of demo.posts.entries()) {
      await db.insert(channelPostsTable).values({
        id: `demo_chp_${demo.id}_${index + 1}`,
        channelId: demo.id,
        authorId: ownerId,
        content,
        mediaType: "text",
        viewsCount: Math.floor(demo.followersCount * 0.05) + index * 120,
        reactionsCount: Math.floor(demo.followersCount * 0.008) + index * 15,
        createdAt: new Date(now.getTime() - (demo.posts.length - index) * 3_600_000),
      });
    }
  }

  const seeded = await db
    .select({ id: channelsTable.id, name: channelsTable.name, category: channelsTable.category })
    .from(channelsTable)
    .where(inArray(channelsTable.id, DEMO_CHANNELS.map((item) => item.id)));

  console.log(`Seed terminé : ${seeded.length} chaînes d'illustration créées.`);
  for (const row of seeded) {
    console.log(`- [${row.category}] ${row.name} (${row.id})`);
  }

  await pool?.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
