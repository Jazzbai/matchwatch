import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Watch-Party Venues",
  description: "Bars and restaurants hosting football watch parties across the US.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
