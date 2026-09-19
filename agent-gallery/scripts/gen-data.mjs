/**
 * 扫描 agency-agents-zh 仓库中的智能体 Markdown 文件，
 * 解析 frontmatter（name/description/emoji/color）+ 正文提示词，
 * 输出 src/data/agents.json 供前端直接使用。
 *
 * 用法：node scripts/gen-data.mjs [仓库路径]
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = process.argv[2]
  || process.env.AGENTS_REPO
  || join(__dirname, '..', '..');
const DATA_DIR = join(__dirname, '..', 'src', 'data');
const INDEX_OUT = join(DATA_DIR, 'index.json');
const PROMPTS_DIR = join(DATA_DIR, 'prompts');

/** id -> 短文件名（不可逆字符全部转成 -，再附 djb2 哈希防碰撞） */
function slugify(id) {
  const base = id.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
  let h = 5381;
  for (const ch of id) h = ((h << 5) + h + ch.charCodeAt(0)) >>> 0;
  return `${base}-${h.toString(36)}`;
}

/** 部门元信息：目录名 -> {中文名, emoji, 排序} */
const CATEGORY_META = {
  company:             { name: '公司经营部', emoji: '🏢', order: 1 },
  engineering:         { name: '工程部',     emoji: '🛠️', order: 2 },
  design:              { name: '设计部',     emoji: '🎨', order: 3 },
  marketing:           { name: '营销部',     emoji: '📢', order: 4 },
  'paid-media':        { name: '付费媒体部', emoji: '💰', order: 5 },
  sales:               { name: '销售部',     emoji: '💼', order: 6 },
  finance:             { name: '金融部',     emoji: '🏦', order: 7 },
  hr:                  { name: '人力资源部', emoji: '👔', order: 8 },
  legal:               { name: '法务部',     emoji: '⚖️', order: 9 },
  'supply-chain':      { name: '供应链部',   emoji: '🚚', order: 10 },
  product:             { name: '产品部',     emoji: '📦', order: 11 },
  'project-management':{ name: '项目管理部', emoji: '📋', order: 12 },
  testing:             { name: '测试部',     emoji: '🧪', order: 13 },
  support:             { name: '支持部',     emoji: '🤝', order: 14 },
  specialized:         { name: '专项部',     emoji: '🔬', order: 15 },
  'spatial-computing': { name: '空间计算部', emoji: '🥽', order: 16 },
  'game-development':  { name: '游戏开发部', emoji: '🎮', order: 17 },
  academic:            { name: '学术部',     emoji: '📖', order: 18 },
  gis:                 { name: 'GIS 部',     emoji: '🗺️', order: 19 },
  security:            { name: '安全部',     emoji: '🛡️', order: 20 },
  strategy:            { name: '战略部',     emoji: '♟️', order: 21 },
  integrations:        { name: '工具集成',   emoji: '🔌', order: 22 }
};

/** 子目录中文名（仅嵌套目录需要） */
const SUBCATEGORY_META = {
  'game-development': { blender: 'Blender', 'unreal-engine': 'Unreal Engine', unity: 'Unity' }
};

/** 命名颜色 -> 十六进制（frontmatter 的 color 字段并不统一） */
const NAMED_COLORS = {
  blue: '#3b82f6', cyan: '#06b6d4', teal: '#14b8a6', green: '#22c55e',
  emerald: '#10b981', lime: '#84cc16', yellow: '#eab308', amber: '#f59e0b',
  orange: '#f97316', red: '#ef4444', crimson: '#dc143c', rose: '#f43f5e',
  pink: '#ec4899', fuchsia: '#d946ef', purple: '#a855f7', violet: '#8b5cf6',
  indigo: '#6366f1', navy: '#1e40af', slate: '#64748b', gray: '#6b7280',
  grey: '#6b7280', gold: '#d4af37', steel: '#708090',
  'metallic-blue': '#3b6ea8', 'neon-green': '#39ff14', 'neon-cyan': '#0ff0fc'
};

const DEFAULT_EMOJIS = ['🤖', '🧠', '⚡', '🎯', '🌟', '🛠️', '💡', '🚀'];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

/**
 * 解析简易 YAML frontmatter。
 * 返回 { meta, body }；不含合法 frontmatter 时返回 null。
 */
function parseFrontmatter(raw) {
  if (!raw.startsWith('---')) return null;
  const close = raw.indexOf('\n---', 3);
  if (close === -1) return null;

  const fmText = raw.slice(3, close);
  let body = raw.slice(close + 4);
  body = body.replace(/^\r?\n+/, '').trimEnd();

  const meta = {};
  let currentKey = null;
  for (const line of fmText.split(/\r?\n/)) {
    if (/^\s/.test(line) && currentKey) {
      // 续行，本项目暂无多行字段，稳妥起见忽略
      continue;
    }
    const idx = line.indexOf(':');
    if (idx === -1) { currentKey = null; continue; }
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    meta[key] = val;
    currentKey = key;
  }
  return { meta, body };
}

