import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sahaba Quest",
  description: "Learn, remember and compete with the Sahabah.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
