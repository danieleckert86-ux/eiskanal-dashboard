import { NextResponse } from "next/server";

const WEBCAM_URL = "https://www.eiskanal-augsburg.de/webcam/webcamimage.jpg";
const PAGE_URL = "https://www.eiskanal-augsburg.de/eiskanal-infos/eiskanal-webcam/";

export async function GET() {
  try {
    const image = await fetch(`${WEBCAM_URL}?t=${Date.now()}`, {
      headers: {
        Referer: PAGE_URL,
        "User-Agent": "Mozilla/5.0 Eiskanal-Dashboard/1.0",
      },
      cache: "no-store",
    });
    if (!image.ok) throw new Error("Webcam-Bild nicht erreichbar");
    return new NextResponse(image.body, {
      headers: {
        "Content-Type": image.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "Webcam aktuell nicht verfügbar" }, { status: 502 });
  }
}
