import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Predict to Win",
  description: "Predict the match result at this venue and you could win a prize.",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
