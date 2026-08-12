const SHARED_CSS = `
:root{
  --indigo:#6366f1;--indigo-dark:#4f46e5;--indigo-light:#a5b4fc;--indigo-glow:rgba(99,102,241,0.12);
  --navy:#1e1b4b;--navy-mid:#312e81;--navy-light:#4338ca;
  --bg:#faf8f5;--bg-card:#ffffff;
  --text:#1e293b;--text-mid:#475569;--text-light:#94a3b8;--text-bright:#f1f5f9;
  --border:rgba(30,27,75,0.08);--border-accent:rgba(99,102,241,0.25);
  --radius:12px;--mono:'Source Code Pro',monospace;
  --shadow:0 2px 12px rgba(30,27,75,0.06);--shadow-hover:0 8px 32px rgba(99,102,241,0.15);
  --c-rose:#e11d48;--c-violet:#7c3aed;--c-orange:#ea580c;--c-sky:#0284c7;
  --c-green:#16a34a;--c-pink:#db2777;--c-emerald:#059669;--c-amber:#d97706;
  --c-blue:#2563eb;--c-purple:#9333ea;--c-slate:#64748b;
}
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Plus Jakarta Sans',-apple-system,sans-serif;color:var(--text);background:var(--bg);line-height:1.7;padding-top:64px;}
a{color:var(--indigo);text-decoration:none;transition:color .2s;}a:hover{color:var(--indigo-dark);}

/* === HEADER === */
header{background:rgba(30,27,75,.97);backdrop-filter:blur(12px);position:fixed;top:0;left:0;right:0;z-index:1000;height:64px;border-bottom:3px solid transparent;border-image:linear-gradient(90deg,#e11d48,#ea580c,#d97706,#16a34a,#0284c7,#6366f1,#7c3aed,#db2777) 1;}
header .inner{display:flex;align-items:center;justify-content:space-between;padding:0 24px;max-width:1200px;margin:0 auto;height:64px;}
header .brand{font-family:'Bricolage Grotesque',sans-serif;font-size:22px;font-weight:800;color:#fff;text-decoration:none;letter-spacing:-.3px;}
header .brand span{background:linear-gradient(135deg,#a5b4fc,#c084fc);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
header nav{display:flex;gap:2px;}
header nav a{color:rgba(255,255,255,0.6);font-size:11.5px;font-weight:500;text-transform:uppercase;letter-spacing:.5px;padding:6px 9px;border-radius:4px;font-family:var(--mono);transition:all .2s;}
header nav a:hover{color:#fff;background:rgba(99,102,241,.2);}
.nav-more{position:relative;}
.nav-more>a{cursor:pointer;}
.nav-more .dropdown{display:none;position:absolute;top:100%;right:0;background:var(--navy);border:1px solid rgba(255,255,255,0.1);border-radius:8px;min-width:180px;padding:6px 0;z-index:100;box-shadow:0 12px 40px rgba(0,0,0,0.3);}
.nav-more:hover .dropdown{display:block;}
.nav-more .dropdown a{display:block;padding:8px 16px;font-size:12px;color:rgba(255,255,255,0.7);white-space:nowrap;}
.nav-more .dropdown a:hover{background:rgba(99,102,241,.2);color:#fff;}
.mobile-toggle{display:none;background:none;border:none;color:#fff;font-size:1.3rem;cursor:pointer;}
@media(max-width:900px){header nav{display:none;}.mobile-toggle{display:block;}}

/* === BREADCRUMB === */
.breadcrumb{max-width:820px;margin:0 auto;padding:20px 20px 0;font-size:0.82rem;color:var(--text-light);}
.breadcrumb a{color:var(--text-mid);}.breadcrumb a:hover{color:var(--indigo);}
.breadcrumb span{color:var(--text-light);}

/* === ARTICLE LAYOUT === */
.article-layout{max-width:1280px;margin:0 auto;padding:0 24px;display:grid;grid-template-columns:1fr 240px;gap:36px;align-items:start;}
.article-main{min-width:0;}
.article-layout .article-wrap{max-width:820px;margin:0;padding:24px 0 40px;}

/* === TOC SIDEBAR === */
.toc-sidebar{position:sticky;top:80px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:0;max-height:calc(100vh - 100px);overflow-y:auto;box-shadow:var(--shadow);}
.toc-header{font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:0.78rem;color:var(--navy);text-transform:uppercase;letter-spacing:1.2px;padding:14px 16px;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--bg-card);z-index:1;}
.toc-nav{padding:8px 0;}
.toc-link{display:block;padding:6px 16px;font-size:0.8rem;line-height:1.4;color:var(--text-mid);text-decoration:none;border-left:3px solid transparent;transition:all 0.15s ease;}
.toc-link:hover{color:var(--indigo);background:rgba(99,102,241,0.04);}
.toc-link.active{color:var(--indigo);font-weight:600;border-left-color:var(--indigo);background:rgba(99,102,241,0.06);}
.toc-link.toc-h3{padding-left:28px;font-size:0.76rem;}

/* === RELATED ARTICLES === */
.related-section{max-width:820px;margin:0 auto;padding:0 20px 48px;}
.related-section h3{font-family:'Bricolage Grotesque',sans-serif;font-size:1.15rem;font-weight:700;color:var(--navy);margin-bottom:16px;padding-top:24px;border-top:2px solid var(--border);}
.related-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;}
.related-grid a{display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg-card);border-radius:8px;border:1px solid var(--border);box-shadow:var(--shadow);transition:all 0.25s;text-decoration:none;color:inherit;}
.related-grid a:hover{border-color:var(--indigo);box-shadow:var(--shadow-hover);transform:translateY(-2px);}
.related-grid img{width:64px;height:48px;object-fit:cover;border-radius:6px;flex-shrink:0;}
.related-grid span{font-size:0.85rem;font-weight:600;line-height:1.4;color:var(--text);}

/* === FOOTER === */
footer{background:var(--navy);color:rgba(255,255,255,0.55);padding:48px 0 24px;margin-top:60px;border-top:3px solid transparent;border-image:linear-gradient(90deg,#e11d48,#ea580c,#d97706,#16a34a,#0284c7,#6366f1,#7c3aed,#db2777) 1;}
footer .f-grid{max-width:1200px;margin:0 auto;padding:0 24px;display:grid;grid-template-columns:1.5fr repeat(3,1fr);gap:32px;}
footer .f-brand{font-family:'Bricolage Grotesque',sans-serif;font-size:18px;font-weight:800;color:#fff;margin-bottom:8px;}
footer .f-brand span{color:var(--indigo-light);}
footer .f-desc{font-size:0.85rem;color:rgba(255,255,255,0.5);line-height:1.6;max-width:320px;}
footer h4{font-family:var(--mono);font-size:0.72rem;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.35);margin-bottom:12px;}
footer h4+div a{display:block;font-size:0.82rem;color:rgba(255,255,255,0.5);padding:3px 0;}footer h4+div a:hover{color:var(--indigo-light);}
footer .f-bottom{max-width:1200px;margin:32px auto 0;padding:16px 24px 0;border-top:1px solid rgba(255,255,255,0.06);display:flex;justify-content:space-between;font-size:0.78rem;color:rgba(255,255,255,0.35);}
@media(max-width:768px){footer .f-grid{grid-template-columns:1fr 1fr;}}

/* === CATEGORY PAGE === */
.type-header{background:linear-gradient(135deg,var(--navy) 0%,var(--navy-mid) 50%,#1e3a5f 100%);padding:48px 0 40px;border-bottom:3px solid transparent;border-image:linear-gradient(90deg,#e11d48,#ea580c,#d97706,#16a34a,#0284c7,#6366f1,#7c3aed,#db2777) 1;}
.type-header h1{color:#fff;font-family:'Bricolage Grotesque',sans-serif;font-size:2rem;max-width:1200px;margin:0 auto;padding:0 24px;}
.type-header p{color:rgba(255,255,255,0.6);font-size:0.95rem;max-width:1200px;margin:8px auto 0;padding:0 24px;}
.articles-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:24px;max-width:1200px;margin:0 auto;padding:36px 24px;}
.a-card{display:block;text-decoration:none;color:inherit;background:var(--bg-card);border-radius:var(--radius);overflow:hidden;border:1px solid var(--border);box-shadow:var(--shadow);transition:all 0.25s;}
.a-card:hover{transform:translateY(-4px);box-shadow:var(--shadow-hover);border-color:var(--border-accent);}
.a-card img{width:100%;height:200px;object-fit:cover;display:block;}
.a-card-body{padding:18px 20px;}
.a-card-body h2{font-family:'Bricolage Grotesque',sans-serif;font-size:1.05rem;line-height:1.4;margin-bottom:8px;color:var(--navy);}
.a-card-body p{font-size:0.85rem;color:var(--text-mid);line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:8px;}
.a-card-meta{font-size:0.78rem;color:var(--text-light);font-family:var(--mono);}
.page-info{color:var(--text-light);font-size:0.85rem;max-width:1200px;margin:0 auto;padding:20px 24px 0;}

/* === PAGINATION === */
.pagination{display:flex;justify-content:center;gap:6px;padding:36px 0 48px;flex-wrap:wrap;}
.pagination a,.pagination span{display:inline-flex;align-items:center;justify-content:center;min-width:38px;height:38px;padding:0 10px;border-radius:8px;font-size:0.88rem;text-decoration:none;color:var(--text);background:var(--bg-card);border:1px solid var(--border);font-family:var(--mono);transition:all 0.2s;}
.pagination a:hover{background:var(--indigo);color:#fff;border-color:var(--indigo);}
.pagination .active{background:var(--indigo);color:#fff;border-color:var(--indigo);font-weight:600;}
.pagination .disabled{color:var(--text-light);pointer-events:none;}
.pagination .ellipsis{border:none;background:none;color:var(--text-light);min-width:28px;}

/* === TEAM GRID === */
.team-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;padding:24px 0 48px;max-width:1200px;margin:0 auto;}
.team-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:24px;text-align:center;transition:border-color .2s;box-shadow:var(--shadow);}
.team-card:hover{border-color:var(--indigo);}
.team-card img{width:72px;height:72px;border-radius:50%;margin:0 auto 12px;object-fit:cover;border:3px solid var(--indigo);}
.team-card h3{font-family:'Bricolage Grotesque',sans-serif;font-size:16px;color:var(--navy);margin-bottom:4px;}
.team-card p{font-size:13px;color:var(--text-mid);line-height:1.5;}

/* === RESPONSIVE === */
@media(max-width:1024px){
  .article-layout{grid-template-columns:1fr;}
  .toc-sidebar{display:none;}
  .article-layout .article-wrap{max-width:820px;margin:0 auto;}
}
@media(max-width:768px){
  .articles-grid{grid-template-columns:1fr;}
  .related-grid{grid-template-columns:1fr;}
  .team-grid{grid-template-columns:1fr;}
  footer .f-grid{grid-template-columns:1fr;}
  footer .f-bottom{flex-direction:column;gap:8px;text-align:center;}
}
`;

