import { HEADER_HTML, FOOTER_HTML } from "../../lib/templates";
import { getArticlesByTypePaged } from "../../lib/db";
import { TYPE_SEO } from "../../lib/type-seo";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 100;

function escapeHtml(s: string): string {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

export async function GET(_request: Request, { params }: { params: Promise<{ type: string }> }) {
  const { type: _rawType } = await params;
  const dbType = _rawType;
  const url = new URL(_request.url);
  const page = 1;
  const { articles, total } = await getArticlesByTypePaged(dbType, page, PAGE_SIZE);
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const seo = TYPE_SEO[_rawType];
  const title = seo?.title ?? _rawType.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  const renderedHeader = HEADER_HTML
    .replace("{{TITLE}}", escapeHtml(title))
    .replace("{{DESCRIPTION}}", escapeHtml(seo?.description ?? "Articles about " + title))
    .replace("{{CANONICAL}}", url.origin + url.pathname);

  let listHtml = `<div class="type-header"><h1>${escapeHtml(seo?.label ?? title)}</h1><p>${total} articles — Page ${page} of ${totalPages}</p></div>`;

  if (articles.length === 0) {
    listHtml += `<p class="page-info">No articles in this category yet.</p>`;
  } else {
    listHtml += `<div class="articles-grid">`;
    for (const a of articles) {
      const articleTitle = escapeHtml(a.title ?? "Untitled");
      const slug = escapeHtml(a.short_title ?? "");
      const desc = a.description ? escapeHtml(a.description) : "";
      const img = a.img ? `<img src="${escapeHtml(a.img)}" alt="${articleTitle}" loading="lazy" />` : "";
      const articleAuthor = a.author ? escapeHtml(a.author) : "";
      const date = a.modified_time ? new Date(a.modified_time).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "";
      listHtml += `<a href="/${escapeHtml(_rawType)}/${slug}" class="a-card">${img}<div class="a-card-body"><h2>${articleTitle}</h2>${desc ? "<p>"+desc+"</p>" : ""}${articleAuthor ? '<span class="a-card-meta">'+articleAuthor+" · "+date+"</span>" : ""}</div></a>`;
    }
    listHtml += `</div>`;
    if (totalPages > 1) {
      const basePath = "/" + escapeHtml(_rawType);
      const pageLink = (p: number) => p === 1 ? basePath : basePath + "/page/" + p;
      listHtml += `<nav class="pagination">`;
      listHtml += page > 1 ? `<a href="${pageLink(page-1)}">&laquo; Prev</a>` : `<span class="disabled">&laquo; Prev</span>`;
      const pages: (number|string)[] = [];
      if (totalPages <= 7) { for (let i=1;i<=totalPages;i++) pages.push(i); }
      else { pages.push(1); if(page>3) pages.push("…"); for(let i=Math.max(2,page-1);i<=Math.min(totalPages-1,page+1);i++) pages.push(i); if(page<totalPages-2) pages.push("…"); pages.push(totalPages); }
      for (const p of pages) {
        if (p === "…") listHtml += `<span class="ellipsis">…</span>`;
        else if (p === page) listHtml += `<span class="active">${p}</span>`;
        else listHtml += `<a href="${pageLink(p as number)}">${p}</a>`;
      }
      listHtml += page < totalPages ? `<a href="${pageLink(page+1)}">Next &raquo;</a>` : `<span class="disabled">Next &raquo;</span>`;
      listHtml += `</nav>`;
    }
  }

  return new Response(renderedHeader + listHtml + FOOTER_HTML, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, s-maxage=3600" },
  });
}