function normalizeColor(color, seed) {
  if (!color) {
    // 按名称字符稳定挑一个默认色
    const h = [...seed].reduce((s, c) => s + c.charCodeAt(0), 0);
    return NAMED_COLORS[['blue', 'green', 'orange', 'purple', 'teal', 'red', 'indigo', 'cyan'][h % 8]];
  }
  const c = color.trim().toLowerCase();
  if (NAMED_COLORS[c]) return NAMED_COLORS[c];
  if (/^#[0-9a-f]{3,8}$/.test(c)) return c;
  if (/^rgb/.test(c)) return c;
  return NAMED_COLORS.blue;
}

function normalizeEmoji(emoji, name) {
  if (emoji && emoji.trim()) return emoji.trim();
  const h = [...name].reduce((s, c) => s + c.charCodeAt(0), 0);
  return DEFAULT_EMOJIS[h % DEFAULT_EMOJIS.length];
}

/* ---------------- 主流程 ---------------- */

if (!existsSync(ROOT)) {
  console.error(`✗ 仓库路径不存在: ${ROOT}`);
  process.exit(1);
}

const files = walk(ROOT);
const agents = [];
const countByCategory = {};

for (const file of files) {
  const rel = relative(ROOT, file).split(sep).join('/');
  const raw = readFileSync(file, 'utf8');
  const parsed = parseFrontmatter(raw);
  if (!parsed) continue;

  const { meta, body } = parsed;
  // 只有带 name 的才视为智能体（排除 README、playbook 等文档）
  if (!meta.name) continue;

  const parts = rel.split('/');
  const category = parts[0];
  const subCategory = parts.length > 2 ? parts[1] : null;
  const id = rel.replace(/\.md$/, '');

  const catMeta = CATEGORY_META[category] || { name: category, emoji: '📁', order: 99 };
  const subName = subCategory
    ? (SUBCATEGORY_META[category]?.[subCategory] || subCategory)
    : null;

  const agent = {
    id,
    slug: slugify(id),
    path: rel,
    name: meta.name,
    description: meta.description || '',
    emoji: normalizeEmoji(meta.emoji, meta.name),
    color: normalizeColor(meta.color, meta.name),
    category,
    categoryName: catMeta.name,
    categoryEmoji: catMeta.emoji,
    subCategory: subName
  };
  agents.push({ meta: agent, content: body });
  countByCategory[category] = (countByCategory[category] || 0) + 1;
}

agents.sort((a, b) => {
  const oa = CATEGORY_META[a.meta.category]?.order ?? 99;
  const ob = CATEGORY_META[b.meta.category]?.order ?? 99;
  if (oa !== ob) return oa - ob;
  return a.meta.id.localeCompare(b.meta.id, 'zh-Hans-CN');
});

// 清空旧的 prompts 产物，避免删除智能体后残留
rmSync(PROMPTS_DIR, { recursive: true, force: true });
mkdirSync(PROMPTS_DIR, { recursive: true });

const usedSlugs = new Set();
const indexAgents = [];
for (const { meta: agent, content } of agents) {
  if (usedSlugs.has(agent.slug)) throw new Error(`slug 碰撞: ${agent.id} -> ${agent.slug}`);
  usedSlugs.add(agent.slug);
  writeFileSync(
    join(PROMPTS_DIR, `${agent.slug}.json`),
    JSON.stringify({ id: agent.id, content }),
    'utf8'
  );
  const { ...metaOnly } = agent;
  indexAgents.push(metaOnly);
}

const categories = Object.entries(countByCategory)
  .map(([id, count]) => ({
    id,
    name: CATEGORY_META[id]?.name || id,
    emoji: CATEGORY_META[id]?.emoji || '📁',
    order: CATEGORY_META[id]?.order ?? 99,
    count
  }))
  .sort((a, b) => a.order - b.order);

const data = {
  generatedAt: new Date().toISOString(),
  source: relative(process.cwd(), ROOT) || ROOT,
  total: indexAgents.length,
  categories,
  agents: indexAgents
};

mkdirSync(DATA_DIR, { recursive: true });
writeFileSync(INDEX_OUT, JSON.stringify(data, null, 0), 'utf8');
// 旧版单文件产物若存在则删除
rmSync(join(DATA_DIR, 'agents.json'), { force: true });

console.log(`✓ 已生成 ${INDEX_OUT}`);
console.log(`  提示词分片: ${PROMPTS_DIR} (${indexAgents.length} 个)`);
console.log(`  智能体: ${indexAgents.length} 个 | 分类: ${categories.length} 个`);
for (const c of categories) console.log(`  ${c.emoji} ${c.name}: ${c.count}`);
