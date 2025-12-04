// app/api/lightwalletd/route.ts

import { NextRequest } from "next/server";
import { LIGHTWALLETD_ENDPOINTS } from "@/lib/lightwalletd/endpoints";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lightweight proxy between the Z-Ray frontend and public lightwalletd endpoints.
 *
 * This route:
 * - receives requests from the browser (same origin, no CORS issues),
 * - forwards them to the selected lightwalletd endpoint on the server side,
 * - returns the upstream response as-is.
 *
 * IMPORTANT:
 * This proxy must only be used for public blockchain data (blocks, metadata, etc.).
 * It must never receive viewing keys, decrypted notes, or any sensitive payload.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const url = new URL(req.url);
  const searchParams = url.searchParams;

  const endpointId = searchParams.get("endpointId");
  const op = searchParams.get("op");

  if (!endpointId || !op) {
    return new Response(
      JSON.stringify({ error: "Missing endpointId or op" }),
      {
        status: 400,
        headers: { "content-type": "application/json" },
      }
    );
  }

  const endpoint = LIGHTWALLETD_ENDPOINTS.find(
    (e) => e.id === endpointId
  );

  if (!endpoint) {
    return new Response(
      JSON.stringify({ error: `Unknown endpointId: ${endpointId}` }),
      {
        status: 400,
        headers: { "content-type": "application/json" },
      }
    );
  }

  let targetUrl: string;

  switch (op) {
    case "getlightdinfo": {
      targetUrl = `${endpoint.url}/getlightdinfo`;
      break;
    }

    case "getcompactblocks": {
      const start = searchParams.get("start");
      const end = searchParams.get("end");

      if (!start || !end) {
        return new Response(
          JSON.stringify({ error: "Missing start or end for getcompactblocks" }),
          {
            status: 400,
            headers: { "content-type": "application/json" },
          }
        );
      }

      const qs = new URLSearchParams({
        start,
        end,
      });

      targetUrl = `${endpoint.url}/getcompactblocks?${qs.toString()}`;
      break;
    }

    case "gettransaction": {
      const txid = searchParams.get("txid");

      if (!txid) {
        return new Response(
          JSON.stringify({ error: "Missing txid for gettransaction" }),
          {
            status: 400,
            headers: { "content-type": "application/json" },
          }
        );
      }

      const qs = new URLSearchParams({
        txid,
      });

      targetUrl = `${endpoint.url}/gettransaction?${qs.toString()}`;
      break;
    }

    default:
      return new Response(
        JSON.stringify({ error: `Unsupported op: ${op}` }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        }
      );
  }

  try {
    const upstreamRes = await fetch(targetUrl, {
      method: "GET",
    });

    const body = await upstreamRes.arrayBuffer();

    const headers = new Headers();
    const contentType =
      upstreamRes.headers.get("content-type") ?? "application/octet-stream";
    headers.set("content-type", contentType);

    return new Response(body, {
      status: upstreamRes.status,
      headers,
    });
  } catch (err) {
    console.error("[lightwalletd proxy] upstream request failed:", err);

    return new Response(
      JSON.stringify({ error: "Upstream request failed" }),
      {
        status: 502,
        headers: { "content-type": "application/json" },
      }
    );
  }
}
