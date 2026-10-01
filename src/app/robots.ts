import type { MetadataRoute } from "next";

const BASE_URL = "https://sahabaquest.com.ng";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/api/",
          "/dashboard/",
          "/profile/",
          "/progress/",
          "/leaderboard/",
          "/challenges/",
          "/daily-quest/",
          "/quiz/",
          "/payment/",
          "/family-dashboard/",
          "/family-profile/",
          "/family-progress/",
          "/family-leaderboard/",
          "/family-quest/",
          "/family-challenges/",
          "/family-members/",
          "/family-member-dashboard/",
          "/family-member-challenges/",
          "/family-member-daily-quest/",
          "/family-member-leaderboard/",
          "/family-member-login/",
          "/family-member-quiz/",
          "/family-member-test/",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}