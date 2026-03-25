import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Outfit } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import { AuthProvider } from "../lib/auth-context";
import { DataProvider } from "../lib/data-provider";
import { ThemeProvider } from "@/components/theme-provider";

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
  variable: "--font-outfit",
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
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${mono.variable} ${outfit.variable}`}
    >
      <body suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <AuthProvider><DataProvider>{children}</DataProvider></AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
