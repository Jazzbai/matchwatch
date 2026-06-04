import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "World Cup 2026 Watch Parties",
  description: "Reserve your table for FIFA World Cup 2026 — every match, every kickoff.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
