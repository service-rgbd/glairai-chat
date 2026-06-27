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

function channelAvatar(filename: string) {
  return `/channel-assets/${filename}`;
}

/**
 * Chaînes officielles Gbairai — les autres créateurs s'inscrivent via l'app (+).
 */
const DEMO_CHANNELS = [
  {
    id: `${DEMO_CHANNEL_PREFIX}gbairai`,
    name: "Gbairai Officiel",
    description: "Nouveautés, astuces et annonces officielles de la messagerie Gbairai.",
    category: "Organisations",
    avatarUrl: channelAvatar("gbairai-officiel.png"),
    isVerified: true,
    followersCount: 18_400,
    posts: [
      "Bienvenue sur Gbairai ! Les Chaînes vous permettent de suivre vos marques et créateurs préférés.",
      "Créez votre propre chaîne avec le bouton + si vous êtes commerçant, artisan ou créateur de contenu.",
    ],
  },
  {
    id: `${DEMO_CHANNEL_PREFIX}union_vendeuses`,
    name: "Union pour les vendeuses",
    description: "Solidarité, formations et informations pour les vendeuses ambulantes.",
    category: "Organisations",
    avatarUrl: channelAvatar("union-vendeuses.png"),
    isVerified: true,
    followersCount: 42_000,
    posts: ["Réunion mensuelle ce samedi — horaire et lieu dans le prochain message."],
  },
  {
    id: `${DEMO_CHANNEL_PREFIX}br_groupe`,
    name: "Astuce immobiliers (Br-Groupe)",
    description: "Conseils achat, location et investissement immobilier en Côte d'Ivoire.",
    category: "Organisations",
    avatarUrl: channelAvatar("br-groupe.png"),
    isVerified: false,
    followersCount: 28_500,
    posts: ["5 points à vérifier avant de signer un bail commercial à Abidjan."],
  },
  {
    id: `${DEMO_CHANNEL_PREFIX}annonce_metier`,
    name: "Annonce métier",
    description: "Opportunités professionnelles, recrutements et annonces B2B.",
    category: "Organisations",
    avatarUrl: channelAvatar("annonce-metier.png"),
    isVerified: false,
    followersCount: 15_200,
    posts: ["Publiez vos offres d'emploi et demandes de partenariat directement sur votre chaîne Gbairai."],
  },
  {
    id: `${DEMO_CHANNEL_PREFIX}maracana`,
    name: "Maracana Football",
    description: "Actualités foot, résultats et débats autour du ballon rond.",
    category: "Sport",
    avatarUrl: channelAvatar("maracana.png"),
    isVerified: true,
    followersCount: 186_000,
    posts: ["Résumé des matchs du week-end — classement et prochaines affiches."],
  },
  {
    id: `${DEMO_CHANNEL_PREFIX}mondial_2026`,
    name: "Mondial 2026 États-Unis",
    description:
      "Coupe du monde FIFA 2026 — groupes, matchs, résultats et actualités depuis les États-Unis, le Canada et le Mexique.",
    category: "Sport",
    avatarUrl: channelAvatar("mondial-2026.png"),
    isVerified: true,
    followersCount: 3_200_000,
    posts: [
      "🏆 Coupe du monde 2026 : suivez le calendrier, les équipes qualifiées et les grandes affiches.",
      "🇺🇸 🇨🇦 🇲🇽 Trois pays hôtes — toute l'actualité de la compétition sur cette chaîne.",
    ],
  },
  {
    id: `${DEMO_CHANNEL_PREFIX}salon_coiffure`,
    name: "Annonce Salon de coiffure",
    description: "Promotions coiffure, tresses, soins capillaires et prise de rendez-vous.",
    category: "Style De Vie",
    avatarUrl: channelAvatar("salon-coiffure.png"),
    isVerified: false,
    followersCount: 9_800,
    posts: ["Offre du mois : -20 % sur les tresses — réservez par message sur la chaîne."],
  },
  {
    id: `${DEMO_CHANNEL_PREFIX}massage`,
    name: "Massage",
    description: "Bien-être, relaxation et soins à domicile ou en institut.",
    category: "Style De Vie",
    avatarUrl: channelAvatar("massage.png"),
    isVerified: false,
    followersCount: 12_300,
    posts: ["Nouveaux créneaux disponibles en soirée — contactez-nous pour réserver."],
  },
  {
    id: `${DEMO_CHANNEL_PREFIX}cave_restaurant`,
    name: "Cave restaurant",
    description: "Carte des vins, menus du jour et événements gastronomiques.",
    category: "Style De Vie",
    avatarUrl: channelAvatar("cave-restaurant.png"),
    isVerified: false,
    followersCount: 21_000,
    posts: ["Menu dégustation du vendredi — réservez votre table dès maintenant."],
  },
  {
    id: `${DEMO_CHANNEL_PREFIX}restauration`,
    name: "Restauration",
    description: "Annonces restauration, food trucks, traiteurs et bonnes adresses.",
    category: "Style De Vie",
    avatarUrl: channelAvatar("restauration.png"),
    isVerified: false,
    followersCount: 34_600,
    posts: ["Les meilleures adresses maquis & grillades d'Abidjan — suggestions bienvenues !"],
  },
  {
    id: `${DEMO_CHANNEL_PREFIX}cuisine_netflix`,
    name: "Cuisine Netflix Officiel",
    description: "Recettes inspirées des séries et tendances culinaires.",
    category: "Divertissement",
    avatarUrl: channelAvatar("cuisine-netflix.png"),
    isVerified: true,
    followersCount: 512_000,
    posts: ["Recette du jour : le plat culte de la série que tout le monde regarde en ce moment."],
  },
  {
    id: `${DEMO_CHANNEL_PREFIX}rap_ivoire`,
    name: "Rap Ivoire Africa",
    description: "Rap ivoirien, nouveautés, clips et culture urbaine.",
    category: "Divertissement",
    avatarUrl: channelAvatar("rap-ivoire.png"),
    isVerified: true,
    followersCount: 97_000,
    posts: ["Nouveau son en écoute — soutenez le rap made in CI !"],
  },
  {
    id: `${DEMO_CHANNEL_PREFIX}spotify`,
    name: "Spotify",
    description: "Playlists, sorties albums et découvertes musicales.",
    category: "Divertissement",
    isVerified: true,
    followersCount: 2_100_000,
    posts: ["Playlist Afrobeats du moment — écoutez les hits de la semaine."],
  },
  {
    id: `${DEMO_CHANNEL_PREFIX}tiktok`,
    name: "Tiktok",
    description: "Tendances, créateurs et défis du moment.",
    category: "Divertissement",
    avatarUrl: channelAvatar("tiktok.png"),
    isVerified: true,
    followersCount: 1_450_000,
    posts: ["Les 10 créateurs ivoiriens à suivre cette semaine sur TikTok."],
  },
  {
    id: `${DEMO_CHANNEL_PREFIX}poeme_amour`,
    name: "Poème d'AMour",
    description: "Poèmes, citations romantiques et textes à partager.",
    category: "Divertissement",
    avatarUrl: channelAvatar("poeme-amour.png"),
    isVerified: false,
    followersCount: 156_000,
    posts: ["« Aimer, c'est donner sans compter le temps. » — Bonne soirée à tous."],
  },
] as const;

async function ensureDemoOwner() {
  const [existing] = await db!
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, DEMO_OWNER_ID))
    .limit(1);

  if (existing) return existing.id;

  await db!.insert(usersTable).values({
    id: DEMO_OWNER_ID,
    phone: "+22500000000",
    normalizedPhone: "+22500000000",
    countryCode: "CI",
    name: "Gbairai Démo",
    bio: "Compte système pour les chaînes officielles.",
    statusText: "Chaînes officielles",
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
      avatarUrl: "avatarUrl" in demo ? demo.avatarUrl : null,
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

  console.log(`Seed terminé : ${seeded.length} chaînes officielles créées.`);
  for (const row of seeded) {
    console.log(`- [${row.category}] ${row.name} (${row.id})`);
  }

  await pool?.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
