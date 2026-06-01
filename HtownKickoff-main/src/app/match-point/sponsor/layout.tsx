import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Match Point — For Venues & Sponsors",
  description: "Run the Match Point QR campaign at your bar or sponsor the tournament-wide prize pool.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
