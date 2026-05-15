#!/usr/bin/env node
// Bakes a self-contained review artifact HTML from a content JSON.
//
// Inputs (resolved relative to this script's install location):
//   skills/<skill>/shell.config.json          — section structure for this skill
//   skills/_shared/assets/shell.tmpl.html     — HTML scaffold with {{...}} placeholders
//   skills/_shared/assets/shell.css           — inlined as <style>
//   skills/_shared/assets/shell.js            — inlined as <script type="module">
//
// Project-local input:
//   <content-json-path>                       — the data
//
// Output (next to the content JSON):
//   <slug>.html                               — single-file artifact, opens in any
//                                                browser with internet (CDN: mermaid + hljs)
//
// Usage:
//   node gen-artifact.mjs <skill> <content-json-path>
//
// Example:
//   node ~/.claude/skills/_shared/scripts/gen-artifact.mjs brainstorming \
//     docs/brainstorming/2026-05-14-feature.content.json

import fs from 'node:fs/promises';
import path from 'node:path';

const SKILLS_DIR = path.resolve(new URL('../../', import.meta.url).pathname);

function indent(s, n) {
  const pad = ' '.repeat(n);
  return s.split('\n').map(l => l.length ? pad + l : l).join('\n');
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}

function renderSection(s, content) {
  const cls = s.containerClass ? ` class="${s.containerClass}"` : '';
  const c = s.container || 'div';
  const body = content[s.bind] ?? '';
  return `<section id="${s.id}">
  <h2>${s.heading} <a class="anchor" href="#${s.id}">#</a></h2>
  <${c}${cls}>${body}</${c}>
</section>`;
}

function renderChangelogRows(changelog) {
  if (!Array.isArray(changelog) || !changelog.length) return '';
  return changelog
    .map(row => `<tr><td><time>${esc(row.ts || '')}</time></td><td>${esc(row.note || '')}</td></tr>`)
    .join('\n          ');
}

async function readJson(p) {
  return JSON.parse(await fs.readFile(p, 'utf8'));
}

async function main(skill, contentJsonPath) {
  if (!/^[a-z0-9_-]+$/i.test(skill)) throw new Error(`invalid skill name: ${skill}`);
  const absContent = path.resolve(contentJsonPath);
  if (!absContent.endsWith('.content.json')) {
    throw new Error('content path must end in .content.json');
  }

  const config = await readJson(path.join(SKILLS_DIR, skill, 'shell.config.json'));
  const template = await fs.readFile(path.join(SKILLS_DIR, '_shared', 'assets', 'shell.tmpl.html'), 'utf8');
  const css = await fs.readFile(path.join(SKILLS_DIR, '_shared', 'assets', 'shell.css'), 'utf8');
  const js = await fs.readFile(path.join(SKILLS_DIR, '_shared', 'assets', 'shell.js'), 'utf8');
  const content = await readJson(absContent);

  const titleBase = config.title || 'Review';
  const titleData = content.title || '';
  const documentTitle = titleData ? `${titleData} — ${titleBase}` : titleBase;

  const sections = (config.sections || []).map(s => renderSection(s, content)).join('\n\n');

  const goalBlock = config.showGoal !== false && content.goal
    ? `<p class="goal">${esc(content.goal)}</p>`
    : '';

  const changelogRows = renderChangelogRows(content.changelog);
  const changelogBlock = config.showChangelog !== false && changelogRows
    ? `<details class="changelog-block" open>
        <summary>Changelog</summary>
        <table class="changelog"><tbody>
          ${changelogRows}
        </tbody></table>
      </details>`
    : '';

  const nextBlock = config.next
    ? `<div class="next">Next: ${esc(config.next)}</div>`
    : '';

  const out = template
    .replace('{{DOCUMENT_TITLE}}', esc(documentTitle))
    .replace('{{META_LABEL}}', esc(config.metaLabel || titleBase))
    .replace('{{DATE}}', esc(content.date || ''))
    .replace('{{TITLE_VALUE}}', esc(titleData))
    .replace('{{INLINE_STYLE}}', css)
    .replace('{{INLINE_SCRIPT}}', js)
    .replace('{{SECTIONS}}', indent(sections, 4))
    .replace('{{GOAL_BLOCK}}', indent(goalBlock, 6))
    .replace('{{CHANGELOG_BLOCK}}', indent(changelogBlock, 6))
    .replace('{{NEXT_BLOCK}}', indent(nextBlock, 6));

  const outPath = absContent.replace(/\.content\.json$/, '.html');
  await fs.writeFile(outPath, out);
  console.log(`✓ ${path.relative(process.cwd(), outPath)}`);
}

const [skill, contentJsonPath] = process.argv.slice(2);
if (!skill || !contentJsonPath) {
  console.error('usage: gen-artifact.mjs <skill> <content-json-path>');
  process.exit(1);
}

await main(skill, contentJsonPath);
