import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Match Point — QR Predictions",
  description: "Scan the QR at a host venue, predict the winner and exact score, and play for the Mercedes-Benz C300 grand prize.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
