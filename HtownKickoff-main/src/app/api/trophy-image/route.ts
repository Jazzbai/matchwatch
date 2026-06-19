import { NextResponse } from "next/server";

const TROPHY_URL =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/FIFA_World_Cup_Trophy_cropped.jpg/247px-FIFA_World_Cup_Trophy_cropped.jpg";

export const revalidate = 86400; // cache for 24 h

export async function GET() {
  try {
    const res = await fetch(TROPHY_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FootWatch/1.0)",
        Referer: "https://en.wikipedia.org/",
      },
      next: { revalidate: 86400 },
    });

    if (!res.ok) {
      return new NextResponse("Image unavailable", { status: 502 });
    }

    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600",
      },
    });
  } catch {
    return new NextResponse("Image unavailable", { status: 502 });
  }
}
