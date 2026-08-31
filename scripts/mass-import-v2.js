#!/usr/bin/env node
/**
 * MachinistPick - Mass Import from SmartBuy API (Optimized v2)
 *
 * Pipeline architecture:
 *   [Reader] → [Async Classifier] → [SmartBuy Fetcher] → [DB Inserter]
 *   All stages run concurrently, no sequential batch blocking.
 *
 * Usage:
 *   tmux new -s mp-import
 *   cd /data/vercel-projects/machinistpick
 *   node --env-file=.env.local scripts/mass-import-v2.js
 */

const mysql = require('mysql2/promise');
const https = require('https');
const fs = require('fs');
const readline = require('readline');

// ============ CONFIG ============
const SITE = 'sitewisetools';
const CONCURRENCY = 200;           // SmartBuy concurrent fetches
const CLASSIFY_BATCH = 200;        // keywords per LLM call
const DB_BATCH_SIZE = 200;         // rows per INSERT
const PROGRESS_FILE = '/tmp/sw_import_progress.txt';
const LOG_FILE = '/tmp/sw_import.log';
const SMARTBUY_BASE = 'https://smartbuy.alibaba.com/verticalSite/article.json';
const DASHSCOPE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

// Pipeline queue sizes
const PREFETCH_QUEUE = 5;          // how many classify batches to prefetch
const FETCH_QUEUE = 10;            // how many fetch batches to queue

// ============ INDEXNOW ============
const INDEXNOW_HOST = 'sitewisetools.com';
const INDEXNOW_KEY = '0889b2afc66e48e796cdc934fe4dfcd2';
const INDEXNOW_KEY_LOCATION = `https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`;
let indexnowBuffer = [];
let indexnowSubmitted = 0;
let indexnowFailed = 0;

function indexnowSubmit(urls) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      host: INDEXNOW_HOST, key: INDEXNOW_KEY, keyLocation: INDEXNOW_KEY_LOCATION,
      urlList: urls,
    });
    const req = https.request({
      hostname: 'api.indexnow.org', path: '/indexnow', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, (res) => {
      let body = ''; res.on('data', c => body += c);
      res.on('end', () => { res.statusCode === 200 ? indexnowSubmitted += urls.length : indexnowFailed += urls.length; resolve(); });
    });
    req.on('error', () => { indexnowFailed += urls.length; resolve(); });
    req.write(payload); req.end();
  });
}

async function flushIndexNow() {
  if (indexnowBuffer.length === 0) return;
  const urls = indexnowBuffer.splice(0);
  for (let i = 0; i < urls.length; i += 500) {
    await indexnowSubmit(urls.slice(i, i + 500));
  }
}

