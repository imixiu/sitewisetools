import { HEADER_HTML, FOOTER_HTML } from "../../../lib/templates";
import { getAuthorBySlug } from "../../../lib/db";

export const dynamic = "force-dynamic";

function escapeHtml(s: string): string {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const author = await getAuthorBySlug(slug);
  if (!author) return new Response("Author not found", { status: 404 });

  const title = `${author.name} — SiteWiseTools`;
  const description = author.description ?? `Articles by ${author.name} on SiteWiseTools.`;
  const renderedHeader = HEADER_HTML
    .replace("{{TITLE}}", escapeHtml(title))
    .replace("{{DESCRIPTION}}", escapeHtml(description))
    .replace("{{CANONICAL}}", _request.url);

  const avatar = author.img
    ? `<img src="${escapeHtml(author.img)}" alt="${escapeHtml(author.name ?? "")}" style="width:96px;height:96px;border-radius:50%;object-fit:cover;border:4px solid #6366f1;margin-bottom:16px;">`
    : `<img src="https://ui-avatars.com/api/?name=${encodeURIComponent(author.name ?? "A")}&background=6366f1&color=fff&size=192" alt="${escapeHtml(author.name ?? "")}" style="width:96px;height:96px;border-radius:50%;border:4px solid #6366f1;margin-bottom:16px;">`;

  const body = `<div style="max-width:820px;margin:0 auto;padding:48px 24px;text-align:center;">
    ${avatar}
    <h1 style="font-family:'Bricolage Grotesque',sans-serif;font-size:2rem;color:#1e1b4b;margin-bottom:8px;">${escapeHtml(author.name ?? "")}</h1>
    <p style="color:#64748b;font-size:1rem;line-height:1.7;max-width:600px;margin:0 auto;">${escapeHtml(author.description ?? "Contributing writer at SiteWiseTools.")}</p>
  </div>`;

  return new Response(renderedHeader + body + FOOTER_HTML, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, s-maxage=3600" },
  });
}
