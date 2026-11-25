#!/usr/bin/env node
/**
 * Version HTML LOCALE d'un rapport markdown de recette, pour le lire plus confortablement.
 *
 * Usage : node scripts/md-to-html.mjs outputs/reports/<scope>/<rapport>.md [--open]
 *   - écrit `<rapport>.html` à côté du `.md` (dossier outputs/reports/ uniquement : refus ailleurs) ;
 *   - n'ajoute AUCUNE donnée au rapport ; aucun réseau, aucune dépendance, feuille de style en ligne ;
 *   - TOUT le texte est échappé (un rapport peut citer du contenu de page : jamais de HTML ni de script interprété) ;
 *   - `--open` ouvre le fichier dans le navigateur par défaut (xdg-open / open) : à n'utiliser qu'APRÈS l'accord de l'utilisateur.
 * Jamais d'Artifact ni d'hébergement : le fichier reste dans outputs/ (gitignoré).
 *
 * Markdown pris en charge : titres, tableaux, listes (imbriquées par indentation, cases à cocher), blocs de code, citations,
 * séparateurs, gras, italique, code en ligne, liens http(s) et relatifs. Les emojis passent tels quels (UTF-8).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Mise en forme en ligne, sur du texte DÉJÀ échappé par morceaux (le code en ligne est mis à l'abri d'abord). */
export function inline(text) {
  const codes = [];
  let t = text.replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(esc(c)) - 1}\u0000`);
  t = esc(t);
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, href) => {
    const raw = href.replace(/&amp;/g, '&');
    const safe = /^https?:\/\//i.test(raw) || !/^[a-z][a-z0-9+.-]*:/i.test(raw); // jamais javascript:, data:...
    return safe
      ? `<a href="${href}">${label}</a>` : label;
  });
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=$|[\s).,;:])/g, '$1<em>$2</em>');
  return t.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[Number(i)]}</code>`);
}

const splitRow = (line) => {
  const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
  return cells;
};
const isSep = (line) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);
const listItem = (line) => line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);

export function markdownToHtml(md) {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;

  function renderList(startIndent) {
    const first = listItem(lines[i]);
    const ordered = /\d/.test(first[2]);
    const parts = [`<${ordered ? 'ol' : 'ul'}>`];
    while (i < lines.length) {
      const m = listItem(lines[i]);
      if (!m || m[1].length < startIndent) break;
      if (m[1].length > startIndent) { parts.push(renderList(m[1].length)); continue; }
      let body = m[3];
      const box = body.match(/^\[( |x|X)\]\s+(.*)$/);
      if (box) body = `<input type="checkbox" disabled${box[1] === ' ' ? '' : ' checked'}> ${inline(box[2])}`;
      else body = inline(body);
      parts.push(`<li>${body}</li>`);
      i += 1;
    }
    parts.push(`</${ordered ? 'ol' : 'ul'}>`);
    return parts.join('\n');
  }

  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(/^(\s*)(`{3,}|~{3,})(.*)$/);
    if (fence) {
      const buf = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith(fence[2])) { buf.push(lines[i]); i += 1; }
      i += 1;
      out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`);
    } else if (/^\s*$/.test(line)) {
      i += 1;
    } else if (/^#{1,6}\s/.test(line)) {
      const level = line.match(/^#+/)[0].length;
      out.push(`<h${level}>${inline(line.replace(/^#+\s+/, '').replace(/\s+#+\s*$/, ''))}</h${level}>`);
      i += 1;
    } else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      out.push('<hr>');
      i += 1;
    } else if (line.trim().startsWith('|') && i + 1 < lines.length && isSep(lines[i + 1])) {
      const head = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(splitRow(lines[i])); i += 1; }
      out.push(`<div class="table-wrap"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
    } else if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i += 1; }
      out.push(`<blockquote>${buf.map(inline).join('<br>')}</blockquote>`);
    } else if (listItem(line)) {
      out.push(renderList(listItem(line)[1].length));
    } else {
      const buf = [];
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^#{1,6}\s/.test(lines[i]) && !listItem(lines[i]) && !/^(\s*)(`{3,}|~{3,})/.test(lines[i]) && !/^\s*>/.test(lines[i]) && !lines[i].trim().startsWith('|')) { buf.push(lines[i]); i += 1; }
      if (!buf.length) { buf.push(lines[i]); i += 1; }
      out.push(`<p>${buf.map(inline).join('<br>')}</p>`);
    }
  }
  return out.join('\n');
}

const STYLE = `
:root{color-scheme:light dark;--bg:#fff;--fg:#1d2733;--muted:#5b6b7b;--line:#d6dde4;--head:#eef3f7;--code:#f3f5f7;--accent:#0b5c8a}
@media (prefers-color-scheme:dark){:root{--bg:#14191f;--fg:#e4e9ee;--muted:#9aa8b6;--line:#2b3641;--head:#1c242d;--code:#1c242d;--accent:#6bb7e6}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1040px;margin:0 auto;padding:24px 20px 64px}
h1{font-size:1.8rem;border-bottom:2px solid var(--line);padding-bottom:.3em}h2{font-size:1.4rem;margin-top:2em;border-bottom:1px solid var(--line);padding-bottom:.2em}h3{font-size:1.15rem;margin-top:1.6em}
a{color:var(--accent)}hr{border:0;border-top:1px solid var(--line);margin:2em 0}
.table-wrap{overflow-x:auto;margin:1em 0}table{border-collapse:collapse;width:100%;font-size:.95rem}
th,td{border:1px solid var(--line);padding:6px 10px;text-align:left;vertical-align:top}th{background:var(--head)}tbody tr:nth-child(even){background:var(--head)}
code{background:var(--code);padding:.1em .35em;border-radius:4px;font:.9em ui-monospace,SFMono-Regular,Menlo,monospace}
pre{background:var(--code);padding:12px 14px;border-radius:6px;overflow-x:auto}pre code{background:none;padding:0}
blockquote{margin:1em 0;padding:.4em 1em;border-left:4px solid var(--accent);background:var(--head);color:var(--muted)}
li{margin:.15em 0}
@media print{main{max-width:none}}
`;

export function htmlPage(title, body) {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(title)}</title><style>${STYLE}</style></head>
<body><main>
${body}
</main></body></html>
`;
}

function main() {
  const args = process.argv.slice(2);
  const open = args.includes('--open');
  const input = args.find((a) => !a.startsWith('--'));
  if (!input) { console.error('Usage : node scripts/md-to-html.mjs outputs/reports/<scope>/<rapport>.md [--open]'); process.exit(1); }

  const abs = path.resolve(input);
  const reportsDir = path.resolve('outputs/reports') + path.sep;
  if (!abs.startsWith(reportsDir) || !abs.endsWith('.md')) {
    console.error('Refusé : seuls les rapports markdown de outputs/reports/ sont convertis (le HTML reste local, à côté du .md).');
    process.exit(1);
  }
  let md;
  try { md = readFileSync(abs, 'utf8'); } catch { console.error('Rapport introuvable ou illisible.'); process.exit(1); }

  const title = (md.match(/^#\s+(.+)$/m) || [null, 'Rapport de recette'])[1].replace(/[`*_]/g, '');
  const outPath = abs.replace(/\.md$/, '.html');
  writeFileSync(outPath, htmlPage(title, markdownToHtml(md)), 'utf8');
  console.log(`OK — version HTML locale : ${path.relative(process.cwd(), outPath)}`);

  if (open) {
    const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open';
    execFile(opener, [outPath], (err) => { if (err) console.error('Ouverture automatique impossible : ouvrir le fichier à la main.'); });
  }
}

import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
