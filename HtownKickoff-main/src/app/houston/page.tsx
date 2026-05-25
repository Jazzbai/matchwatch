import type { Metadata } from "next";
import { HoustonClient } from "./_components/HoustonClient";

export const metadata: Metadata = {
  title: "Houston World Cup 2026 — Matches, Fan Festival & Watch Party Venues | MatchWatch",
  description:
    "Everything you need for World Cup 2026 in Houston: 7 matches at NRG Stadium, FIFA Fan Festival at Discovery Green, and the best watch party venues in the city.",
};

export default function HoustonPage() {
  return <HoustonClient />;
}
