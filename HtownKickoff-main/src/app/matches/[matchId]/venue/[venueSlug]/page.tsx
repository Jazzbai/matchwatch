import { redirect } from "next/navigation";

export default async function MatchVenueSharePage({
    params,
}: {
    params: Promise<{ matchId: string; venueSlug: string }>;
}) {
    const { matchId, venueSlug } = await params;
    redirect(`/venues/${venueSlug}?matchId=${matchId}`);
}
