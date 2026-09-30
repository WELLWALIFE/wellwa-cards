// Music library for the Ad Builder (files in bridge/music/<key>.mp3).
import { NextResponse } from "next/server";
import { musicList } from "@/lib/media/music";
export async function GET() { return NextResponse.json({ tracks: musicList() }); }
