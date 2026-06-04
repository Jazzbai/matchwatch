import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "World Cup Watch Party Package",
  description: "Turn your venue into a World Cup destination. A $12,650 hospitality package — landing page, reservation system, 34 match-day pages, jersey parties, and a 35-campaign content calendar — delivered before June 11 kickoff.",
  openGraph: {
    title: "World Cup Watch Party Package — MatchWatch",
    description: "More fans. More reservations. More revenue. More exposure. Delivered before opening match.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
