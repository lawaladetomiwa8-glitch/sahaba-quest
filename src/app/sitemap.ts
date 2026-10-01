import type { MetadataRoute } from "next";

const BASE_URL = "https://sahabaquest.com.ng";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE_URL, changeFrequency: "weekly", priority: 1 },
    {
      url: `${BASE_URL}/about`,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/pricing`,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/sahabah`,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/sahabah/abu-bakr-as-siddiq`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/sahabah/umar-ibn-al-khattab`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/sahabah/uthman-ibn-affan`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/sahabah/ali-ibn-talib`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/sponsored-competitions`,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/signup`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/login`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/update-password`,
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];
}
