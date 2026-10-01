import type { Metadata } from "next";
import "./globals.css";
import SiteFooter from "@/components/SiteFooter";

const SITE_URL = "https://sahabaquest.com.ng";
const SITE_NAME = "Sahaba Quest";
const SITE_DESCRIPTION =
  "Sahaba Quest is a gamified Islamic learning platform where Muslims can learn about the Sahabah and Sahabiyat through quizzes, quests, challenges, competitions and leaderboards.";

const SITE_LOGO =
  "https://cdn.phototourl.com/member/2026-09-30-957223ee-05a5-4299-9fc6-c4ca9f12695a.png";

/* =========================================================
   STRUCTURED DATA
   Helps search engines and AI systems understand:
   - Sahaba Quest
   - Deen Skyline Limited
   - The official website
   - Official logo
   - Business contact information
========================================================= */

const structuredData = {
  "@context": "https://schema.org",

  "@graph": [
    {
      "@type": "Organization",

      "@id": `${SITE_URL}/#organization`,

      name: SITE_NAME,

      legalName: "Deen Skyline Limited",

      url: SITE_URL,

      logo: SITE_LOGO,

      description: SITE_DESCRIPTION,

      telephone: "+2349060479725",

      email: "info@sahabaquest.com.ng",

      address: {
        "@type": "PostalAddress",

        streetAddress:
          "26b, Oluwalogbon Street Off Car Wash",

        addressLocality: "Oworonshoki",

        addressRegion: "Lagos State",

        addressCountry: "NG",
      },

      parentOrganization: {
        "@type": "Organization",

        name: "Deen Skyline Limited",
      },
    },

    {
      "@type": "WebSite",

      "@id": `${SITE_URL}/#website`,

      url: SITE_URL,

      name: SITE_NAME,

      description: SITE_DESCRIPTION,

      publisher: {
        "@id": `${SITE_URL}/#organization`,
      },

      inLanguage: "en",
    },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: SITE_NAME,

  description: SITE_DESCRIPTION,

  keywords: [
    "Sahaba Quest",
    "Sahabah",
    "Sahabiyat",
    "Islamic learning",
    "Islamic education",
    "Islamic quiz",
    "Islamic quizzes",
    "Islamic games",
    "Muslim learning platform",
    "Islamic learning platform",
    "Companions of the Prophet",
    "Islamic history",
  ],

  alternates: {
    canonical: SITE_URL,
  },

  robots: {
    index: true,
    follow: true,

    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },

  icons: {
    icon: SITE_LOGO,
    apple: SITE_LOGO,
  },

  openGraph: {
    type: "website",

    url: SITE_URL,

    siteName: SITE_NAME,

    title: SITE_NAME,

    description: SITE_DESCRIPTION,

    images: [
      {
        url: SITE_LOGO,

        alt: "Sahaba Quest",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",

    title: SITE_NAME,

    description: SITE_DESCRIPTION,

    images: [SITE_LOGO],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              structuredData
            ).replace(/</g, "\\u003c"),
          }}
        />

        {children}

        <SiteFooter />
      </body>
    </html>
  );
}