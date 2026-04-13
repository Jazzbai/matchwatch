"use client";

import { StaticCmsPage } from "../../components/StaticCmsPage";

const fallbackHtml = `
  <h2 style="color: var(--foreground); margin: 0 0 12px; font-size: 1.25rem;">Use of the service</h2>
  <p style="margin: 0 0 18px;">By using MatchWatch, you agree to the platform rules, booking policies, and the requirement to provide accurate account information.</p>
  <h2 style="color: var(--foreground); margin: 24px 0 12px; font-size: 1.25rem;">Bookings and venue listings</h2>
  <p style="margin: 0 0 18px;">Venues remain responsible for their listings and booking fulfilment. MatchWatch facilitates discovery and reservation workflow but does not operate the venue itself.</p>
  <h2 style="color: var(--foreground); margin: 24px 0 12px; font-size: 1.25rem;">Content and enforcement</h2>
  <p style="margin: 0;">We may remove abusive, misleading, or unlawful content and suspend accounts that undermine platform integrity.</p>
`;

export default function TermsPage() {
  return (
    <StaticCmsPage
      slug="terms"
      label="Legal"
      fallbackTitle="Terms of Service"
      fallbackExcerpt="The terms that govern use of MatchWatch, venue bookings, and platform content."
      fallbackHtml={fallbackHtml}
    />
  );
}
