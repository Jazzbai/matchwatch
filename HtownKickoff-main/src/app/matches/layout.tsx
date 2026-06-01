import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Football Matches",
  description: "Live and upcoming football fixtures with the bars showing them near you.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
