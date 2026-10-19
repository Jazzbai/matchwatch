import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Outfit, Space_Grotesk } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import { AuthProvider } from "../lib/auth-context";
import RouteDataProvider from "../components/RouteDataProvider";
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

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://matchwatch.us"),
  title: {
    default: "MatchWatch — Find Your World Cup 2026 Watch Party",
    template: "%s | MatchWatch",
  },
  description:
    "MatchWatch helps fans discover venues, create watch-party bookings, and follow live football match events across local leagues.",
  keywords: [
    "matchwatch.us",
    "MatchWatch",
    "football watch party",
    "sports venues",
    "venue bookings",
    "match events",
    "World Cup 2026",
  ],
  openGraph: {
    title: "MatchWatch — Find Your World Cup 2026 Watch Party",
    description:
      "Discover venues, sync live matches, and run watch-party bookings in one platform.",
    type: "website",
    images: ["/logo.svg"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/logo.svg", type: "image/svg+xml" },
    ],
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
      className={`${inter.variable} ${mono.variable} ${outfit.variable} ${spaceGrotesk.variable}`}
    >
      <body suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" enableSystem={false} disableTransitionOnChange>
          <AuthProvider><RouteDataProvider>{children}</RouteDataProvider></AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
