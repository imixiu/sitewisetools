#!/usr/bin/env node
/**
 * ToolGuideDaily - Mass Import from SmartBuy API
 * 
 * Usage:
 *   tmux new -s tgd-import
 *   cd /root/vercel-projects/toolguidedaily
 *   node --env-file=.env.local scripts/mass-import.js
 *
 * Features:
 *   - Streams keywords from file (no memory bloat)
 *   - Local heuristic classification + LLM fallback for ambiguous
 *   - SmartBuy API fetch with concurrency control
 *   - HTML cleaning (strip div/style) before DB insert
 *   - Batch DB inserts (50 rows at a time)
 *   - Resume support via progress file
 *   - Progress logging every 100 keywords
 */

const mysql = require('mysql2/promise');
const https = require('https');
const fs = require('fs');
const readline = require('readline');

// ============ CONFIG ============
const SITE = 'sitewisetools';
const CONCURRENCY = 120;
const DELAY_MS = 200;
const CLASSIFY_BATCH = 50;
const DB_BATCH_SIZE = 50;
const PROGRESS_FILE = '/tmp/sw_import_progress.txt';
const SMARTBUY_BASE = 'https://smartbuy.alibaba.com/verticalSite/article.json';
const DASHSCOPE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

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
      host: INDEXNOW_HOST,
      key: INDEXNOW_KEY,
      keyLocation: INDEXNOW_KEY_LOCATION,
      urlList: urls
    });
    const req = https.request({
      hostname: 'api.indexnow.org',
      path: '/indexnow',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        if (res.statusCode === 200) {
          indexnowSubmitted += urls.length;
        } else {
          indexnowFailed += urls.length;
        }
        resolve();
      });
    });
    req.on('error', () => { indexnowFailed += urls.length; resolve(); });
    req.write(payload);
    req.end();
  });
}

async function flushIndexNow() {
  if (indexnowBuffer.length === 0) return;
  const urls = indexnowBuffer.splice(0);
  // Split into batches of 500 for IndexNow
  for (let i = 0; i < urls.length; i += 500) {
    const chunk = urls.slice(i, i + 500);
    await indexnowSubmit(chunk);
  }
}

