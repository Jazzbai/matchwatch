import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Outfit } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { AuthProvider } from "../lib/auth-context";
import { DataProvider } from "../lib/data-provider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "matchwatch.us | MatchWatch",
  description:
    "MatchWatch helps fans discover venues, create watch-party bookings, and follow live football match events across local leagues.",
  keywords: [
    "matchwatch.us",
    "MatchWatch",
    "football watch party",
    "sports venues",
    "venue bookings",
    "match events",
  ],
  openGraph: {
    title: "matchwatch.us | MatchWatch",
    description:
      "Discover venues, sync live matches, and run watch-party bookings in one platform.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0C0E12",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} ${outfit.variable}`} suppressHydrationWarning>
      <body className="noise" suppressHydrationWarning>
        <AuthProvider><DataProvider>{children}</DataProvider></AuthProvider>
      </body>
    </html>
  );
}