export const HEADER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-95PY8PSZ0Y"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-95PY8PSZ0Y');</script>
<meta charset="UTF-8"><link rel="icon" href="/icon.png?v=2" type="image/png">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>{{TITLE}}</title>
<meta name="description" content="{{DESCRIPTION}}">
<meta name="msvalidate.01" content="E814EC58E19D2CC809950325247AE8CA">
<link rel="canonical" href="{{CANONICAL}}">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Source+Code+Pro:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/article.css">
<style>${SHARED_CSS}</style>
</head>
<body>
<header>
<div class="inner">
<a href="/" class="brand">SiteWise<span>Tools</span></a>
<nav>
<a href="/industrial">Industrial</a>
<a href="/electronics">Electronics</a>
<a href="/materials">Materials</a>
<a href="/automotive">Auto</a>
<a href="/home">Home</a>
<a href="/fashion">Fashion</a>
<a href="/health">Health</a>
<a href="/food">Food</a>
<div class="nav-more">
<a href="#">More <i class="fas fa-chevron-down" style="font-size:9px;margin-left:2px"></i></a>
<div class="dropdown">
<a href="/sports">Sports & Outdoors</a>
<a href="/pets">Pet Supplies</a>
<a href="/more">More Categories</a>
<a href="/author/team">Our Team</a>
</div>
</div>
</nav>
<button class="mobile-toggle" onclick="document.querySelector('header nav').style.display=document.querySelector('header nav').style.display==='flex'?'none':'flex'"><i class="fas fa-bars"></i></button>
</div>
</header>`;

export const FOOTER_HTML = `
<footer>
<div class="f-grid">
<div>
<div class="f-brand">SiteWise<span>Tools</span></div>
<p class="f-desc">Smart product intelligence across 11 industry verticals. Data-driven assessments, expert guides, and actionable recommendations.</p>
</div>
<div>
<h4>Core Categories</h4>
<div>
<a href="/industrial">Industrial Machinery</a>
<a href="/electronics">Electronics & Systems</a>
<a href="/materials">Materials & Chemicals</a>
<a href="/automotive">Automotive & Vehicle</a>
<a href="/home">Home & Garden</a>
<a href="/fashion">Fashion & Apparel</a>
</div>
</div>
<div>
<h4>More Categories</h4>
<div>
<a href="/health">Health & Wellness</a>
<a href="/food">Food & Beverage</a>
<a href="/sports">Sports & Outdoors</a>
<a href="/pets">Pet Supplies</a>
<a href="/more">More Categories</a>
</div>
</div>
<div>
<h4>About</h4>
<div>
<a href="/author/team">Our Team</a>
<a href="/industrial">Industrial Guides</a>
<a href="/electronics">Electronics Guides</a>
</div>
</div>
</div>
<div class="f-bottom">
<span>&copy; 2025 SiteWiseTools. All rights reserved.</span>
<span>Smart product intelligence, delivered daily.</span>
</div>
</footer>
</body></html>`;