// ============ HEURISTIC CLASSIFICATION ============
const KEYWORD_RULES = [
  { type: 'industrial', patterns: [
    'valve','pipe','pump','crane','conveyor','hoist','compressor','motor','generator',
    'welding','grinding','milling','cnc','lathe','drill press','hydraulic','pneumatic',
    'bearing','gear','pulley','belt','chain','sprocket','coupling','flange',
    'boiler','heat exchanger','chiller','cooling tower','hvac','duct',
    'powder coating','optiflex','de-burr','deburring','sandblasting','shot blast',
    'excavator','bulldozer','forklift','loader','tractor','backhoe',
    'industrial','manufacturing','factory','machinery','machine tool',
    'ball valve','gate valve','check valve','butterfly valve','solenoid valve',
    'centrifugal pump','submersible pump','diaphragm pump','peristaltic pump',
    'air compressor','screw compressor','rotary compressor',
    'steel pipe','stainless pipe','pvc pipe','copper pipe','hose',
    'roller','idler','drum','belt conveyor','screw conveyor',
    'mixer','agitator','reactor','vessel','tank',
    'press','stamping','forging','casting','injection mold',
    'robot arm','cobots','plc','scada','automation',
  ]},
  { type: 'electronics', patterns: [
    'circuit','chip','semiconductor','transistor','mosfet','diode','capacitor','resistor',
    'pcb','fpga','microcontroller','arduino','raspberry pi','esp32',
    'gpu','cpu','ram','ssd','hdd','motherboard','graphics card',
    'display','oled','lcd','led panel','tft','touchscreen',
    'sensor','accelerometer','gyroscope','lidar','radar','ultrasonic',
    'rf','antenna','wifi','bluetooth','zigbee','lorawan','5g module',
    'power supply','inverter','converter','voltage regulator','ups',
    'oscilloscope','multimeter','soldering','smd',
    'ic','integrated circuit','op-amp','adc','dac',
    'connector','usb','hdmi','ethernet','fiber optic',
    'battery','lithium','solar panel','photovoltaic',
    'speaker','amplifier','headphone','microphone',
    'camera module','ccd','cmos','image sensor',
    'smartphone','tablet','laptop','computer','monitor',
    'router','switch','modem','access point',
    'drone','quadcopter','fpv',
  ]},
  { type: 'materials', patterns: [
    'steel','stainless','aluminum','copper','brass','bronze','titanium','zinc',
    'plastic','polyethylene','polypropylene','pvc','ptfe','nylon','abs','polycarbonate',
    'rubber','silicone','epoxy','polyurethane','acrylic',
    'adhesive','glue','sealant','caulk','tape',
    'glass','ceramic','porcelain','marble','granite','quartz',
    'wood','plywood','mdf','particle board','bamboo','lumber',
    'fabric','textile','cotton','polyester','nylon fabric','denim','silk',
    'paper','cardboard','corrugated','kraft',
    'chemical','solvent','acid','alkali','catalyst','pigment','dye',
    'coating','paint','varnish','primer','powder',
    'cement','concrete','mortar','grout','plaster',
    'foam','insulation','fiberglass','mineral wool',
    'sheet','plate','coil','strip','wire','rod','bar','tube',
    'galvanized','chrome','nickel','tin','lead',
    'composite','carbon fiber','kevlar','fiberglass',
    'resin','polymer','monomer','granule','pellet',
    'sherpa','fleece','velvet','suede','leather',
  ]},
  { type: 'automotive', patterns: [
    'car','truck','suv','van','motorcycle','atv','utv',
    'engine','transmission','clutch','differential','axle',
    'turbo','supercharger','intercooler','exhaust','muffler','catalytic converter',
    'brake','brake pad','rotor','caliper','drum brake',
    'suspension','shock absorber','strut','spring','sway bar',
    'steering','tie rod','ball joint','rack and pinion',
    'tire','wheel','rim','hub','lug','spoke',
    'headlight','taillight','fog light','led light bar','harness',
    'bumper','fender','hood','grille','spoiler','body kit',
    'seat','seat cover','floor mat','dashboard','console',
    'battery car','alternator','starter','ignition','spark plug',
    'oil filter','air filter','fuel filter','fuel pump','injector',
    'radiator','thermostat','water pump','hose automotive',
    'timing belt','serpentine belt','pulley automotive',
    'gasket','seal','o-ring','bearing automotive',
    'winch','tow','trailer','hitch',
    'off-road','4x4','lift kit','skid plate',
    'obd','diagnostic','scanner automotive',
    'audi','bmw','toyota','honda','ford','chevrolet','mercedes','volkswagen',
    'racing','motorsport','drift','drag',
    'ev','electric vehicle','hybrid','charging station',
    'dashcam','car stereo','subwoofer','gps navigation',
  ]},
  { type: 'home', patterns: [
    'furniture','sofa','couch','chair','table','desk','bed','mattress',
    'lamp','lighting','chandelier','sconce','floor lamp','table lamp',
    'curtain','blind','drapery','valance','sheer',
    'rug','carpet','mat','doormat',
    'pillow','cushion','throw','blanket','quilt','duvet',
    'shelf','bookcase','cabinet','wardrobe','dresser','nightstand',
    'mirror','frame','wall art','canvas','print','poster',
    'vase','planter','pot','urn','decor','decoration','ornament',
    'candle','candle holder','lantern',
    'clock','wall clock','alarm clock',
    'basket','bin','organizer','storage',
    'garden','lawn','hose','sprinkler','irrigation',
    'fence','gate','trellis','arbor','pergola',
    'outdoor furniture','patio','hammock','swing',
    'bbq','grill','smoker','fire pit',
    'pool','spa','hot tub','sauna',
    'kitchen','cookware','pan','pot kitchen','utensil','knife',
    'appliance','blender','mixer','toaster','coffee maker',
    'bathroom','toilet','shower','faucet','sink','bathtub',
    'tile','flooring','wallpaper','molding',
    'drain','drainage','gutter','downspout',
    'christmas','holiday','wreath','garland','stocking',
    'porcelain doll','collectible',
    'end table','coffee table','dining table','side table','console table',
    'living room','bedroom','dining room','office furniture',
  ]},
  { type: 'fashion', patterns: [
    'dress','skirt','blouse','shirt','t-shirt','polo','sweater','hoodie',
    'pants','jeans','trousers','shorts','leggings','joggers','cargo pants',
    'jacket','coat','blazer','vest','cardigan','parka','raincoat',
    'suit','tuxedo','formal wear',
    'shoe','boot','sneaker','sandal','slipper','heel','loafer','oxford',
    'bag','handbag','purse','backpack','tote','clutch','wallet',
    'jewelry','necklace','bracelet','ring','earring','pendant','brooch',
    'watch','smartwatch','fitness tracker',
    'sunglasses','glasses','eyewear','lens',
    'hat','cap','beanie','fedora','scarf','glove','belt',
    'tie','bow tie','cufflink','pocket square',
    'underwear','bra','panties','boxer','sock','hosiery',
    'swimwear','bikini','swimsuit','boardshort',
    'activewear','yoga pants','sports bra','compression',
    'uniform','scrub','lab coat','workwear',
    'fabric fashion','textile fashion','poodle fashion',
    'bridal','wedding dress','veil','garter',
    'costume','cosplay','halloween',
  ]},
  { type: 'health', patterns: [
    'medical','hospital','clinical','surgical','patient',
    'doctor','nurse','pharmacy','prescription',
    'medicine','drug','pharmaceutical','pill','capsule','tablet',
    'supplement','vitamin','mineral','protein','amino acid',
    'fitness','exercise','workout','gym','training',
    'weight loss','diet','nutrition','calorie',
    'therapy','rehabilitation','physical therapy','occupational therapy',
    'massage','acupuncture','chiropractic',
    'blood pressure','heart rate','glucose','cholesterol',
    'dental','tooth','oral','braces','implant dental',
    'vision','eye','contact lens','glasses health',
    'hearing','ear','hearing aid','cochlear',
    'nasogastric','catheter','stent','prosthetic','implant',
    'wheelchair','walker','crutch','cane','scooter medical',
    'bandage','dressing','suture','staple','gauze',
    'stethoscope','thermometer','pulse oximeter',
    'cpap','ventilator','oxygen','nebulizer',
    'first aid','emergency','trauma','rescue',
    'mental health','anxiety','depression','meditation','mindfulness',
    'sleep','insomnia','melatonin',
    'skin care','skincare','dermatology','sunscreen','moisturizer',
    'hair care','shampoo','conditioner','hair loss',
    'tear duct','watering eye','blocked tear',
    'resistance band','foam roller','yoga mat',
    'treadmill','elliptical','stationary bike','rowing machine',
  ]},
  { type: 'food', patterns: [
    'food','beverage','drink','juice','coffee','tea','wine','beer',
    'restaurant','cafe','catering','kitchen commercial',
    'cooking','baking','recipe','ingredient',
    'packaging food','container','bottle','can','jar','pouch',
    'organic','gluten free','vegan','vegetarian','keto',
    'dairy','cheese','milk','yogurt','butter',
    'meat','poultry','fish','seafood','beef','pork','chicken',
    'grain','rice','wheat','oat','quinoa','barley',
    'spice','herb','seasoning','salt','pepper',
    'sauce','condiment','dressing','marinade',
    'snack','candy','chocolate','cookie','cracker',
    'frozen','refrigerated','shelf stable',
    'canned','preserved','dried','dehydrated',
    'flour','sugar','sweetener','honey',
    'oil cooking','olive oil','coconut oil','vegetable oil',
    'juicer','blender commercial','espresso machine','ice maker',
    'oven','stove','range','fryer','griddle',
    'dishwasher','refrigerator','freezer','cooler',
    'utensil commercial','cutlery','flatware','glassware',
    'tablecloth','napkin','placemat',
    'vending machine','food truck',
  ]},
  { type: 'sports', patterns: [
    'sport','athletic','fitness equipment','gym equipment',
    'ball','football','soccer','basketball','baseball','volleyball','tennis',
    'golf','club golf','putter','driver','golf bag',
    'pickleball','paddle','racquet','racket',
    'bat','helmet','glove sport','cleat',
    'swim','swimming','goggle','snorkel','wetsuit',
    'surf','surfboard','kayak','canoe','paddleboard',
    'ski','snowboard','skiing','snowboarding',
    'bike','bicycle','cycling','mountain bike','road bike',
    'climb','climbing','harness','carabiner','rope climbing',
    'camp','camping','tent','sleeping bag','backpack outdoor',
    'hike','hiking','trek','trail',
    'fish','fishing','reel','rod fishing','tackle','lure',
    'hunt','hunting','scope','binocular','camo',
    'jump rope','skipping rope',
    'yoga','pilates','stretch',
    'boxing','mma','martial art','kickbox',
    'crossfit','weightlifting','powerlifting',
    'run','running','jog','marathon','trail running',
    'skateboard','roller','scooter sport',
    'archery','bow','arrow',
    'overgrip','tennis grip',
  ]},
  { type: 'pets', patterns: [
    'pet','dog','cat','puppy','kitten',
    'bird','parrot','parakeet','canary','cockatiel',
    'fish aquarium','aquarium','fish tank','filter aquarium',
    'hamster','guinea pig','rabbit','gerbil','ferret',
    'reptile','snake','lizard','turtle','tortoise','gecko',
    'horse','equine','saddle','bridle','hoof',
    'leash','collar','harness pet','crate','kennel','carrier',
    'pet food','dog food','cat food','treat','biscuit',
    'pet toy','chew toy','cat toy','dog toy',
    'litter','cat litter','litter box',
    'grooming','pet shampoo','brush pet','nail clipper',
    'bed pet','pet blanket','pet house',
    'flea','tick','parasite','dewormer',
    'bowl','feeder','water dispenser','fountain pet',
    'training','clicker','whistle','fence pet',
    'aquarium plant','coral','reef','substrate',
    'terrarium','vivarium','heat lamp','uvb',
    'bird cage','perch','bird seed','nest',
  ]},
];

