import { HEADER_HTML, FOOTER_HTML } from "../../../lib/templates";
import { getAllAuthors } from "../../../lib/db";

export const dynamic = "force-dynamic";

function escapeHtml(s: string): string {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

export async function GET(_request: Request) {
  const authors = await getAllAuthors();
  const title = "Our Team — SiteWiseTools";
  const renderedHeader = HEADER_HTML
    .replace("{{TITLE}}", title)
    .replace("{{DESCRIPTION}}", "Meet the SiteWiseTools editorial team.")
    .replace("{{CANONICAL}}", _request.url);

  let cards = "";
  for (const a of authors) {
    if (a.slug === "team") continue;
    const avatar = a.img
      ? `<img src="${escapeHtml(a.img)}" alt="${escapeHtml(a.name ?? "")}">`
      : `<img src="https://ui-avatars.com/api/?name=${encodeURIComponent(a.name ?? "A")}&background=6366f1&color=fff&size=144" alt="${escapeHtml(a.name ?? "")}">`;
    cards += `<a href="/author/${escapeHtml(a.slug ?? "")}" class="team-card">${avatar}<h3>${escapeHtml(a.name ?? "")}</h3><p>${escapeHtml(a.description ?? "Writer at SiteWiseTools")}</p></a>`;
  }

  const body = `<div style="max-width:1200px;margin:0 auto;padding:48px 24px;">
    <h1 style="font-family:'Bricolage Grotesque',sans-serif;font-size:2rem;color:#1e1b4b;margin-bottom:8px;">Our Editorial Team</h1>
    <p style="color:#64748b;margin-bottom:32px;">Meet the experts behind SiteWiseTools product intelligence.</p>
    <div class="team-grid">${cards}</div>
  </div>`;

  return new Response(renderedHeader + body + FOOTER_HTML, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, s-maxage=3600" },
  });
}