// ============ HEURISTIC CLASSIFICATION ============
const KEYWORD_RULES = [
  // industrial
  { type: 'industrial', patterns: [
    'valve', 'pipe', 'pump', 'crane', 'conveyor', 'hoist', 'compressor', 'motor', 'generator',
    'welding', 'grinding', 'milling', 'cnc', 'lathe', 'drill press', 'hydraulic', 'pneumatic',
    'bearing', 'gear', 'pulley', 'belt', 'chain', 'sprocket', 'coupling', 'flange',
    'boiler', 'heat exchanger', 'chiller', 'cooling tower', 'hvac', 'duct',
    'powder coating', 'optiflex', 'de-burr', 'deburring', 'sandblasting', 'shot blast',
    'excavator', 'bulldozer', 'forklift', 'loader', 'tractor', 'backhoe',
    'industrial', 'manufacturing', 'factory', 'machinery', 'machine tool',
    'ball valve', 'gate valve', 'check valve', 'butterfly valve', 'solenoid valve',
    'centrifugal pump', 'submersible pump', 'diaphragm pump', 'peristaltic pump',
    'air compressor', 'screw compressor', 'rotary compressor',
    'steel pipe', 'stainless pipe', 'pvc pipe', 'copper pipe', 'hose',
    'roller', 'idler', 'drum', 'belt conveyor', 'screw conveyor',
    'mixer', 'agitator', 'reactor', 'vessel', 'tank',
    'press', 'stamping', 'forging', 'casting', 'injection mold',
    'robot arm', 'cobots', 'plc', 'scada', 'automation',
  ]},
  // electronics
  { type: 'electronics', patterns: [
    'circuit', 'chip', 'semiconductor', 'transistor', 'mosfet', 'diode', 'capacitor', 'resistor',
    'pcb', 'fpga', 'fpga', 'microcontroller', 'arduino', 'raspberry pi', 'esp32',
    'gpu', 'cpu', 'ram', 'ssd', 'hdd', 'motherboard', 'graphics card',
    'display', 'oled', 'lcd', 'led panel', 'tft', 'touchscreen',
    'sensor', 'accelerometer', 'gyroscope', 'lidar', 'radar', 'ultrasonic',
    'rf', 'antenna', 'wifi', 'bluetooth', 'zigbee', 'lorawan', '5g module',
    'power supply', 'inverter', 'converter', 'voltage regulator', 'ups',
    'oscilloscope', 'multimeter', 'soldering', 'smd',
    'ic', 'integrated circuit', 'op-amp', 'adc', 'dac',
    'connector', 'usb', 'hdmi', 'ethernet', 'fiber optic',
    'battery', 'lithium', 'solar panel', 'photovoltaic',
    'speaker', 'amplifier', 'headphone', 'microphone',
    'camera module', 'ccd', 'cmos', 'image sensor',
    'smartphone', 'tablet', 'laptop', 'computer', 'monitor',
    'router', 'switch', 'modem', 'access point',
    'drone', 'quadcopter', 'fpv',
  ]},
  // materials
  { type: 'materials', patterns: [
    'steel', 'stainless', 'aluminum', 'copper', 'brass', 'bronze', 'titanium', 'zinc',
    'plastic', 'polyethylene', 'polypropylene', 'pvc', 'ptfe', 'nylon', 'abs', 'polycarbonate',
    'rubber', 'silicone', 'epoxy', 'polyurethane', 'acrylic',
    'adhesive', 'glue', 'sealant', 'caulk', 'tape',
    'glass', 'ceramic', 'porcelain', 'marble', 'granite', 'quartz',
    'wood', 'plywood', 'mdf', 'particle board', 'bamboo', 'lumber',
    'fabric', 'textile', 'cotton', 'polyester', 'nylon fabric', 'denim', 'silk',
    'paper', 'cardboard', 'corrugated', 'kraft',
    'chemical', 'solvent', 'acid', 'alkali', 'catalyst', 'pigment', 'dye',
    'coating', 'paint', 'varnish', 'primer', 'powder',
    'cement', 'concrete', 'mortar', 'grout', 'plaster',
    'foam', 'insulation', 'fiberglass', 'mineral wool',
    'sheet', 'plate', 'coil', 'strip', 'wire', 'rod', 'bar', 'tube',
    'galvanized', 'chrome', 'nickel', 'tin', 'lead',
    'composite', 'carbon fiber', 'kevlar', 'fiberglass',
    'resin', 'polymer', 'monomer', 'granule', 'pellet',
    'sherpa', 'fleece', 'velvet', 'suede', 'leather',
  ]},
  // automotive
  { type: 'automotive', patterns: [
    'car', 'truck', 'suv', 'van', 'motorcycle', 'atv', 'utv',
    'engine', 'transmission', 'clutch', 'differential', 'axle',
    'turbo', 'supercharger', 'intercooler', 'exhaust', 'muffler', 'catalytic converter',
    'brake', 'brake pad', 'rotor', 'caliper', 'drum brake',
    'suspension', 'shock absorber', 'strut', 'spring', 'sway bar',
    'steering', 'tie rod', 'ball joint', 'rack and pinion',
    'tire', 'wheel', 'rim', 'hub', 'lug', 'spoke',
    'headlight', 'taillight', 'fog light', 'led light bar', 'harness',
    'bumper', 'fender', 'hood', 'grille', 'spoiler', 'body kit',
    'seat', 'seat cover', 'floor mat', 'dashboard', 'console',
    'battery car', 'alternator', 'starter', 'ignition', 'spark plug',
    'oil filter', 'air filter', 'fuel filter', 'fuel pump', 'injector',
    'radiator', 'thermostat', 'water pump', 'hose automotive',
    'timing belt', 'serpentine belt', 'pulley automotive',
    'gasket', 'seal', 'o-ring', 'bearing automotive',
    'winch', 'tow', 'trailer', 'hitch',
    'off-road', '4x4', 'lift kit', 'skid plate',
    'obd', 'diagnostic', 'scanner automotive',
    'audi', 'bmw', 'toyota', 'honda', 'ford', 'chevrolet', 'mercedes', 'volkswagen',
    'racing', 'motorsport', 'drift', 'drag',
    'ev', 'electric vehicle', 'hybrid', 'charging station',
    'dashcam', 'car stereo', 'subwoofer', 'gps navigation',
  ]},
  // home
  { type: 'home', patterns: [
    'furniture', 'sofa', 'couch', 'chair', 'table', 'desk', 'bed', 'mattress',
    'lamp', 'lighting', 'chandelier', 'sconce', 'floor lamp', 'table lamp',
    'curtain', 'blind', 'drapery', 'valance', 'sheer',
    'rug', 'carpet', 'mat', 'doormat',
    'pillow', 'cushion', 'throw', 'blanket', 'quilt', 'duvet',
    'shelf', 'bookcase', 'cabinet', 'wardrobe', 'dresser', 'nightstand',
    'mirror', 'frame', 'wall art', 'canvas', 'print', 'poster',
    'vase', 'planter', 'pot', 'urn', 'decor', 'decoration', 'ornament',
    'candle', 'candle holder', 'lantern',
    'clock', 'wall clock', 'alarm clock',
    'basket', 'bin', 'organizer', 'storage',
    'garden', 'lawn', 'hose', 'sprinkler', 'irrigation',
    'fence', 'gate', 'trellis', 'arbor', 'pergola',
    'outdoor furniture', 'patio', 'hammock', 'swing',
    'bbq', 'grill', 'smoker', 'fire pit',
    'pool', 'spa', 'hot tub', 'sauna',
    'kitchen', 'cookware', 'pan', 'pot kitchen', 'utensil', 'knife',
    'appliance', 'blender', 'mixer', 'toaster', 'coffee maker',
    'bathroom', 'toilet', 'shower', 'faucet', 'sink', 'bathtub',
    'tile', 'flooring', 'wallpaper', 'molding',
    'drain', 'drainage', 'gutter', 'downspout',
    'christmas', 'holiday', 'wreath', 'garland', 'stocking',
    'porcelain doll', 'collectible',
    'end table', 'coffee table', 'dining table', 'side table', 'console table',
    'living room', 'bedroom', 'dining room', 'office furniture',
  ]},
  // fashion
  { type: 'fashion', patterns: [
    'dress', 'skirt', 'blouse', 'shirt', 't-shirt', 'polo', 'sweater', 'hoodie',
    'pants', 'jeans', 'trousers', 'shorts', 'leggings', 'joggers', 'cargo pants',
    'jacket', 'coat', 'blazer', 'vest', 'cardigan', 'parka', 'raincoat',
    'suit', 'tuxedo', 'formal wear',
    'shoe', 'boot', 'sneaker', 'sandal', 'slipper', 'heel', 'loafer', 'oxford',
    'bag', 'handbag', 'purse', 'backpack', 'tote', 'clutch', 'wallet',
    'jewelry', 'necklace', 'bracelet', 'ring', 'earring', 'pendant', 'brooch',
    'watch', 'smartwatch', 'fitness tracker',
    'sunglasses', 'glasses', 'eyewear', 'lens',
    'hat', 'cap', 'beanie', 'fedora', 'scarf', 'glove', 'belt',
    'tie', 'bow tie', 'cufflink', 'pocket square',
    'underwear', 'bra', 'panties', 'boxer', 'sock', 'hosiery',
    'swimwear', 'bikini', 'swimsuit', 'boardshort',
    'activewear', 'yoga pants', 'sports bra', 'compression',
    'uniform', 'scrub', 'lab coat', 'workwear',
    'fabric fashion', 'textile fashion', 'poodle fashion',
    'bridal', 'wedding dress', 'veil', 'garter',
    'costume', 'cosplay', 'halloween',
  ]},
  // health
  { type: 'health', patterns: [
    'medical', 'hospital', 'clinical', 'surgical', 'patient',
    'doctor', 'nurse', 'pharmacy', 'prescription',
    'medicine', 'drug', 'pharmaceutical', 'pill', 'capsule', 'tablet',
    'supplement', 'vitamin', 'mineral', 'protein', 'amino acid',
    'fitness', 'exercise', 'workout', 'gym', 'training',
    'weight loss', 'diet', 'nutrition', 'calorie',
    'therapy', 'rehabilitation', 'physical therapy', 'occupational therapy',
    'massage', 'acupuncture', 'chiropractic',
    'blood pressure', 'heart rate', 'glucose', 'cholesterol',
    'dental', 'tooth', 'oral', 'braces', 'implant dental',
    'vision', 'eye', 'contact lens', 'glasses health',
    'hearing', 'ear', 'hearing aid', 'cochlear',
    'nasogastric', 'catheter', 'stent', 'prosthetic', 'implant',
    'wheelchair', 'walker', 'crutch', 'cane', 'scooter medical',
    'bandage', 'dressing', 'suture', 'staple', 'gauze',
    'stethoscope', 'thermometer', 'pulse oximeter',
    'cpap', 'ventilator', 'oxygen', 'nebulizer',
    'first aid', 'emergency', 'trauma', 'rescue',
    'mental health', 'anxiety', 'depression', 'meditation', 'mindfulness',
    'sleep', 'insomnia', 'melatonin',
    'skin care', 'skincare', 'dermatology', 'sunscreen', 'moisturizer',
    'hair care', 'shampoo', 'conditioner', 'hair loss',
    'tear duct', 'watering eye', 'blocked tear',
    'resistance band', 'foam roller', 'yoga mat',
    'treadmill', 'elliptical', 'stationary bike', 'rowing machine',
  ]},
  // food
  { type: 'food', patterns: [
    'food', 'beverage', 'drink', 'juice', 'coffee', 'tea', 'wine', 'beer',
    'restaurant', 'cafe', 'catering', 'kitchen commercial',
    'cooking', 'baking', 'recipe', 'ingredient',
    'packaging food', 'container', 'bottle', 'can', 'jar', 'pouch',
    'organic', 'gluten free', 'vegan', 'vegetarian', 'keto',
    'dairy', 'cheese', 'milk', 'yogurt', 'butter',
    'meat', 'poultry', 'fish', 'seafood', 'beef', 'pork', 'chicken',
    'grain', 'rice', 'wheat', 'oat', 'quinoa', 'barley',
    'spice', 'herb', 'seasoning', 'salt', 'pepper',
    'sauce', 'condiment', 'dressing', 'marinade',
    'snack', 'candy', 'chocolate', 'cookie', 'cracker',
    'frozen', 'refrigerated', 'shelf stable',
    'canned', 'preserved', 'dried', 'dehydrated',
    'flour', 'sugar', 'sweetener', 'honey',
    'oil cooking', 'olive oil', 'coconut oil', 'vegetable oil',
    'juicer', 'blender commercial', 'espresso machine', 'ice maker',
    'oven', 'stove', 'range', 'fryer', 'griddle',
    'dishwasher', 'refrigerator', 'freezer', 'cooler',
    'utensil commercial', 'cutlery', 'flatware', 'glassware',
    'tablecloth', 'napkin', 'placemat',
    'vending machine', 'food truck',
  ]},
  // sports
  { type: 'sports', patterns: [
    'sport', 'athletic', 'fitness equipment', 'gym equipment',
    'ball', 'football', 'soccer', 'basketball', 'baseball', 'volleyball', 'tennis',
    'golf', 'club golf', 'putter', 'driver', 'golf bag',
    'pickleball', 'paddle', 'racquet', 'racket',
    'bat', 'helmet', 'glove sport', 'cleat',
    'swim', 'swimming', 'goggle', 'snorkel', 'wetsuit',
    'surf', 'surfboard', 'kayak', 'canoe', 'paddleboard',
    'ski', 'snowboard', 'skiing', 'snowboarding',
    'bike', 'bicycle', 'cycling', 'mountain bike', 'road bike',
    'climb', 'climbing', 'harness', 'carabiner', 'rope climbing',
    'camp', 'camping', 'tent', 'sleeping bag', 'backpack outdoor',
    'hike', 'hiking', 'trek', 'trail',
    'fish', 'fishing', 'reel', 'rod fishing', 'tackle', 'lure',
    'hunt', 'hunting', 'scope', 'binocular', 'camo',
    'jump rope', 'skipping rope',
    'yoga', 'pilates', 'stretch',
    'boxing', 'mma', 'martial art', 'kickbox',
    'crossfit', 'weightlifting', 'powerlifting',
    'run', 'running', 'jog', 'marathon', 'trail running',
    'skateboard', 'roller', 'scooter sport',
    'archery', 'bow', 'arrow',
    'overgrip', 'tennis grip',
  ]},
  // pets
  { type: 'pets', patterns: [
    'pet', 'dog', 'cat', 'puppy', 'kitten',
    'bird', 'parrot', 'parakeet', 'canary', 'cockatiel',
    'fish aquarium', 'aquarium', 'fish tank', 'filter aquarium',
    'hamster', 'guinea pig', 'rabbit', 'gerbil', 'ferret',
    'reptile', 'snake', 'lizard', 'turtle', 'tortoise', 'gecko',
    'horse', 'equine', 'saddle', 'bridle', 'hoof',
    'leash', 'collar', 'harness pet', 'crate', 'kennel', 'carrier',
    'pet food', 'dog food', 'cat food', 'treat', 'biscuit',
    'pet toy', 'chew toy', 'cat toy', 'dog toy',
    'litter', 'cat litter', 'litter box',
    'grooming', 'pet shampoo', 'brush pet', 'nail clipper',
    'bed pet', 'pet blanket', 'pet house',
    'flea', 'tick', 'parasite', 'dewormer',
    'bowl', 'feeder', 'water dispenser', 'fountain pet',
    'training', 'clicker', 'whistle', 'fence pet',
    'aquarium plant', 'coral', 'reef', 'substrate',
    'terrarium', 'vivarium', 'heat lamp', 'uvb',
    'bird cage', 'perch', 'bird seed', 'nest',
  ]},
];

