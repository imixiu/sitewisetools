import * as mysql from "mysql2/promise";

export interface Article {
  id: number;
  site: string | null;
  type: string | null;
  short_title: string | null;
  language: string | null;
  published_time: string | null;
  modified_time: string | null;
  author: string | null;
  img: string | null;
  title: string | null;
  description: string | null;
  url: string | null;
  body: string | null;
  tag: string | null;
  is_online: string | null;
}

export interface Author {
  id: number;
  site: string | null;
  name: string | null;
  slug: string | null;
  img: string | null;
  description: string | null;
  language: string | null;
}

function getConnectionConfig() {
  const url = process.env.MYSQL_URL;
  if (!url) throw new Error("MYSQL_URL is not set");
  const u = new URL(url);
  return {
    host: u.hostname,
    port: parseInt(u.port || "3306"),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ""),
    connectTimeout: 10000,
    disableEval: true,
  };
}

export async function q(text: string, params: unknown[] = []): Promise<any[]> {
  const conn = await mysql.createConnection(getConnectionConfig());
  try {
    const [rows] = await conn.query(text, params);
    if (Array.isArray(rows)) return rows.map((row: any) => ({ ...row }));
    return [rows];
  } finally {
    await conn.end();
  }
}

export const SITE = "sitewisetools";

export async function getArticleBySlug(type: string, slug: string): Promise<Article | null> {
  const rows = await q(
    "SELECT * FROM articles WHERE site = ? AND short_title = ? AND is_online = 'Y' LIMIT 1",
    [SITE, slug]
  );
  return (rows[0] as Article) ?? null;
}

export async function getAllArticles(): Promise<Article[]> {
  return q(
    "SELECT id, site, type, short_title, language, published_time, modified_time, author, img, title, description, url FROM articles WHERE site = ? AND is_online = 'Y' ORDER BY published_time DESC, id DESC",
    [SITE]
  ) as Promise<Article[]>;
}

export async function getRelatedArticles(currentId: number, type: string, limit: number = 10): Promise<Article[]> {
  const candidates = await q(
    "SELECT id FROM articles WHERE site = ? AND type = ? AND id != ? AND is_online = 'Y' LIMIT 500",
    [SITE, type, currentId]
  );
  if (candidates.length === 0) return [];
  const ids = candidates.map((row: any) => row.id);
  for (let i = ids.length - 1; i > 0 && ids.length > limit; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const selectedIds = ids.slice(0, limit);
  const placeholders = selectedIds.map(() => '?').join(',');
  return q(
    "SELECT id, site, type, short_title, title, img FROM articles WHERE id IN (" + placeholders + ")",
    selectedIds
  ) as Promise<Article[]>;
}

export async function getArticlesByType(type: string): Promise<Article[]> {
  return q(
    "SELECT id, site, type, short_title, language, published_time, modified_time, author, img, title, description, url FROM articles WHERE site = ? AND type = ? AND is_online = 'Y' ORDER BY published_time DESC, id DESC",
    [SITE, type]
  ) as Promise<Article[]>;
}

export async function getArticlesByTypePaged(
  type: string,
  page: number,
  pageSize: number
): Promise<{ articles: Article[]; total: number }> {
  const offset = (page - 1) * pageSize;
  const [countRows, rows] = await Promise.all([
    q("SELECT COUNT(*) AS total FROM articles WHERE site = ? AND type = ? AND is_online = 'Y'", [SITE, type]),
    q(
      "SELECT id, site, type, short_title, language, published_time, modified_time, author, img, title, description, url FROM articles WHERE site = ? AND type = ? AND is_online = 'Y' ORDER BY published_time DESC, id DESC LIMIT ? OFFSET ?",
      [SITE, type, pageSize, offset]
    ),
  ]);
  return { articles: rows as Article[], total: Number(countRows[0]?.total ?? 0) };
}

export async function getAuthorBySlug(slug: string): Promise<Author | null> {
  const rows = await q("SELECT * FROM authors WHERE site = ? AND slug = ? LIMIT 1", [SITE, slug]);
  return (rows[0] as Author) ?? null;
}

export async function getAllAuthors(): Promise<Author[]> {
  return q("SELECT * FROM authors WHERE site = ? ORDER BY id", [SITE]) as Promise<Author[]>;
}

export async function upsertAuthor(input: {
  name: string;
  slug: string;
  img?: string | null;
  description?: string | null;
  language?: string | null;
}): Promise<Author> {
  const { name, slug, img = null, description = null, language = null } = input;
  const existing = await q("SELECT id FROM authors WHERE site = ? AND slug = ? LIMIT 1", [SITE, slug]);
  if (existing[0]) {
    await q(
      "UPDATE authors SET name = ?, img = ?, description = ?, language = ? WHERE site = ? AND slug = ?",
      [name, img, description, language, SITE, slug]
    );
    const rows = await q("SELECT * FROM authors WHERE site = ? AND slug = ? LIMIT 1", [SITE, slug]);
    return rows[0] as Author;
  }
  await q(
    "INSERT INTO authors (site, name, slug, img, description, language) VALUES (?, ?, ?, ?, ?, ?)",
    [SITE, name, slug, img, description, language]
  );
  const rows = await q("SELECT * FROM authors WHERE site = ? AND slug = ? LIMIT 1", [SITE, slug]);
  return rows[0] as Author;
}

export async function upsertArticle(input: {
  short_title: string;
  title: string;
  body: string;
  description?: string | null;
  type?: string | null;
  language?: string | null;
  author?: string | null;
  img?: string | null;
  url?: string | null;
  published_time?: string | null;
  tag?: string | null;
  is_online?: string;
}): Promise<Article> {
  const {
    short_title, title, body,
    description = null, type = null, language = null,
    author = null, img = null, url = null,
    published_time = null, tag = null, is_online = "Y",
  } = input;
  const existing = await q("SELECT id FROM articles WHERE site = ? AND short_title = ? LIMIT 1", [SITE, short_title]);
  if (existing[0]) {
    await q(
      "UPDATE articles SET title=?, body=?, description=?, type=?, language=?, author=?, img=?, url=?, published_time=?, tag=?, is_online=?, modified_time=NOW() WHERE site=? AND short_title=?",
      [title, body, description, type, language, author, img, url, published_time, tag, is_online, SITE, short_title]
    );
    const rows = await q("SELECT * FROM articles WHERE site = ? AND short_title = ? LIMIT 1", [SITE, short_title]);
    return rows[0] as Article;
  }
  await q(
    "INSERT INTO articles (site, short_title, title, body, description, type, language, author, img, url, published_time, modified_time, tag, is_online) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [SITE, short_title, title, body, description, type, language, author, img, url, published_time, new Date(), tag, is_online]
  );
  const rows = await q("SELECT * FROM articles WHERE site = ? AND short_title = ? LIMIT 1", [SITE, short_title]);
  return rows[0] as Article;
}
