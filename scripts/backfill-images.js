#!/usr/bin/env node
/**
 * machinistpick image backfill — multi-key Qwen image gen + CDN upload
 * Usage: node scripts/backfill-images.js [--shard N --total-shards M]
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// ── Config ──
const SITE = 'sitewisetools';
const SITE_TOPIC = 'professional tools, machinery, and industrial equipment';
const CONCURRENCY = parseInt(process.env.IMG_CONCURRENCY || '8');
const BATCH_SIZE = 50;
const MAX_RETRIES = 4;
const RETRY_DELAY_MS = 3000;
const INTER_BATCH_DELAY_MS = 500;
const QWEN_API = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
const CDN_API = 'https://ranking.alibaba.com/verticalSite/image2cdn.json';
const CDN_TOKEN = 'alibaba-icbu-seo-image-to-alicdn-verify';

// ── Multi-key setup ──
let dashscopeKeys = [];
try {
  const auth = JSON.parse(fs.readFileSync('/root/.hermes/auth.json', 'utf8'));
  const pool = auth.credential_pool?.alibaba || [];
  dashscopeKeys = Array.isArray(pool) ? pool.map(c => c.access_token).filter(Boolean) : [];
} catch {}
if (dashscopeKeys.length === 0) {
  console.error('No DashScope keys found!');
  process.exit(1);
}
let keyIndex = 0;
function nextKey() { return dashscopeKeys[keyIndex++ % dashscopeKeys.length]; }

// ── Parse args ──
const args = process.argv.slice(2);
let SHARD = 0, TOTAL_SHARDS = 1;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--shard') SHARD = parseInt(args[++i]);
  if (args[i] === '--total-shards') TOTAL_SHARDS = parseInt(args[++i]);
}
const CHECKPOINT_FILE = `/tmp/${SITE}_img_checkpoint_s${SHARD}.json`;

// ── Stats ──
let stats = { success: 0, failed: 0, cdnFail: 0, genFail: 0, start: Date.now() };

// ── Checkpoint ──
function loadCheckpoint() {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
  } catch {}
  return { lastId: 0 };
}
function saveCheckpoint(lastId) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify({ lastId }));
}

// ── Qwen Image Generation with retry + key rotation ──
async function generateImage(title, articleType) {
  const prompt = `Professional editorial photography for a ${SITE_TOPIC} article.\n` +
    `Category: ${articleType}.\n` +
    `Article title: "${title}"\n` +
    `Style: high quality, vivid colors, clean modern composition, natural lighting. No text, no watermark, no overlay.`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const apiKey = nextKey();
    try {
      const resp = await fetch(QWEN_API, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'qwen-image-plus',
          input: { messages: [{ role: 'user', content: [{ text: prompt }] }] },
          parameters: { size: '1024*576' }
        }),
        signal: AbortSignal.timeout(120000),
      });
      const data = await resp.json();
      if (data?.code === 'Throttling.RateQuota' || data?.code === 'Throttling') {
        if (attempt < MAX_RETRIES) {
          const delay = RETRY_DELAY_MS * Math.pow(1.5, attempt) + Math.random() * 2000;
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw new Error(`RateQuota after ${MAX_RETRIES} retries`);
      }
      const ossUrl = data?.output?.choices?.[0]?.message?.content?.[0]?.image;
      if (!ossUrl) throw new Error(`No image: ${JSON.stringify(data).substring(0, 150)}`);
      return ossUrl;
    } catch (e) {
      if (attempt === MAX_RETRIES) throw e;
      if (!e.message.includes('RateQuota') && !e.message.includes('Throttling')) throw e;
      const delay = RETRY_DELAY_MS * Math.pow(1.5, attempt) + Math.random() * 2000;
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// ── CDN Transfer ──
async function transferToCdn(ossUrl) {
  const encoded = encodeURIComponent(ossUrl);
  const url = `${CDN_API}?url=${encoded}&token=${CDN_TOKEN}`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(60000) });
  const data = await resp.json();
  if (data?.code !== 200) throw new Error(`CDN error: ${JSON.stringify(data).substring(0, 100)}`);
  return data.cdn_url;
}

// ── Process one article ──
async function processArticle(article) {
  try {
    const ossUrl = await generateImage(article.title, article.type);
    const cdnUrl = await transferToCdn(ossUrl);
    return { id: article.id, img: cdnUrl, ok: true };
  } catch (e) {
    const isRateLimit = e.message.includes('RateQuota') || e.message.includes('Throttling');
    if (isRateLimit) stats.genFail++;
    else if (e.message.includes('CDN')) stats.cdnFail++;
    else stats.genFail++;
    return { id: article.id, ok: false, error: e.message.substring(0, 80) };
  }
}

// ── Main ──
async function main() {
  const u = new URL(process.env.MYSQL_URL);
  const pool = await mysql.createPool({
    host: u.hostname,
    port: parseInt(u.port || '3306'),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
    connectTimeout: 15000,
    waitForConnections: true,
    connectionLimit: 5,
    charset: 'utf8mb4',
  });

  const [cntRows] = await pool.query(
    "SELECT COUNT(*) as cnt FROM articles WHERE site=? AND (img IS NULL OR img = '')",
    [SITE]
  );
  const total = cntRows[0].cnt;
  const checkpoint = loadCheckpoint();
  let lastId = checkpoint.lastId;

  console.log(`═══════════════════════════════════════════════`);
  console.log(`  ${SITE} image backfill`);
  console.log(`═══════════════════════════════════════════════`);
  console.log(`  Total without images: ${total.toLocaleString()}`);
  console.log(`  Resume from ID:       ${lastId}`);
  console.log(`  Concurrency:          ${CONCURRENCY}`);
  console.log(`  DashScope keys:       ${dashscopeKeys.length}`);
  console.log(`  Shard:                ${SHARD}/${TOTAL_SHARDS}`);
  console.log(`═══════════════════════════════════════════════\n`);

  if (total === 0) {
    console.log('All articles already have images!');
    await pool.end();
    return;
  }

  let processed = 0;
  let running = true;

  process.on('SIGINT', () => { console.log('\n⚠️  SIGINT, finishing...'); running = false; });
  process.on('SIGTERM', () => { console.log('\n⚠️  SIGTERM, finishing...'); running = false; });

  while (running) {
    let query, params;
    if (TOTAL_SHARDS > 1) {
      query = "SELECT id, title, type FROM articles WHERE site=? AND (img IS NULL OR img = '') AND id > ? AND MOD(id, ?) = ? ORDER BY id LIMIT ?";
      params = [SITE, lastId, TOTAL_SHARDS, SHARD, BATCH_SIZE];
    } else {
      query = "SELECT id, title, type FROM articles WHERE site=? AND (img IS NULL OR img = '') AND id > ? ORDER BY id LIMIT ?";
      params = [SITE, lastId, BATCH_SIZE];
    }

    const [batch] = await pool.query(query, params);
    if (batch.length === 0) {
      console.log('\n✅ All articles processed!');
      break;
    }

    // Process with concurrency limit
    const results = [];
    for (let i = 0; i < batch.length; i += CONCURRENCY) {
      const chunk = batch.slice(i, i + CONCURRENCY);
      const chunkResults = await Promise.all(chunk.map(a => processArticle(a)));
      results.push(...chunkResults);
    }

    const updates = results.filter(r => r && r.ok);
    const failures = results.filter(r => r && !r.ok);

    // Batch DB update
    if (updates.length > 0) {
      const whenClauses = updates.map(u => `WHEN ${u.id} THEN ?`).join(' ');
      const idList = updates.map(u => u.id).join(',');
      const updateParams = updates.map(u => u.img);
      try {
        await pool.query(
          `UPDATE articles SET img = CASE id ${whenClauses} END WHERE id IN (${idList})`,
          updateParams
        );
      } catch (e) {
        for (const u of updates) {
          try { await pool.query('UPDATE articles SET img = ? WHERE id = ?', [u.img, u.id]); }
          catch (e2) { console.log(`  ❌ DB update failed ID ${u.id}: ${e2.message.substring(0, 50)}`); }
        }
      }
    }

    stats.success += updates.length;
    stats.failed += failures.length;
    processed += batch.length;
    lastId = batch[batch.length - 1].id;

    const elapsed = (Date.now() - stats.start) / 1000;
    const rate = stats.success / elapsed;
    const etaH = rate > 0 ? ((total - stats.success - stats.failed) / rate / 3600) : 0;

    console.log(
      `[${processed}/${total}] ✓${stats.success} ✗${stats.failed} (gen:${stats.genFail} cdn:${stats.cdnFail}) ` +
      `${rate.toFixed(1)}/s ETA:${etaH.toFixed(1)}h | lastId:${lastId}`
    );

    for (const f of failures.slice(0, 2)) {
      console.log(`  ❌ ID:${f.id} ${f.error}`);
    }

    saveCheckpoint(lastId);
    await new Promise(r => setTimeout(r, INTER_BATCH_DELAY_MS));
  }

  const elapsed = (Date.now() - stats.start) / 1000;
  console.log(`\n═══════════════════════════════════════════════`);
  console.log(`  Complete! Success: ${stats.success}, Failed: ${stats.failed}`);
  console.log(`  Time: ${(elapsed/3600).toFixed(1)}h, Rate: ${(stats.success/elapsed).toFixed(1)} img/s`);
  console.log(`═══════════════════════════════════════════════`);
  await pool.end();
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