function heuristicClassify(keyword) {
  const lower = keyword.toLowerCase();
  let bestType = null;
  let bestScore = 0;

  for (const rule of KEYWORD_RULES) {
    let score = 0;
    for (const p of rule.patterns) {
      if (lower.includes(p)) {
        // Longer pattern = more specific = higher score
        score += p.length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestType = rule.type;
    }
  }

  // Only use heuristic if we got a decent match (score > 3 = at least a 4-char pattern matched)
  if (bestScore >= 4) return bestType;
  return null; // Needs LLM
}

// ============ LLM CLASSIFICATION ============
let dashscopeKeys = [];
let keyIndex = 0;

function loadDashScopeKeys() {
  try {
    const auth = JSON.parse(fs.readFileSync('/root/.hermes/auth.json', 'utf8'));
    const pool = auth.credential_pool?.alibaba || {};
    dashscopeKeys = Object.values(pool).map(c => c.access_token).filter(Boolean);
  } catch {
    dashscopeKeys = [];
  }
}

function llmClassifyBatch(keywords) {
  return new Promise((resolve) => {
    if (dashscopeKeys.length === 0) return resolve(keywords.map(k => 'more'));
    const apiKey = dashscopeKeys[keyIndex++ % dashscopeKeys.length];

    const prompt = `Classify each keyword into exactly ONE category. Categories:
- industrial: machinery, valves, pipes, pumps, cranes, heavy equipment, manufacturing tools
- electronics: circuits, chips, sensors, displays, semiconductors, computers, phones
- materials: metals, plastics, chemicals, adhesives, fabrics, glass, ceramics, raw materials
- automotive: car parts, engines, brakes, tires, vehicle accessories
- home: furniture, decor, lighting, garden, kitchen, bathroom, holiday items
- fashion: clothing, shoes, bags, jewelry, accessories, apparel
- health: medical devices, supplements, fitness equipment, therapy, wellness
- food: food products, beverages, restaurant equipment, packaging, ingredients
- sports: fitness gear, outdoor equipment, balls, water sports, athletic gear
- pets: pet supplies, animal care, aquariums, pet food, pet toys
- more: anything that doesn't fit above (business, office, instruments, toys, books, stationery, quotes, general topics)

Return ONLY JSON array: [{"keyword":"...","category":"..."}]

Keywords:\n${keywords.map((k, i) => `${i + 1}. ${k}`).join('\n')}`;

    const body = JSON.stringify({
      model: 'qwen-plus', messages: [{ role: 'user', content: prompt }],
      temperature: 0.1, max_tokens: 4000,
    });

    const req = https.request(DASHSCOPE_URL, {
      method: 'POST', timeout: 60000,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const content = json.choices?.[0]?.message?.content || '';
          const match = content.match(/\[[\s\S]*\]/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            const map = new Map(parsed.map(p => [p.keyword, p.category]));
            resolve(keywords.map(k => map.get(k) || 'more'));
          } else {
            resolve(keywords.map(() => 'more'));
          }
        } catch { resolve(keywords.map(() => 'more')); }
      });
    });
    req.on('error', () => resolve(keywords.map(() => 'more')));
    req.write(body);
    req.end();
  });
}

