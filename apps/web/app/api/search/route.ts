import { NextRequest, NextResponse } from "next/server";
import { searchProducts } from "../../../lib/queries";
import type { SearchSort } from "../../../lib/types";

export const revalidate = 120;

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q") ?? "";
    const page = Number(req.nextUrl.searchParams.get("page") ?? "1");
    const limit = Number(req.nextUrl.searchParams.get("limit") ?? "24");
    const sort = (req.nextUrl.searchParams.get("sort") ?? "relevance") as SearchSort;

    const data = await searchProducts({ q, page, limit, sort });
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "s-maxage=120, stale-while-revalidate=300"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: "SEARCH_FAILED", message: (error as Error).message },
      { status: 500 }
    );
  }
}
