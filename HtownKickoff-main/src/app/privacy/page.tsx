"use client";

import { StaticCmsPage } from "../../components/StaticCmsPage";

const fallbackHtml = `
  <h2 style="color: var(--foreground); margin: 0 0 12px; font-size: 1.25rem;">Information we collect</h2>
  <p style="margin: 0 0 18px;">We collect account details, booking activity, venue interactions, and standard analytics needed to operate MatchWatch.</p>
  <h2 style="color: var(--foreground); margin: 24px 0 12px; font-size: 1.25rem;">How we use it</h2>
  <p style="margin: 0 0 18px;">We use data to provide bookings, improve sports and venue discovery, secure the platform, and communicate account-related updates.</p>
  <h2 style="color: var(--foreground); margin: 24px 0 12px; font-size: 1.25rem;">Sharing and retention</h2>
  <p style="margin: 0;">We share necessary booking data with venue partners and retain operational records only as long as required for service, compliance, and fraud prevention.</p>
`;

export default function PrivacyPage() {
  return (
    <StaticCmsPage
      slug="privacy"
      label="Legal"
      fallbackTitle="Privacy Policy"
      fallbackExcerpt="How MatchWatch collects, uses, and protects platform data."
      fallbackHtml={fallbackHtml}
    />
  );
}
