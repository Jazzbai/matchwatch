import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Match Point Leaderboard",
  description: "Top predictors playing for the Mercedes-Benz C300 grand prize.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