function heuristicClassify(keyword) {
  const lower = keyword.toLowerCase();
  let bestType = null, bestScore = 0;
  for (const rule of KEYWORD_RULES) {
    let score = 0;
    for (const p of rule.patterns) {
      if (lower.includes(p)) score += p.length;
    }
    if (score > bestScore) { bestScore = score; bestType = rule.type; }
  }
  return bestScore >= 4 ? bestType : null;
}

// ============ LLM CLASSIFICATION (async, batched, multi-key) ============
let dashscopeKeys = [];
let keyIndex = 0;

function loadDashScopeKeys() {
  try {
    const auth = JSON.parse(fs.readFileSync('/root/.hermes/auth.json', 'utf8'));
    const pool = auth.credential_pool?.alibaba || {};
    dashscopeKeys = Array.isArray(pool) ? pool.map(c => c.access_token).filter(Boolean)
      : Object.values(pool).map(c => c.access_token).filter(Boolean);
  } catch { dashscopeKeys = []; }
}

function llmClassifyBatch(keywords) {
  return new Promise((resolve) => {
    if (dashscopeKeys.length === 0) return resolve(keywords.map(() => 'more'));
    const apiKey = dashscopeKeys[keyIndex++ % dashscopeKeys.length];
    const prompt = `Classify each keyword into ONE category: industrial, electronics, materials, automotive, home, fashion, health, food, sports, pets, more.
Return ONLY JSON: [{"k":"...","c":"..."}]
Keywords:\n${keywords.map((k, i) => `${i+1}.${k}`).join('\n')}`;
    const body = JSON.stringify({
      model: 'qwen-plus', messages: [{ role: 'user', content: prompt }],
      temperature: 0.1, max_tokens: 6000,
    });
    const req = https.request(DASHSCOPE_URL, {
      method: 'POST', timeout: 90000,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    }, (res) => {
      let data = ''; res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const content = json.choices?.[0]?.message?.content || '';
          const match = content.match(/\[[\s\S]*\]/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            const map = new Map(parsed.map(p => [p.k || p.keyword, p.c || p.category]));
            resolve(keywords.map(k => map.get(k) || 'more'));
          } else resolve(keywords.map(() => 'more'));
        } catch { resolve(keywords.map(() => 'more')); }
      });
    });
    req.on('error', () => resolve(keywords.map(() => 'more')));
    req.on('timeout', () => { req.destroy(); resolve(keywords.map(() => 'more')); });
    req.write(body); req.end();
  });
}

