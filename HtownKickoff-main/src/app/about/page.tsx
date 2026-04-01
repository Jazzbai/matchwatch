"use client";

import { StaticCmsPage } from "../../components/StaticCmsPage";

const fallbackHtml = `
  <h2 style="color: var(--foreground); margin: 0 0 12px; font-size: 1.25rem;">Our mission</h2>
  <p style="margin: 0 0 18px;">MatchWatch helps fans discover the best places to watch live sports, book ahead, and follow leagues, teams, and players in one product.</p>
  <h2 style="color: var(--foreground); margin: 24px 0 12px; font-size: 1.25rem;">What we do</h2>
  <p style="margin: 0 0 18px;">We combine sports schedules, venue watch-party listings, editorial content, and booking tools so the path from fixture to seat is direct.</p>
  <h2 style="color: var(--foreground); margin: 24px 0 12px; font-size: 1.25rem;">Coverage</h2>
  <p style="margin: 0;">The platform is expanding league by league. Official sports data stays source-managed, while MatchWatch editorial and venue content are managed through the dashboard.</p>
`;

export default function AboutPage() {
  return (
    <StaticCmsPage
      slug="about"
      label="About"
      fallbackTitle="About MatchWatch"
      fallbackExcerpt="MatchWatch is building the sports watch-party layer for live fixtures, teams, players, and venues."
      fallbackHtml={fallbackHtml}
    />
  );
}
