import { TYPE_SEO } from "./type-seo";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const CAT_COLORS: Record<string, string> = {
  industrial: "#e11d48",
  electronics: "#7c3aed",
  materials: "#ea580c",
  automotive: "#0284c7",
  home: "#16a34a",
  fashion: "#db2777",
  health: "#059669",
  food: "#d97706",
  sports: "#2563eb",
  pets: "#9333ea",
  more: "#64748b",
};

const CAT_ICONS: Record<string, string> = {
  industrial: "fa-industry",
  electronics: "fa-microchip",
  materials: "fa-cubes",
  automotive: "fa-car",
  home: "fa-home",
  fashion: "fa-tshirt",
  health: "fa-heartbeat",
  food: "fa-utensils",
  sports: "fa-running",
  pets: "fa-paw",
  more: "fa-ellipsis-h",
};

const CAT_DESC: Record<string, string> = {
  industrial: "Valves, pumps, cranes, conveyors, compressors, and heavy machinery specs.",
  electronics: "ICs, semiconductors, displays, sensors, RF modules, and electronic systems.",
  materials: "Steel, polymers, adhesives, ceramics, coatings, and specialty chemicals.",
  automotive: "Turbo systems, braking, suspension, engine components, and aftermarket parts.",
  home: "Furniture, lighting, décor, kitchen gear, garden tools, and seasonal items.",
  fashion: "Clothing, footwear, handbags, eyewear, jewelry, and style accessories.",
  health: "Medical devices, supplements, rehab equipment, wellness products, and personal care.",
  food: "Commercial kitchen equipment, food packaging, ingredients, and catering supplies.",
  sports: "Fitness gear, outdoor equipment, water sports, and athletic accessories.",
  pets: "Pet food, toys, grooming tools, aquariums, and animal care essentials.",
  more: "Business supplies, musical instruments, toys, stationery, books, and more.",
};

export const INDEX_HTML = buildIndexHtml();

