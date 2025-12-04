// app/api/lightwalletd/tx/route.ts

import { NextRequest, NextResponse } from "next/server";
import {
  LIGHTWALLETD_ENDPOINTS,
  getEndpointsByNetwork,
  ZcashNetwork,
  LightwalletdEndpoint,
} from "@/lib/lightwalletd/endpoints";
import { grpcGetTransaction } from "@/lib/lightwalletd/grpc-client";

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

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length === 0 || clean.length % 2 !== 0) {
    throw new Error("Invalid txid hex string");
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) {
      throw new Error("Invalid txid hex string");
    }
    out[i] = byte;
  }
  return out;
}

export async function GET(req: NextRequest): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const networkParam = searchParams.get("network");
  const endpointIdParam = searchParams.get("endpointId");
  const txidParam = searchParams.get("txid");

  try {
    const endpoint = resolveEndpoint(networkParam, endpointIdParam);

    if (!txidParam) {
      throw new Error("Missing txid parameter");
    }

    const txidBytes = hexToBytes(txidParam);
    const tx = await grpcGetTransaction(endpoint, txidBytes);

    if (!tx) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        rawHex: tx.rawHex,
      },
      { status: 200 }
    );
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("[lightwalletd/tx] error:", err);

    const message =
      typeof err?.message === "string"
        ? err.message
        : "Failed to fetch transaction";

    const errorCode = typeof err?.code === "number" ? err.code : null;
    const errorDetails =
      typeof err?.details === "string" ? err.details : null;

    const status =
      message.startsWith("Invalid or missing network") ||
      message.startsWith("Unknown endpointId") ||
      message.startsWith("Endpoint") ||
      message.startsWith("No endpoints configured") ||
      message.startsWith("Missing txid") ||
      message.startsWith("Invalid txid")
        ? 400
        : 502;

    return NextResponse.json(
      { error: message, errorCode, errorDetails },
      { status }
    );
  }
}