// ============ SMARTBUY API ============
function fetchField(keyType, keyword) {
  return new Promise((resolve, reject) => {
    const key = `${keyType}|${keyword}`;
    const url = `${SMARTBUY_BASE}?key=${encodeURIComponent(key)}`;
    const req = https.get(url, { timeout: 30000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data.trim()));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function makeSlug(keyword) {
  return keyword.trim().toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function cleanBody(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<\/?div[^>]*>/gi, '')
    .replace(/\s*class="one-[^"]*"/gi, '');
}

// ============ MAIN ============
(async () => {
  const url = process.env.MYSQL_URL;
  if (!url) { console.error('MYSQL_URL not set'); process.exit(1); }

  const u = new URL(url);
  let conn = await mysql.createConnection({
    host: u.hostname, port: parseInt(u.port || '3306'),
    user: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''), connectTimeout: 10000,
  });

  // Load authors
  const [authors] = await conn.query("SELECT name FROM authors WHERE site = ? AND slug != 'team'", [SITE]);
  if (authors.length === 0) { console.error('No authors found'); process.exit(1); }
  const authorNames = authors.map(a => a.name);

  // Load existing slugs
  const [existing] = await conn.query("SELECT short_title FROM articles WHERE site = ?", [SITE]);
  const done = new Set(existing.map(r => r.short_title));

  // Resume position
  let resumeLine = 0;
  if (fs.existsSync(PROGRESS_FILE)) {
    resumeLine = parseInt(fs.readFileSync(PROGRESS_FILE, 'utf8').trim(), 10) || 0;
  }

  loadDashScopeKeys();

  const stats = {
    total: 0, imported: 0, updated: 0, truncated: 0, skipped: 0, errors: 0,
    heuristic: 0, llm: 0, emptyBody: 0,
    typeCounts: {},
    startTime: Date.now(),
  };

  function logStats() {
    const elapsed = (Date.now() - stats.startTime) / 1000 / 60;
    const rate = stats.imported / Math.max(elapsed, 0.1);
    const remaining = stats.total > 0 ? ((stats.total - stats.imported) / rate / 60).toFixed(1) : '?';
    console.log(
      `[${new Date().toISOString()}] ` +
      `Imported: ${stats.imported} | Updated: ${stats.updated}/${stats.truncated} | Skipped: ${stats.skipped} | Errors: ${stats.errors} | ` +
      `Rate: ${rate.toFixed(1)}/min | ETA: ${remaining}h | ` +
      `Heuristic: ${stats.heuristic} | LLM: ${stats.llm} | Empty: ${stats.emptyBody}`
    );
    console.log(`  IndexNow: ${indexnowSubmitted} submitted, ${indexnowFailed} failed`);
    console.log(`  Types: ${Object.entries(stats.typeCounts).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  }

  // Read keywords as stream
  const KEYWORD_FILE = '/tmp/sw_keywords.txt';
  const rl = readline.createInterface({
    input: fs.createReadStream(KEYWORD_FILE),
    crlfDelay: Infinity,
  });

  let lineNum = 0;
  let batch = [];

  async function processBatch(keywords) {
    // Step 1: Classify
    const heuristicKws = [];
    const heuristicTypes = [];
    const llmKws = [];

    for (const kw of keywords) {
      const type = heuristicClassify(kw);
      if (type) {
        heuristicKws.push(kw);
        heuristicTypes.push(type);
        stats.heuristic++;
      } else {
        llmKws.push(kw);
      }
    }

    let llmTypes = [];
    if (llmKws.length > 0) {
      llmTypes = await llmClassifyBatch(llmKws);
      stats.llm += llmKws.length;
    }

    // Merge: build classified array
    const classified = [];
    let hi = 0, li = 0;
    for (const kw of keywords) {
      if (heuristicKws.includes(kw)) {
        classified.push({ keyword: kw, slug: makeSlug(kw), type: heuristicTypes[hi++] });
      } else {
        classified.push({ keyword: kw, slug: makeSlug(kw), type: llmTypes[li++] || 'more' });
      }
    }

    // Step 2: Filter already done
    const pending = classified.filter(a => !done.has(a.slug));
    const existing = classified.filter(a => done.has(a.slug));
    
    // Check if existing articles have truncated title/description
    if (existing.length > 0) {
      try {
        const slugs = existing.map(a => a.slug);
        const placeholders = slugs.map(() => '?').join(',');
        const [checkRows] = await conn.query(
          `SELECT short_title, LENGTH(title) as title_len, LENGTH(description) as desc_len 
           FROM articles WHERE site = ? AND short_title IN (${placeholders})`,
          [SITE, ...slugs]
        );
        
        const needUpdate = [];
        for (const row of checkRows) {
          if (row.title_len <= 60 || row.desc_len <= 160) {
            const item = existing.find(a => a.slug === row.short_title);
            if (item) needUpdate.push(item);
          }
        }
        
        if (needUpdate.length > 0) {
          stats.truncated += needUpdate.length;
          // Fetch full data and update
          for (let i = 0; i < needUpdate.length; i += CONCURRENCY) {
            const sub = needUpdate.slice(i, i + CONCURRENCY);
            const results = await Promise.allSettled(sub.map(async (a) => {
              const [title, desc] = await Promise.all([
                fetchField('_seo_product_insights_title', a.keyword),
                fetchField('_seo_product_insights_desc', a.keyword),
              ]);
              return { ...a, title, desc };
            }));
            
            for (const r of results) {
              if (r.status === 'fulfilled' && r.value.title && r.value.desc) {
                try {
                  await conn.query(
                    'UPDATE articles SET title = ?, description = ?, modified_time = NOW() WHERE site = ? AND short_title = ?',
                    [r.value.title, r.value.desc, SITE, r.value.slug]
                  );
                  stats.updated++;
                } catch (e) {
                  console.error(`Update error for ${r.value.slug}: ${e.message}`);
                }
              }
            }
            
            if (i + CONCURRENCY < needUpdate.length) {
              await new Promise(r => setTimeout(r, DELAY_MS));
            }
          }
        }
      } catch (e) {
        console.error(`Check truncated error: ${e.message}`);
      }
    }
    
    if (pending.length === 0) {
      stats.skipped += keywords.length;
      return;
    }

    // Step 3: Fetch from SmartBuy + insert (concurrency controlled)
    for (let i = 0; i < pending.length; i += CONCURRENCY) {
      const sub = pending.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(sub.map(async (a) => {
        const [title, desc, body] = await Promise.all([
          fetchField('_seo_product_insights_title', a.keyword),
          fetchField('_seo_product_insights_desc', a.keyword),
          fetchField('_seo_product_insights_content', a.keyword),
        ]);
        return { ...a, title, desc, body };
      }));

      // Prepare batch insert
      const insertValues = [];
      const insertPlaceholders = [];

      for (const r of results) {
        if (r.status !== 'fulfilled' || !r.value.body || r.value.body.length < 100) {
          if (r.status === 'fulfilled' && r.value.body && r.value.body.length < 100) {
            stats.emptyBody++;
          } else {
            stats.errors++;
          }
          continue;
        }

        const { slug, type, title, desc, body } = r.value;
        const cleanHtml = cleanBody(body);
        const author = authorNames[Math.floor(Math.random() * authorNames.length)];

        insertValues.push(SITE, slug, title, cleanHtml, desc, type, author);
        insertPlaceholders.push("(?, ?, ?, ?, ?, ?, 'en', ?, 'Y', NOW(), NOW())");
        stats.typeCounts[type] = (stats.typeCounts[type] || 0) + 1;
        done.add(slug);
        // Collect URL for IndexNow submission
        indexnowBuffer.push(`https://${INDEXNOW_HOST}/${type}/${slug}`);
      }

      if (insertValues.length > 0) {
        const rows = insertValues.length / 7;
        const sql = `INSERT INTO articles (site, short_title, title, body, description, type, language, author, is_online, published_time, modified_time) VALUES ${insertPlaceholders.join(',')} ON DUPLICATE KEY UPDATE title=VALUES(title), body=VALUES(body), description=VALUES(description), type=VALUES(type), author=VALUES(author), modified_time=NOW()`;
        let retries = 3;
        while (retries > 0) {
          try {
            // Check connection health before query
            try { await conn.query('SELECT 1'); } catch { 
              console.log('Reconnecting to MySQL...');
              await conn.end().catch(() => {});
              const u2 = new URL(process.env.MYSQL_URL);
              conn = await mysql.createConnection({
                host: u2.hostname, port: parseInt(u2.port || '3306'),
                user: decodeURIComponent(u2.username), password: decodeURIComponent(u2.password),
                database: u2.pathname.replace(/^\//, ''), connectTimeout: 10000,
              });
            }
            await conn.query(sql, insertValues);
            stats.imported += rows;
            break;
          } catch (e) {
            retries--;
            if (retries > 0) {
              console.log(`DB error (${retries} retries left): ${e.message}`);
              await new Promise(r => setTimeout(r, 2000));
            } else {
              console.error(`DB batch error (no retries): ${e.message}`);
              stats.errors += rows;
              break;
            }
          }
        }
      }

      stats.total += sub.length;

      if (i + CONCURRENCY < pending.length) {
        await new Promise(r => setTimeout(r, DELAY_MS));
      }
    }
  }

  console.log(`\n========== SiteWiseTools Mass Import ==========`);
  console.log(`Existing articles: ${done.size}`);
  console.log(`Resume from line: ${resumeLine}`);
  console.log(`DashScope keys: ${dashscopeKeys.length}`);
  console.log(`Authors: ${authorNames.length}`);
  console.log(`Concurrency: ${CONCURRENCY}, Delay: ${DELAY_MS}ms`);
  console.log(`================================================\n`);

  for await (const line of rl) {
    lineNum++;
    if (lineNum <= resumeLine) continue;

    const kw = line.trim();
    if (!kw) continue;

    batch.push(kw);

    if (batch.length >= CLASSIFY_BATCH) {
      const toProcess = batch.splice(0);
      await processBatch(toProcess);

      // Flush IndexNow buffer
      await flushIndexNow();

      // Save progress
      fs.writeFileSync(PROGRESS_FILE, String(lineNum));

      // Log stats
      if (stats.imported % 100 < CLASSIFY_BATCH) {
        logStats();
      }
    }
  }

  // Process remaining
  if (batch.length > 0) {
    await processBatch(batch);
    await flushIndexNow();
    fs.writeFileSync(PROGRESS_FILE, String(lineNum));
  }

  console.log(`\n========== COMPLETE ==========`);
  logStats();

  // Final verification
  const [rows] = await conn.query(
    "SELECT type, COUNT(*) as cnt FROM articles WHERE site=? AND is_online='Y' GROUP BY type ORDER BY cnt DESC",
    [SITE]
  );
  console.log('\nFinal DB state:');
  rows.forEach(r => console.log(`  ${r.type}: ${r.cnt}`));
  const totalRow = rows.reduce((s, r) => s + Number(r.cnt), 0);
  console.log(`  TOTAL: ${totalRow}`);

  await conn.end();
})().catch(e => { console.error('Fatal:', e); process.exit(1); });
