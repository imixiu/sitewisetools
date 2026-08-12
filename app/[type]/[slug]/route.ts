import { HEADER_HTML, FOOTER_HTML } from "../../../lib/templates";
import { getArticleBySlug, getRelatedArticles, getAuthorBySlug } from "../../../lib/db";

export const dynamic = "force-dynamic";

function escapeHtml(s: string): string {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

function processBodyWithToc(body: string): { html: string; toc: { id: string; text: string; level: number }[] } {
  const toc: { id: string; text: string; level: number }[] = [];
  let counter = 0;
  const html = body.replace(/<h([23])[^>]*>([\s\S]*?)<\/h\1>/gi, (match, level, inner) => {
    counter++;
    const id = "s" + counter;
    const text = inner.replace(/<[^>]*>/g, "").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').trim();
    if (text) toc.push({ id, text, level: parseInt(level) });
    if (match.includes(" id=")) return match;
    return `<h${level} id="${id}">${inner}</h${level}>`;
  });
  return { html, toc };
}

export async function GET(_request: Request, { params }: { params: Promise<{ type: string; slug: string }> }) {
  const { type, slug } = await params;
  const article = await getArticleBySlug(type, slug);
  if (!article) return new Response("Article not found", { status: 404 });

  const related = await getRelatedArticles(article.id, article.type ?? type);
  const title = article.title ?? "";
  const description = article.description ?? "";

  const _ogTags = [
    `<meta property="og:type" content="article">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${_request.url}">`,
    `<meta property="og:site_name" content="SiteWiseTools">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
  ];
  if (article.img) {
    _ogTags.push(`<meta property="og:image" content="${escapeHtml(article.img)}">`);
    _ogTags.push(`<meta name="twitter:image" content="${escapeHtml(article.img)}">`);
  }
  const renderedHeader = HEADER_HTML
    .replace("{{TITLE}}", escapeHtml(title))
    .replace("{{DESCRIPTION}}", escapeHtml(description))
    .replace("</head>", _ogTags.join("\n    ") + "\n</head>")
    .replace("{{CANONICAL}}", _request.url);

  const authorRaw = article.author ?? "";
  const authorSlug = authorRaw.toLowerCase().replace(/\s+/g, "-");
  let authorName = authorRaw;
  try { const a = await getAuthorBySlug(authorSlug); if (a?.name) authorName = a.name; } catch(_) {}

  const pubTime = article.published_time ?? article.modified_time;
  const pubDate = pubTime ? new Date(pubTime).toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" }) : "";
  const metaParts: string[] = [];
  if (authorRaw) metaParts.push(`By <a href="/author/${authorSlug}" class="meta-author">${escapeHtml(authorName)}</a>`);
  if (pubDate) metaParts.push(`<time class="meta-date">${escapeHtml(pubDate)}</time>`);
  const metaBlock = metaParts.length ? `<div class="article-meta">${metaParts.join(" · ")}</div>` : "";
  const coverBlock = article.img ? `<img class="article-cover" src="${escapeHtml(article.img)}" alt="${escapeHtml(title)}" loading="eager">` : "";
  const typeName = type.charAt(0).toUpperCase() + type.slice(1).replace(/-/g, " ");

  const _jsonLd = JSON.stringify({ "@context":"https://schema.org","@type":"Article", headline:title, description, url:_request.url, ...(article.img?{image:article.img}:{}), publisher:{"@type":"Organization",name:"SiteWiseTools",url:"https://sitewisetools.com"}, ...(authorName?{author:{"@type":"Person",name:authorName}}:{}), ...(pubTime?{datePublished:new Date(pubTime).toISOString().split("T")[0],dateModified:article.modified_time?new Date(article.modified_time).toISOString().split("T")[0]:new Date(pubTime).toISOString().split("T")[0]}:{}) });

  const breadcrumb = `<nav class="breadcrumb"><a href="/">Home</a> › <a href="/${type}">${typeName}</a> › <span>${escapeHtml(title)}</span></nav>`;
  const _baseUrl = new URL(_request.url).origin;
  const breadcrumbSchema = `<script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:"Home",item:_baseUrl},{"@type":"ListItem",position:2,name:typeName,item:_baseUrl+"/"+type},{"@type":"ListItem",position:3,name:title}]})}</script>`;

  const rawBody = article.body ?? "";
  const { html: processedBody, toc } = processBodyWithToc(rawBody);

  let tocHtml = "";
  if (toc.length > 0) {
    let tocLinks = "";
    for (const h of toc) { const cls = h.level===3?"toc-link toc-h3":"toc-link"; tocLinks += `<a href="#${h.id}" class="${cls}">${escapeHtml(h.text)}</a>\n`; }
    tocHtml = `<aside class="toc-sidebar"><div class="toc-header"><i class="fas fa-list-ul" style="margin-right:6px"></i> Contents</div><nav class="toc-nav">${tocLinks}</nav></aside>`;
  }

  let relatedHtml = "";
  if (related.length > 0) {
    let cards = "";
    for (const r of related) {
      const t = escapeHtml(r.title ?? r.short_title ?? "");
      const href = "/" + escapeHtml(r.type ?? type) + "/" + escapeHtml(r.short_title ?? "");
      const img = r.img ? `<img src="${escapeHtml(r.img)}" alt="${t}" loading="lazy">` : `<div style="width:64px;height:48px;border-radius:6px;background:#e2e8f0;flex-shrink:0"></div>`;
      cards += `<a href="${href}">${img}<span>${t}</span></a>\n`;
    }
    relatedHtml = `<div class="related-section"><h3>More Articles</h3><div class="related-grid">${cards}</div></div>`;
  }

  const html = renderedHeader +
    `<div class="article-layout"><div class="article-main"><div class="article-wrap">` +
    breadcrumb + coverBlock + `<h1>${escapeHtml(title)}</h1>` + metaBlock +
    `<div class="article-content">${processedBody}</div></div>` + relatedHtml + `</div>` + tocHtml + `</div>` +
    breadcrumbSchema + `<script type="application/ld+json">${_jsonLd}</script>` +
    `<script>(function(){var ls=document.querySelectorAll('.toc-link');if(!ls.length)return;var ids=Array.from(ls).map(function(l){return l.getAttribute('href').slice(1)});var hs=ids.map(function(id){return document.getElementById(id)}).filter(Boolean);function u(){var st=window.scrollY+100,a=null;for(var i=0;i<hs.length;i++)if(hs[i].offsetTop<=st)a=ids[i];ls.forEach(function(l){l.classList.toggle('active',l.getAttribute('href')==='#'+a)});}window.addEventListener('scroll',u,{passive:true});u();})();</script>` +
    FOOTER_HTML;

  return new Response(html, { status:200, headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"public, s-maxage=3600"} });
}
