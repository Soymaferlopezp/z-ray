import { NextRequest, NextResponse } from "next/server";
import {
  LIGHTWALLETD_ENDPOINTS,
  getEndpointsByNetwork,
  ZcashNetwork,
  LightwalletdEndpoint,
} from "@/lib/lightwalletd/endpoints";
import { grpcGetLightdInfo } from "@/lib/lightwalletd/grpc-client";

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

export async function GET(req: NextRequest): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const networkParam = searchParams.get("network");
  const endpointIdParam = searchParams.get("endpointId");

  try {
    const endpoint = resolveEndpoint(networkParam, endpointIdParam);
    const info = await grpcGetLightdInfo(endpoint);

    return NextResponse.json(
      {
        chainName: info.chainName,
        blockHeight: info.blockHeight,
        vendor: info.vendor,
        endpoint: {
          id: endpoint.id,
          url: endpoint.url,
          network: endpoint.network,
          region: endpoint.region ?? null,
        },
      },
      { status: 200 }
    );
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("[lightwalletd/info] error:", err);

    const message =
      typeof err?.message === "string" ? err.message : "Failed to fetch lightd info";

    // añadimos más info de debug para ver qué está pasando
    const errorCode = typeof err?.code === "number" ? err.code : null;
    const errorDetails =
      typeof err?.details === "string" ? err.details : null;

    const status =
      message.startsWith("Invalid or missing network") ||
      message.startsWith("Unknown endpointId") ||
      message.startsWith("Endpoint") ||
      message.startsWith("No endpoints configured")
        ? 400
        : 502;

    return NextResponse.json(
      {
        error: message,
        errorCode,
        errorDetails,
      },
      { status }
    );
  }
}
