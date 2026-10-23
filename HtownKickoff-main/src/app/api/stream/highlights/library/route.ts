import { NextRequest } from 'next/server';
import { requestOwner, videoTicket } from '../../../../../lib/highlights/access';
import { failure, reply } from '../../../../../lib/highlights/http';
import { listLibrary } from '../../../../../lib/highlights/library';
import { twelveLabsFromEnv } from '../../../../../lib/highlights/twelvelabs';

export const runtime = 'nodejs';

/** ScorePlay media already indexed by TwelveLabs, each with a signed selection ticket. */
export async function GET(request: NextRequest) {
  try {
    const owner = await requestOwner(request);
    const videos = await listLibrary(twelveLabsFromEnv(), request.nextUrl.searchParams.get('refresh') === 'true');
    // Provider IDs stay on the server; the browser selects a video through a signed ticket.
    return reply({
      videos: videos.map(video => ({
        ticket: videoTicket(video.indexedAssetId, owner), name: video.name, duration: video.duration, thumbnail: video.thumbnail,
        playbackUrl: video.playbackUrl, scoreplay: video.scoreplay, orientation: video.orientation,
      })),
    });
  } catch (error) {
    return failure(error);
  }
}
