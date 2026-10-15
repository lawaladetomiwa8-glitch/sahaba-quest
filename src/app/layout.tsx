
import type { Metadata } from "next";
import "./globals.css";
import SiteFooter from "@/components/SiteFooter";
import { Analytics } from "@vercel/analytics/next";

const SITE_URL = "https://sahabaquest.com.ng";
const SITE_NAME = "Sahaba Quest";

const SITE_DESCRIPTION =
  "Play Islamic quiz games and explore the lives, stories, and lessons of the Sahaba and Sahabiyat. Learn Islamic history through quizzes, quests, challenges and competitions for individuals, families, schools and madrasas.";

const SITE_LOGO =
  "https://cdn.phototourl.com/member/2026-09-30-957223ee-05a5-4299-9fc6-c4ca9f12695a.png";

/* =========================================================
   STRUCTURED DATA
   Helps search engines understand Sahaba Quest,
   its official website, organisation and logo.
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
      logo: {
        "@type": "ImageObject",
        url: SITE_LOGO,
      },
      description: SITE_DESCRIPTION,
      telephone: "+2349060479725",
      email: "info@sahabaquest.com.ng",
      address: {
        "@type": "PostalAddress",
        streetAddress: "26b, Oluwalogbon Street Off Car Wash",
        addressLocality: "Oworonshoki",
        addressRegion: "Lagos State",
        addressCountry: "NG",
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

/* =========================================================
   GLOBAL SEO METADATA
========================================================= */

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: {
    default: "Sahaba Quest | Islamic Quiz Games & Learning",
    template: "%s | Sahaba Quest",
  },

  description: SITE_DESCRIPTION,

  keywords: [
    "Sahaba Quest",
    "Sahaba games",
    "Sohaba games",
    "Sahaba quiz",
    "Sohaba quiz",
    "Sahaba Quest game",
    "Islamic quiz games",
    "Islamic games",
    "Muslim quiz games",
    "Islamic educational games",
    "Islamic learning games",
    "Islamic history quiz",
    "Companions of Prophet Muhammad",
    "Sahaba and Sahabiyat",
    "Sahabiyat quiz",
    "Muslim family learning",
    "Islamic games for schools",
    "Islamic learning for children",
    "Islamic education platform",
    "Islamic quizzes and competitions",
    "Islamic learning for madrasas",
  ],

  applicationName: SITE_NAME,
  category: "education",

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
    locale: "en_NG",
    title: "Sahaba Quest | Islamic Quiz Games & Learning",
    description:
      "Discover Islamic quiz games, explore the stories of the Sahaba and Sahabiyat, and learn Islamic history through interactive quests and competitions.",
    images: [
      {
        url: SITE_LOGO,
        alt: "Sahaba Quest Islamic learning platform",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Sahaba Quest | Islamic Quiz Games & Learning",
    description:
      "Explore Islamic history, play Sahaba quizzes and discover interactive Islamic learning for individuals, families and schools.",
    images: [SITE_LOGO],
  },
};

/* =========================================================
   ROOT LAYOUT
========================================================= */

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
            __html: JSON.stringify(structuredData).replace(
              /</g,
              "\\u003c"
            ),
          }}
        />

        {children}

        <SiteFooter />

        <Analytics />
      </body>
    </html>
  );
}
