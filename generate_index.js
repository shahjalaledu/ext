const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const TEMPLATE = path.join(ROOT, "template.html");
const OUTPUT = path.join(ROOT, "index.html");

// Files to ignore from the article index
const IGNORE_BASENAMES = new Set([
  "index.html",     // generated homepage
  "template.html",
]);

// Directories to skip scanning
const SKIP_DIRS = new Set([
  ".git",
  ".github",
  "node_modules"
]);

function listHtmlFiles(rootDir) {
  const results = [];

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(rootDir, full);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(full);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) {
        if (!IGNORE_BASENAMES.has(entry.name)) {
          results.push(rel.replace(/\\/g, "/"));
        }
      }
    }
  }

  walk(rootDir);
  return results.sort();
}

function buildArticleList(files) {
  const lines = [];
  lines.push('<ul class="article-list">');

  if (files.length === 0) {
    lines.push('<li class="article-item"><span class="article-link">No articles found yet.</span></li>');
  } else {
    for (const file of files) {
      const name = path.basename(file);
      lines.push(
        `<li class="article-item">` +
          `<a href="#" class="article-link" data-path="${file}">${name}</a>` +
        `</li>`
      );
    }
  }

  lines.push("</ul>");
  return lines.join("\n");
}

function generateIndex() {
  if (!fs.existsSync(TEMPLATE)) {
    console.error("template.html not found");
    process.exit(1);
  }

  const template = fs.readFileSync(TEMPLATE, "utf8");
  const files = listHtmlFiles(ROOT);
  const listHtml = buildArticleList(files);

  const markerStart = "<!-- ARTICLE_INDEX_START -->";
  const markerEnd = "<!-- ARTICLE_INDEX_END -->";

  const startIdx = template.indexOf(markerStart);
  const endIdx = template.indexOf(markerEnd);

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    console.error("Markers ARTICLE_INDEX_START / ARTICLE_INDEX_END not found or misordered in template.html");
    process.exit(1);
  }

  const before = template.slice(0, startIdx + markerStart.length);
  const after = template.slice(endIdx);

  const output = `${before}\n${listHtml}\n${after}`;
  fs.writeFileSync(OUTPUT, output, "utf8");
  console.log("index.html generated with", files.length, "article(s).");
}

generateIndex();
