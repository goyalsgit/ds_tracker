import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f0f4f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1117" },
  ],
};

export const metadata: Metadata = {
  title: "DSA Tracker | Spaced Repetition for LeetCode",
  description: "Master DSA with smart spaced repetition. Track LeetCode problems, schedule revisions, and learn patterns efficiently.",
  keywords: ["DSA", "LeetCode", "spaced repetition", "coding practice", "algorithm", "data structures"],
  authors: [{ name: "DSA Tracker" }],
  openGraph: {
    title: "DSA Tracker | Spaced Repetition for LeetCode",
    description: "Master DSA with smart spaced repetition. Track LeetCode problems, schedule revisions.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
