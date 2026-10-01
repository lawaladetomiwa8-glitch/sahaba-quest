import type { Metadata } from "next";
import "./globals.css";
import SiteFooter from "@/components/SiteFooter";

const SITE_URL = "https://sahabaquest.com.ng";
const SITE_NAME = "Sahaba Quest";
const SITE_DESCRIPTION =
  "Sahaba Quest is a gamified Islamic learning platform where Muslims can learn about the Sahabah and Sahabiyat through quizzes, quests, challenges, competitions and leaderboards.";

const SITE_LOGO =
  "https://cdn.phototourl.com/member/2026-09-30-957223ee-05a5-4299-9fc6-c4ca9f12695a.png";

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
        {children}

        <SiteFooter />
      </body>
    </html>
  );
}