function buildIndexHtml(): string {
  const catOrder = ["industrial", "electronics", "materials", "automotive", "home", "fashion", "health", "food", "sports", "pets", "more"];

  // Build category cards - bento grid style
  let catCardsHtml = "";
  for (let i = 0; i < catOrder.length; i++) {
    const cat = catOrder[i];
    const seo = TYPE_SEO[cat];
    const label = seo?.label ?? cat;
    const icon = CAT_ICONS[cat] ?? "fa-folder";
    const desc = CAT_DESC[cat] ?? "";
    const color = CAT_COLORS[cat] ?? "#6366f1";
    // First 2 cards are "featured" (span 2 cols on desktop)
    const isFeatured = i < 2;
    const spanClass = isFeatured ? "cat-card featured" : "cat-card";
    catCardsHtml += `
<a href="/${esc(cat)}" class="${spanClass}" style="--cat-color:${color}">
  <div class="cat-icon-wrap" style="background:${color}15;color:${color}">
    <i class="fas ${icon}"></i>
  </div>
  <div class="cat-content">
    <h3>${esc(label)}</h3>
    <p>${esc(desc)}</p>
  </div>
  <div class="cat-arrow" style="color:${color}"><i class="fas fa-arrow-right"></i></div>
</a>`;
  }

  // Build floating orbs for hero
  const orbColors = ["#e11d48", "#7c3aed", "#ea580c", "#0284c7", "#16a34a", "#db2777", "#d97706", "#6366f1"];
  let orbsHtml = "";
  for (let i = 0; i < orbColors.length; i++) {
    const size = 60 + Math.random() * 120;
    const x = 5 + (i * 12) % 90;
    const y = 10 + (i * 17) % 70;
    const delay = i * 0.7;
    orbsHtml += `<div class="orb" style="width:${size}px;height:${size}px;background:${orbColors[i]};left:${x}%;top:${y}%;animation-delay:${delay}s;opacity:0.12;"></div>`;
  }

  // Build spectrum bar (color strip showing all categories)
  let spectrumHtml = "";
  for (const cat of catOrder) {
    spectrumHtml += `<div class="spectrum-seg" style="background:${CAT_COLORS[cat]}" title="${TYPE_SEO[cat]?.label ?? cat}"></div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-95PY8PSZ0Y"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-95PY8PSZ0Y');</script>
<meta charset="UTF-8"><link rel="icon" href="/icon.png?v=2" type="image/png">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>SiteWiseTools — Smart Product Intelligence Across 11 Industry Verticals</title>
<meta name="description" content="Data-driven product assessments, expert buying guides, and specification analysis across 11 industry categories — from heavy machinery to pet supplies.">
<meta name="msvalidate.01" content="E814EC58E19D2CC809950325247AE8CA">
<meta property="og:type" content="website"><meta property="og:title" content="SiteWiseTools — Smart Product Intelligence Across 11 Verticals"><meta property="og:description" content="Data-driven buying guides and technical assessments spanning 11 industry categories."><meta property="og:url" content="https://sitewisetools.com"><meta property="og:site_name" content="SiteWiseTools">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="SiteWiseTools — Smart Product Intelligence"><meta name="twitter:description" content="Expert buying guides across 11 industry verticals.">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Source+Code+Pro:wght@400;500&display=swap" rel="stylesheet">
<style>
:root{
  --indigo:#6366f1;--indigo-dark:#4f46e5;--indigo-light:#a5b4fc;
  --navy:#1e1b4b;--navy-mid:#312e81;
  --bg:#faf8f5;--bg-card:#ffffff;
  --text:#1e293b;--text-mid:#475569;--text-light:#94a3b8;
  --border:rgba(30,27,75,0.08);--radius:14px;
  --mono:'Source Code Pro',monospace;
  --shadow:0 2px 16px rgba(30,27,75,0.06);--shadow-hover:0 12px 40px rgba(99,102,241,0.15);
}
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Plus Jakarta Sans',-apple-system,sans-serif;color:var(--text);background:var(--bg);line-height:1.7;padding-top:64px;}
a{color:var(--indigo);text-decoration:none;transition:color .2s;}a:hover{color:var(--indigo-dark);}

/* HEADER */
header{background:rgba(30,27,75,.97);backdrop-filter:blur(12px);position:fixed;top:0;left:0;right:0;z-index:1000;height:64px;border-bottom:3px solid transparent;border-image:linear-gradient(90deg,#e11d48,#ea580c,#d97706,#16a34a,#0284c7,#6366f1,#7c3aed,#db2777) 1;}
header .inner{display:flex;align-items:center;justify-content:space-between;padding:0 24px;max-width:1200px;margin:0 auto;height:64px;}
header .brand{font-family:'Bricolage Grotesque',sans-serif;font-size:22px;font-weight:800;color:#fff;text-decoration:none;letter-spacing:-.3px;}
header .brand span{background:linear-gradient(135deg,#a5b4fc,#c084fc);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
header nav{display:flex;gap:2px;}
header nav a{color:rgba(255,255,255,0.6);font-size:11.5px;font-weight:500;text-transform:uppercase;letter-spacing:.5px;padding:6px 9px;border-radius:4px;font-family:var(--mono);transition:all .2s;}
header nav a:hover{color:#fff;background:rgba(99,102,241,.2);}
.nav-more{position:relative;}.nav-more>a{cursor:pointer;}
.nav-more .dropdown{display:none;position:absolute;top:100%;right:0;background:var(--navy);border:1px solid rgba(255,255,255,0.1);border-radius:8px;min-width:180px;padding:6px 0;z-index:100;box-shadow:0 12px 40px rgba(0,0,0,0.3);}
.nav-more:hover .dropdown{display:block;}
.nav-more .dropdown a{display:block;padding:8px 16px;font-size:12px;color:rgba(255,255,255,0.7);white-space:nowrap;}
.nav-more .dropdown a:hover{background:rgba(99,102,241,.2);color:#fff;}
.mobile-toggle{display:none;background:none;border:none;color:#fff;font-size:1.3rem;cursor:pointer;}
@media(max-width:900px){header nav{display:none;}.mobile-toggle{display:block;}}

/* HERO */
.hero{position:relative;overflow:hidden;padding:80px 24px 60px;text-align:center;background:linear-gradient(180deg,#f0eeff 0%,var(--bg) 100%);}
.hero .orb{position:absolute;border-radius:50%;filter:blur(40px);animation:float 12s ease-in-out infinite alternate;pointer-events:none;z-index:0;}
@keyframes float{0%{transform:translateY(0) scale(1);}50%{transform:translateY(-30px) scale(1.1);}100%{transform:translateY(10px) scale(0.95);}}
.hero-inner{position:relative;z-index:1;max-width:800px;margin:0 auto;}
.hero-pill{display:inline-flex;align-items:center;gap:8px;background:var(--bg-card);border:1px solid var(--border);border-radius:24px;padding:6px 20px;font-family:var(--mono);font-size:0.78rem;color:var(--text-mid);margin-bottom:24px;box-shadow:var(--shadow);}
.hero-pill .dot{width:8px;height:8px;border-radius:50%;background:var(--indigo);animation:pulse 2s ease-in-out infinite;}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.4;transform:scale(0.8);}}
.hero h1{font-family:'Bricolage Grotesque',sans-serif;font-size:clamp(2.2rem,5.5vw,3.6rem);font-weight:800;line-height:1.15;color:var(--navy);margin-bottom:20px;}
.hero h1 .grad{background:linear-gradient(135deg,#e11d48,#7c3aed,#0284c7,#16a34a);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;background-size:300% 300%;animation:gradShift 8s ease-in-out infinite;}
@keyframes gradShift{0%{background-position:0% 50%;}50%{background-position:100% 50%;}100%{background-position:0% 50%;}}
.hero p{font-size:1.15rem;color:var(--text-mid);max-width:580px;margin:0 auto 32px;line-height:1.7;}
.hero-stats{display:flex;justify-content:center;gap:32px;flex-wrap:wrap;}
.hero-stat{text-align:center;}
.hero-stat .num{font-family:'Bricolage Grotesque',sans-serif;font-size:1.8rem;font-weight:800;color:var(--navy);}
.hero-stat .lbl{font-size:0.78rem;color:var(--text-light);font-family:var(--mono);text-transform:uppercase;letter-spacing:0.5px;}

/* SPECTRUM BAR */
.spectrum{display:flex;height:4px;border-radius:2px;overflow:hidden;max-width:600px;margin:40px auto 0;box-shadow:0 2px 8px rgba(0,0,0,0.06);}
.spectrum-seg{flex:1;transition:flex .3s;}
.spectrum:hover .spectrum-seg{flex:0.8;}
.spectrum:hover .spectrum-seg:hover{flex:2.5;}

/* CATEGORY SECTION */
.cat-section{max-width:1200px;margin:0 auto;padding:56px 24px;}
.cat-section-header{display:flex;align-items:baseline;gap:12px;margin-bottom:32px;}
.cat-section-header h2{font-family:'Bricolage Grotesque',sans-serif;font-size:1.7rem;font-weight:800;color:var(--navy);}
.cat-section-header p{color:var(--text-light);font-size:0.9rem;font-family:var(--mono);}

/* BENTO GRID */
.bento-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;}
@media(max-width:900px){.bento-grid{grid-template-columns:1fr 1fr;}}
@media(max-width:600px){.bento-grid{grid-template-columns:1fr;}}

.cat-card{display:flex;align-items:center;gap:16px;padding:22px 24px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);text-decoration:none;color:inherit;transition:all .3s;position:relative;overflow:hidden;border-left:4px solid var(--cat-color,var(--indigo));}
.cat-card:hover{transform:translateY(-4px);box-shadow:var(--shadow-hover);border-color:var(--cat-color,var(--indigo));}
.cat-card.featured{grid-column:span 2;}
@media(max-width:600px){.cat-card.featured{grid-column:span 1;}}
.cat-icon-wrap{width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;transition:transform .3s;}
.cat-card:hover .cat-icon-wrap{transform:scale(1.1) rotate(-5deg);}
.cat-content{flex:1;min-width:0;}
.cat-content h3{font-family:'Bricolage Grotesque',sans-serif;font-size:1.05rem;font-weight:700;color:var(--navy);margin-bottom:4px;}
.cat-content p{font-size:0.82rem;color:var(--text-mid);line-height:1.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.cat-card.featured .cat-content p{white-space:normal;}
.cat-arrow{font-size:0.9rem;opacity:0;transform:translateX(-8px);transition:all .3s;}
.cat-card:hover .cat-arrow{opacity:1;transform:translateX(0);}

/* HOW IT WORKS */
.how-section{background:var(--navy);padding:72px 24px;margin-top:48px;}
.how-inner{max-width:1000px;margin:0 auto;}
.how-section h2{font-family:'Bricolage Grotesque',sans-serif;font-size:1.6rem;font-weight:800;color:#fff;text-align:center;margin-bottom:12px;}
.how-section>p,.how-inner>p{text-align:center;color:rgba(255,255,255,0.5);font-size:0.95rem;margin-bottom:48px;}
.how-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:24px;}
@media(max-width:768px){.how-grid{grid-template-columns:1fr 1fr;}}
.how-step{text-align:center;padding:24px 16px;border-radius:var(--radius);background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);}
.how-step .step-num{font-family:'Bricolage Grotesque',sans-serif;font-size:2.5rem;font-weight:800;margin-bottom:8px;line-height:1;}
.how-step:nth-child(1) .step-num{color:#e11d48;}
.how-step:nth-child(2) .step-num{color:#d97706;}
.how-step:nth-child(3) .step-num{color:#16a34a;}
.how-step:nth-child(4) .step-num{color:#7c3aed;}
.how-step h3{font-family:'Bricolage Grotesque',sans-serif;font-size:1rem;color:#fff;margin-bottom:8px;}
.how-step p{font-size:0.82rem;color:rgba(255,255,255,0.45);line-height:1.5;}

/* TAG CLOUD */
.tags-section{max-width:1200px;margin:0 auto;padding:56px 24px 0;text-align:center;}
.tags-section h2{font-family:'Bricolage Grotesque',sans-serif;font-size:1.4rem;font-weight:700;color:var(--navy);margin-bottom:24px;}
.tag-cloud{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;max-width:800px;margin:0 auto;}
.tag-pill{display:inline-flex;align-items:center;gap:6px;padding:6px 16px;border-radius:20px;font-size:0.82rem;font-weight:500;border:1px solid var(--border);background:var(--bg-card);color:var(--text-mid);transition:all .2s;cursor:default;}
.tag-pill:hover{transform:translateY(-2px);box-shadow:var(--shadow);}
.tag-pill i{font-size:0.7rem;}
.tag-pill:nth-child(1){color:#e11d48;border-color:rgba(225,29,72,0.2);}
.tag-pill:nth-child(2){color:#7c3aed;border-color:rgba(124,58,237,0.2);}
.tag-pill:nth-child(3){color:#ea580c;border-color:rgba(234,88,12,0.2);}
.tag-pill:nth-child(4){color:#0284c7;border-color:rgba(2,132,199,0.2);}
.tag-pill:nth-child(5){color:#16a34a;border-color:rgba(22,163,74,0.2);}
.tag-pill:nth-child(6){color:#db2777;border-color:rgba(219,39,119,0.2);}
.tag-pill:nth-child(7){color:#059669;border-color:rgba(5,150,105,0.2);}
.tag-pill:nth-child(8){color:#d97706;border-color:rgba(217,119,6,0.2);}
.tag-pill:nth-child(9){color:#2563eb;border-color:rgba(37,99,235,0.2);}
.tag-pill:nth-child(10){color:#9333ea;border-color:rgba(147,51,234,0.2);}
.tag-pill:nth-child(11){color:#64748b;border-color:rgba(100,116,139,0.2);}
.tag-pill:nth-child(12){color:#e11d48;border-color:rgba(225,29,72,0.2);}

/* FOOTER */
footer{background:var(--navy);color:rgba(255,255,255,0.55);padding:48px 0 24px;margin-top:60px;border-top:3px solid transparent;border-image:linear-gradient(90deg,#e11d48,#ea580c,#d97706,#16a34a,#0284c7,#6366f1,#7c3aed,#db2777) 1;}
footer .f-grid{max-width:1200px;margin:0 auto;padding:0 24px;display:grid;grid-template-columns:1.5fr repeat(3,1fr);gap:32px;}
footer .f-brand{font-family:'Bricolage Grotesque',sans-serif;font-size:18px;font-weight:800;color:#fff;margin-bottom:8px;}
footer .f-brand span{color:var(--indigo-light);}
footer .f-desc{font-size:0.85rem;color:rgba(255,255,255,0.5);line-height:1.6;max-width:320px;}
footer h4{font-family:var(--mono);font-size:0.72rem;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.35);margin-bottom:12px;}
footer h4+div a{display:block;font-size:0.82rem;color:rgba(255,255,255,0.5);padding:3px 0;}footer h4+div a:hover{color:var(--indigo-light);}
footer .f-bottom{max-width:1200px;margin:32px auto 0;padding:16px 24px 0;border-top:1px solid rgba(255,255,255,0.06);display:flex;justify-content:space-between;font-size:0.78rem;color:rgba(255,255,255,0.35);}
@media(max-width:768px){
  footer .f-grid{grid-template-columns:1fr;}
  footer .f-bottom{flex-direction:column;gap:8px;text-align:center;}
}
</style>
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
</header>

<section class="hero">
${orbsHtml}
<div class="hero-inner">
  <div class="hero-pill"><span class="dot"></span> 11 Industry Verticals · Data-Driven Intelligence</div>
  <h1>Product Decisions,<br><span class="grad">Brilliantly Informed.</span></h1>
  <p>From heavy machinery to pet supplies — we analyze specifications, compare products, and deliver actionable buying intelligence across 11 diverse industries.</p>
  <div class="hero-stats">
    <div class="hero-stat"><div class="num">11</div><div class="lbl">Verticals</div></div>
    <div class="hero-stat"><div class="num">100+</div><div class="lbl">Sub-Categories</div></div>
    <div class="hero-stat"><div class="num">Daily</div><div class="lbl">New Guides</div></div>
  </div>
  <div class="spectrum">${spectrumHtml}</div>
</div>
</section>

<section class="cat-section">
  <div class="cat-section-header">
    <h2>Explore by Industry</h2>
    <p>11 verticals · one standard</p>
  </div>
  <div class="bento-grid">
    ${catCardsHtml}
  </div>
</section>

<section class="tags-section">
  <h2>What We Cover</h2>
  <div class="tag-cloud">
    <span class="tag-pill"><i class="fas fa-cog"></i> Valves & Pumps</span>
    <span class="tag-pill"><i class="fas fa-microchip"></i> Semiconductors</span>
    <span class="tag-pill"><i class="fas fa-flask"></i> Polymers & Coatings</span>
    <span class="tag-pill"><i class="fas fa-tachometer-alt"></i> Turbo Systems</span>
    <span class="tag-pill"><i class="fas fa-couch"></i> Smart Furniture</span>
    <span class="tag-pill"><i class="fas fa-gem"></i> Jewelry & Eyewear</span>
    <span class="tag-pill"><i class="fas fa-pills"></i> Medical Devices</span>
    <span class="tag-pill"><i class="fas fa-blender"></i> Kitchen Equipment</span>
    <span class="tag-pill"><i class="fas fa-dumbbell"></i> Fitness Gear</span>
    <span class="tag-pill"><i class="fas fa-fish"></i> Aquarium Supplies</span>
    <span class="tag-pill"><i class="fas fa-guitar"></i> Musical Instruments</span>
    <span class="tag-pill"><i class="fas fa-tools"></i> Power Tools</span>
  </div>
</section>

<section class="how-section">
  <div class="how-inner">
    <h2>How SiteWise Works</h2>
    <p>Our four-step intelligence framework</p>
    <div class="how-grid">
      <div class="how-step">
        <div class="step-num">01</div>
        <h3>Data Collection</h3>
        <p>We aggregate specifications, reviews, and market data from hundreds of sources across each vertical.</p>
      </div>
      <div class="how-step">
        <div class="step-num">02</div>
        <h3>Spec Analysis</h3>
        <p>Deep-dive into materials, tolerances, certifications, and performance benchmarks.</p>
      </div>
      <div class="how-step">
        <div class="step-num">03</div>
        <h3>Expert Review</h3>
        <p>Our editorial team validates findings and adds real-world context to every assessment.</p>
      </div>
      <div class="how-step">
        <div class="step-num">04</div>
        <h3>Smart Guides</h3>
        <p>Actionable buying guides with clear recommendations, comparisons, and price-performance analysis.</p>
      </div>
    </div>
  </div>
</section>

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
</body>
</html>`;
}
