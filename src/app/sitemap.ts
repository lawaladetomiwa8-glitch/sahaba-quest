import type { MetadataRoute } from "next";

const BASE_URL = "https://sahabaquest.com.ng";

const sahabahSlugs = [
  "abu-bakr-as-siddiq",
  "umar-ibn-al-khattab",
  "uthman-ibn-affan",
  "ali-ibn-abi-talib",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/pricing`, changeFrequency: "weekly", priority: 0.9 },
    {
      url: `${BASE_URL}/sponsored-competitions`,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/sahabah`,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    ...sahabahSlugs.map((slug) => ({
      url: `${BASE_URL}/sahabah/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.75,
    })),
    { url: `${BASE_URL}/signup`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/login`, changeFrequency: "monthly", priority: 0.5 },
    {
      url: `${BASE_URL}/update-password`,
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];
}
