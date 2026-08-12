import { INDEX_HTML } from "../lib/index-html";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return new Response(INDEX_HTML, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (err: any) {
    const fallback = `<!DOCTYPE html><html><head><title>SiteWiseTools</title><meta name="msvalidate.01" content="E814EC58E19D2CC809950325247AE8CA"></head><body style="background:#faf8f5;color:#1e293b;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;"><h1 style="color:#6366f1;">SiteWiseTools</h1><p>Loading... please refresh in a moment.</p></div></body></html>`;
    return new Response(fallback, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" },
    });
  }
}
