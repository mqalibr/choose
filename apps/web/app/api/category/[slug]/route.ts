import { NextRequest, NextResponse } from "next/server";
import { getCategoryBySlug } from "../../../../lib/queries";
import type { SearchSort } from "../../../../lib/types";

export const revalidate = 180;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function GET(req: NextRequest, { params }: Props) {
  try {
    const { slug } = await params;
    const page = Number(req.nextUrl.searchParams.get("page") ?? "1");
    const limit = Number(req.nextUrl.searchParams.get("limit") ?? "24");
    const sort = (req.nextUrl.searchParams.get("sort") ?? "price_asc") as SearchSort;
    const data = await getCategoryBySlug({ slug, page, limit, sort });

    if (!data) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "s-maxage=180, stale-while-revalidate=600"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: "CATEGORY_FETCH_FAILED", message: (error as Error).message },
      { status: 500 }
    );
  }
}
