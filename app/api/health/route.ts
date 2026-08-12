export const dynamic = "force-dynamic";

export async function GET() {
  return new Response(JSON.stringify({ status: "ok", site: "sitewisetools" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
