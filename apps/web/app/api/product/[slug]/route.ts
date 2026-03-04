import { NextResponse } from "next/server";
import { getProductBySlug } from "../../../../lib/queries";

export const revalidate = 180;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function GET(_: Request, { params }: Props) {
  try {
    const { slug } = await params;
    const data = await getProductBySlug(slug);
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
      { error: "PRODUCT_FETCH_FAILED", message: (error as Error).message },
      { status: 500 }
    );
  }
}
