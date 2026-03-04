import { NextRequest, NextResponse } from "next/server";
import { runAlertsEngine } from "../../../../../lib/alerts";
import { isInternalRequestAuthorized } from "../../../../../lib/internalAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RunPayload {
  limit?: number;
  dryRun?: boolean;
}

function parseBodyOrDefault(raw: string): RunPayload {
  if (!raw.trim()) return {};
  return JSON.parse(raw) as RunPayload;
}

export async function POST(req: NextRequest) {
  try {
    if (!isInternalRequestAuthorized(req)) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const rawBody = await req.text();
    const payload = parseBodyOrDefault(rawBody);
    const result = await runAlertsEngine({
      limit: payload.limit,
      dryRun: payload.dryRun
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "ALERTS_RUN_FAILED",
        message: (error as Error).message
      },
      { status: 500 }
    );
  }
}
