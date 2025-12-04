// app/api/lightwalletd/blocks/route.ts

import { NextRequest, NextResponse } from "next/server";
import {
  LIGHTWALLETD_ENDPOINTS,
  getEndpointsByNetwork,
  ZcashNetwork,
  LightwalletdEndpoint,
} from "@/lib/lightwalletd/endpoints";
import { grpcGetCompactBlockRange } from "@/lib/lightwalletd/grpc-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseNetwork(value: string | null): ZcashNetwork {
  if (value === "mainnet" || value === "testnet") return value;
  throw new Error(`Invalid or missing network: ${value ?? "null"}`);
}

function resolveEndpoint(
  networkParam: string | null,
  endpointIdParam: string | null
): LightwalletdEndpoint {
  const network = parseNetwork(networkParam);

  if (endpointIdParam) {
    const byId = LIGHTWALLETD_ENDPOINTS.find(
      (e) => e.id === endpointIdParam
    );
    if (!byId) {
      throw new Error(`Unknown endpointId: ${endpointIdParam}`);
    }
    if (byId.network !== network) {
      throw new Error(
        `Endpoint ${endpointIdParam} does not belong to network ${network}`
      );
    }
    return byId;
  }

  const candidates = getEndpointsByNetwork(network);
  if (candidates.length === 0) {
    throw new Error(`No endpoints configured for network: ${network}`);
  }

  const primary = candidates.find((e) => e.primary);
  return primary ?? candidates[0];
}

function parseHeight(param: string | null, name: string): number {
  if (!param) {
    throw new Error(`Missing ${name} parameter`);
  }
  const n = Number(param);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`Invalid ${name} parameter: ${param}`);
  }
  return n;
}

export async function GET(req: NextRequest): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const networkParam = searchParams.get("network");
  const endpointIdParam = searchParams.get("endpointId");
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");

  try {
    const endpoint = resolveEndpoint(networkParam, endpointIdParam);
    const startHeight = parseHeight(startParam, "start");
    const endHeight = parseHeight(endParam, "end");

    if (endHeight < startHeight) {
      throw new Error("end must be >= start");
    }

    const blocks = await grpcGetCompactBlockRange(
      endpoint,
      startHeight,
      endHeight
    );

    // Expose a very simple JSON aligned with lib/lightwalletd/client.ts
    const payload = blocks.map((b) => ({
      height: b.height,
      hashHex: b.hashHex ?? null,
    }));

    return NextResponse.json(payload, { status: 200 });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("[lightwalletd/blocks] error:", err);

    const message =
      typeof err?.message === "string"
        ? err.message
        : "Failed to fetch compact blocks";

    // Extra debug info for gRPC/internal errors
    const errorCode = typeof err?.code === "number" ? err.code : null;
    const errorDetails =
      typeof err?.details === "string" ? err.details : null;

    const status =
      message.startsWith("Invalid or missing network") ||
      message.startsWith("Unknown endpointId") ||
      message.startsWith("Endpoint") ||
      message.startsWith("No endpoints configured") ||
      message.startsWith("Missing") ||
      message.startsWith("Invalid") ||
      message.startsWith("end must be")
        ? 400
        : 502;

    return NextResponse.json(
      { error: message, errorCode, errorDetails },
      { status }
    );
  }
}
