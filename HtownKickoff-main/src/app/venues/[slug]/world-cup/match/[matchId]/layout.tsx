import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "World Cup Match Day",
  description: "Reserve a table for this FIFA World Cup 2026 match. Kickoff details, specials, and reservation packages.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
