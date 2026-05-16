// src/app/api/health/route.ts
// Simple liveness probe used by Docker and load-balancers.
// Returns 200 OK with basic metadata when the server is up.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
    return NextResponse.json(
        {
            status: "ok",
            service: "flowzen",
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            node: process.version,
            env: process.env.NODE_ENV ?? "unknown",
        },
        { status: 200 }
    );
}