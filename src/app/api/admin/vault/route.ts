// Password storage was intentionally removed. Supabase Auth is the sole
// credential authority; passwords must never be copied into application data.

export function GET() {
  return Response.json(
    { error: "Password vault removed. Use Supabase password reset." },
    { status: 410 },
  );
}

export const POST = GET;
export const DELETE = GET;
