// GET (bearer) ?as= → the workspace owner's products (name, price) for sales and quotations.
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { resolveScope } from "@/lib/crm-server";
import { productsOf } from "@/lib/crm-pro3";

export async function GET(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const scope = await resolveScope(me, new URL(request.url).searchParams.get("as"));
  if (!scope) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  return NextResponse.json({ products: await productsOf(scope.ownerId) });
}
