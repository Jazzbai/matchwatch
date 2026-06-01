import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Choose a New Password",
  description: "Set a new password for your MatchWatch account.",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
