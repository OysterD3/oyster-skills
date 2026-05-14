#!/usr/bin/env node
// Generates a skill's `assets/shell.html` from its `shell.config.json` and the
// shared template at `_shared/assets/shell.tmpl.html`.
//
// Usage:
//   node skills/_shared/scripts/gen-shell.mjs <skill> [<skill>...]
//   node skills/_shared/scripts/gen-shell.mjs --all
//
// The output is committed alongside the config so the artifact still works
// without re-running the script. Re-run after editing the config or template.

import fs from 'node:fs/promises';
import path from 'node:path';

const SKILLS_DIR = path.resolve(new URL('../../', import.meta.url).pathname);
const TEMPLATE_PATH = path.join(SKILLS_DIR, '_shared', 'assets', 'shell.tmpl.html');

function indent(s, n) {
  const pad = ' '.repeat(n);
  return s.split('\n').map(l => l.length ? pad + l : l).join('\n');
}

function renderSection(s) {
  const cls = s.containerClass ? ` class="${s.containerClass}"` : '';
  const c = s.container || 'div';
  return `<section id="${s.id}">
  <h2>${s.heading} <a class="anchor" href="#${s.id}">#</a></h2>
  <${c}${cls} data-bind-html="${s.bind}"></${c}>
</section>`;
}

async function gen(skill) {
  const configPath = path.join(SKILLS_DIR, skill, 'shell.config.json');
  let config;
  try {
    config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.error(`✗ ${skill}: no shell.config.json — skipping`);
      return;
    }
    throw e;
  }

  const template = await fs.readFile(TEMPLATE_PATH, 'utf8');

  const sections = (config.sections || []).map(renderSection).join('\n\n');
  const extras = (config.extras || [])
    .map(name => `<link rel="stylesheet" href="/__shell/${name}/shell.css">`)
    .join('\n');
  const goalBlock = config.showGoal !== false
    ? `<p class="goal" data-bind="goal"></p>`
    : '';
  const changelogBlock = config.showChangelog !== false
    ? `<details class="changelog-block" open>
  <summary>Changelog</summary>
  <table class="changelog"><tbody id="changelog-rows"></tbody></table>
</details>`
    : '';
  const nextBlock = config.next
    ? `<div class="next">Next: ${config.next}</div>`
    : '';

  const out = template
    .replace('{{TITLE}}', config.title)
    .replace('{{META_LABEL}}', config.metaLabel || config.title)
    .replace('{{EXTRA_STYLESHEETS}}', extras)
    .replace('{{GOAL_BLOCK}}', indent(goalBlock, 6))
    .replace('{{CHANGELOG_BLOCK}}', indent(changelogBlock, 6))
    .replace('{{SECTIONS}}', indent(sections, 4))
    .replace('{{NEXT_BLOCK}}', indent(nextBlock, 6));

  const outPath = path.join(SKILLS_DIR, skill, 'assets', 'shell.html');
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, out);
  console.log(`✓ ${path.relative(process.cwd(), outPath)}`);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('usage: gen-shell.mjs <skill> [<skill>...] | --all');
  process.exit(1);
}

let skills;
if (args[0] === '--all') {
  skills = (await fs.readdir(SKILLS_DIR))
    .filter(d => !d.startsWith('_') && !d.startsWith('.'));
} else {
  skills = args;
}

for (const s of skills) {
  await gen(s);
}