// Classify a batch: heuristic first, LLM only for unmatched
async function classifyBatch(keywords) {
  const results = new Array(keywords.length);
  const llmIndices = [];
  const llmKeywords = [];
  for (let i = 0; i < keywords.length; i++) {
    const h = heuristicClassify(keywords[i]);
    if (h) { results[i] = h; }
    else { llmIndices.push(i); llmKeywords.push(keywords[i]); }
  }
  if (llmKeywords.length > 0) {
    const llmTypes = await llmClassifyBatch(llmKeywords);
    for (let i = 0; i < llmIndices.length; i++) results[llmIndices[i]] = llmTypes[i] || 'more';
  }
  return keywords.map((kw, i) => ({ keyword: kw, slug: makeSlug(kw), type: results[i] }));
}

// ============ SMARTBUY API ============
function fetchField(keyType, keyword) {
  return new Promise((resolve, reject) => {
    const key = `${keyType}|${keyword}`;
    const url = `${SMARTBUY_BASE}?key=${encodeURIComponent(key)}`;
    const req = https.get(url, { timeout: 30000 }, (res) => {
      let data = ''; res.on('data', c => data += c);
      res.on('end', () => resolve(data.trim()));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function makeSlug(keyword) {
  return keyword.trim().toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function cleanBody(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<\/?div[^>]*>/gi, '')
    .replace(/\s*class="one-[^"]*"/gi, '');
}

// ============ LOG ============
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  logStream.write(line + '\n');
}

// ============ MAIN ============
(async () => {
  const url = process.env.MYSQL_URL;
  if (!url) { console.error('MYSQL_URL not set'); process.exit(1); }

  const u = new URL(url);
  let conn = await mysql.createConnection({
    host: u.hostname, port: parseInt(u.port || '3306'),
    user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''), connectTimeout: 10000, disableEval: true,
  });

  const [authors] = await conn.query("SELECT name FROM authors WHERE site = ? AND slug != 'team'", [SITE]);
  if (authors.length === 0) { console.error('No authors found'); process.exit(1); }
  const authorNames = authors.map(a => a.name);

  const [existing] = await conn.query("SELECT short_title FROM articles WHERE site = ?", [SITE]);
  const done = new Set(existing.map(r => r.short_title));

  let resumeLine = 0;
  if (fs.existsSync(PROGRESS_FILE)) {
    resumeLine = parseInt(fs.readFileSync(PROGRESS_FILE, 'utf8').trim(), 10) || 0;
  }

  loadDashScopeKeys();

  const stats = {
    total: 0, imported: 0, errors: 0, heuristic: 0, llm: 0, emptyBody: 0,
    skipped: 0, typeCounts: {}, startTime: Date.now(),
  };

  // ============ PIPELINE ============
  // Stage 1: Classify batches (with prefetch)
  // Stage 2: Fetch + DB insert (high concurrency)
  
  const fetchQueue = [];      // classified items waiting for fetch
  let classifyDone = false;
  let fetchDone = false;
  let activeFetches = 0;

  // DB batch insert buffer
  let dbBatch = [];
  
  async function flushDbBatch() {
    if (dbBatch.length === 0) return;
    const batch = dbBatch.splice(0);
    const placeholders = batch.map(() => "(?, ?, ?, ?, ?, ?, 'en', ?, 'Y', NOW(), NOW())");
    const values = [];
    for (const b of batch) {
      values.push(b.site, b.slug, b.title, b.body, b.desc, b.type, b.author);
    }
    const sql = `INSERT INTO articles (site, short_title, title, body, description, type, language, author, is_online, published_time, modified_time) VALUES ${placeholders.join(',')} ON DUPLICATE KEY UPDATE title=VALUES(title), body=VALUES(body), description=VALUES(description), type=VALUES(type), author=VALUES(author), modified_time=NOW()`;
    
    let retries = 3;
    while (retries > 0) {
      try {
        try { await conn.query('SELECT 1'); } catch {
          await conn.end().catch(() => {});
          const u2 = new URL(process.env.MYSQL_URL);
          conn = await mysql.createConnection({
            host: u2.hostname, port: parseInt(u2.port || '3306'),
            user: decodeURIComponent(u2.username), password: decodeURIComponent(u2.password),
            database: u2.pathname.replace(/^\//, ''), connectTimeout: 10000, disableEval: true,
          });
        }
        await conn.query(sql, values);
        stats.imported += batch.length;
        break;
      } catch (e) {
        retries--;
        if (retries > 0) { await new Promise(r => setTimeout(r, 2000)); }
        else { stats.errors += batch.length; }
      }
    }
  }

  // Process one classified item: fetch from SmartBuy + queue for DB
  async function processItem(item) {
    if (done.has(item.slug)) { stats.skipped++; return; }
    try {
      const [title, desc, body] = await Promise.all([
        fetchField('_seo_product_insights_title', item.keyword),
        fetchField('_seo_product_insights_desc', item.keyword),
        fetchField('_seo_product_insights_content', item.keyword),
      ]);
      if (!body || body.length < 100) { stats.emptyBody++; return; }
      
      const cleanHtml = cleanBody(body);
      const author = authorNames[Math.floor(Math.random() * authorNames.length)];
      stats.typeCounts[item.type] = (stats.typeCounts[item.type] || 0) + 1;
      done.add(item.slug);
      
      dbBatch.push({ site: SITE, slug: item.slug, title, body: cleanHtml, desc, type: item.type, author });
      indexnowBuffer.push(`https://${INDEXNOW_HOST}/${item.type}/${item.slug}`);
      
      if (dbBatch.length >= DB_BATCH_SIZE) await flushDbBatch();
    } catch (e) {
      stats.errors++;
    }
  }

  // Consumer: process fetch queue with concurrency control
  async function fetchConsumer() {
    while (!classifyDone || fetchQueue.length > 0) {
      while (fetchQueue.length > 0 && activeFetches < CONCURRENCY) {
        const item = fetchQueue.shift();
        activeFetches++;
        processItem(item).then(() => { activeFetches--; }).catch(() => { activeFetches--; stats.errors++; });
      }
      await new Promise(r => setTimeout(r, 10));
    }
    // Wait for all in-flight fetches
    while (activeFetches > 0) await new Promise(r => setTimeout(r, 100));
    await flushDbBatch();
    await flushIndexNow();
    fetchDone = true;
  }

  // Start consumer
  const consumerPromise = fetchConsumer();

  // Producer: read keywords, classify in batches, push to fetch queue
  const KEYWORD_FILE = '/tmp/sw_keywords.txt';
  const rl = readline.createInterface({
    input: fs.createReadStream(KEYWORD_FILE), crlfDelay: Infinity,
  });

  let lineNum = 0;
  let batch = [];
  let lastLogTime = 0;

  log(`\n========== SiteWiseTools Mass Import v2 (Pipeline) ==========`);
  log(`Existing articles: ${done.size}`);
  log(`Resume from line: ${resumeLine}`);
  log(`DashScope keys: ${dashscopeKeys.length}`);
  log(`Authors: ${authorNames.length}`);
  log(`Concurrency: ${CONCURRENCY}, Classify batch: ${CLASSIFY_BATCH}, DB batch: ${DB_BATCH_SIZE}`);
  log(`================================================\n`);

  for await (const line of rl) {
    lineNum++;
    if (lineNum <= resumeLine) continue;
    const kw = line.trim();
    if (!kw) continue;
    batch.push(kw);

    if (batch.length >= CLASSIFY_BATCH) {
      const keywords = batch.splice(0);
      // Classify (heuristic + LLM for unmatched)
      const heuristicCount = keywords.filter(k => heuristicClassify(k)).length;
      stats.heuristic += heuristicCount;
      stats.llm += keywords.length - heuristicCount;
      
      const classified = await classifyBatch(keywords);
      
      // Push to fetch queue
      fetchQueue.push(...classified);
      stats.total += keywords.length;

      // Save progress
      fs.writeFileSync(PROGRESS_FILE, String(lineNum));

      // Periodic flush of indexnow
      if (indexnowBuffer.length >= 500) await flushIndexNow();

      // Log stats every 10 seconds
      const now = Date.now();
      if (now - lastLogTime > 10000) {
        lastLogTime = now;
        const elapsed = (now - stats.startTime) / 1000 / 60;
        const rate = stats.imported / Math.max(elapsed, 0.1);
        log(`Imported: ${stats.imported} | Errors: ${stats.errors} | Skipped: ${stats.skipped} | Rate: ${rate.toFixed(1)}/min | ` +
          `Queue: ${fetchQueue.length} | Active: ${activeFetches} | H: ${stats.heuristic} | LLM: ${stats.llm} | Empty: ${stats.emptyBody}`);
        log(`  Types: ${Object.entries(stats.typeCounts).sort((a,b) => b[1]-a[1]).map(([k,v]) => `${k}=${v}`).join(', ')}`);
        log(`  IndexNow: ${indexnowSubmitted} ok, ${indexnowFailed} fail`);
      }
    }
  }

  // Process remaining batch
  if (batch.length > 0) {
    const keywords = batch;
    const heuristicCount = keywords.filter(k => heuristicClassify(k)).length;
    stats.heuristic += heuristicCount;
    stats.llm += keywords.length - heuristicCount;
    const classified = await classifyBatch(keywords);
    fetchQueue.push(...classified);
    stats.total += keywords.length;
  }

  classifyDone = true;
  await consumerPromise;

  log(`\n========== COMPLETE ==========`);
  const elapsed = (Date.now() - stats.startTime) / 1000 / 60;
  log(`Total: ${stats.imported} imported in ${elapsed.toFixed(1)} min (${(stats.imported/elapsed).toFixed(1)}/min)`);
  log(`Errors: ${stats.errors} | Empty: ${stats.emptyBody} | Skipped: ${stats.skipped}`);
  log(`IndexNow: ${indexnowSubmitted} submitted, ${indexnowFailed} failed`);

  const [rows] = await conn.query(
    "SELECT type, COUNT(*) as cnt FROM articles WHERE site=? AND is_online='Y' GROUP BY type ORDER BY cnt DESC", [SITE]
  );
  log('\nFinal DB state:');
  rows.forEach(r => log(`  ${r.type}: ${r.cnt}`));
  const totalRow = rows.reduce((s, r) => s + Number(r.cnt), 0);
  log(`  TOTAL: ${totalRow}`);

  await conn.end();
})().catch(e => { console.error('Fatal:', e); process.exit(1); });
