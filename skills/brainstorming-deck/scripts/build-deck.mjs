#!/usr/bin/env node
// Bake a 5-slide stakeholder PowerPoint from a brainstorming content JSON.
//
// Usage:
//   node build-deck.mjs <content.json> [output.pptx]
//
// If output.pptx is omitted, writes alongside the input with the same slug.

import fs from 'node:fs/promises';
import path from 'node:path';
import pptxgen from 'pptxgenjs';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import sharp from 'sharp';

const rifa = await import('react-icons/fa');
const { FaLightbulb, FaCheck, FaExclamationTriangle } = rifa;

// ─── palette ───────────────────────────────────────────────────────────────
const C = {
  navy:    '1A2761',
  navyDk:  '0E1A4E',
  teal:    '0F9FA4',
  amber:   'E89B2C',
  cream:   'FAF9F6',
  ink:     '1A2761',
  body:    '5B6470',
  rule:    'D8DCE3',
  white:   'FFFFFF',
  danger:  '991B1B',
};

const FONT_HEAD  = 'Georgia';
const FONT_LABEL = 'Calibri';
const FONT_BODY  = 'Calibri';

// ─── helpers ───────────────────────────────────────────────────────────────
async function iconPng(Component, color = '#FFFFFF', size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(Component, { color, size: String(size) }),
  );
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return 'image/png;base64,' + png.toString('base64');
}

function htmlToPlain(html) {
  return String(html ?? '')
    .replace(/<\/?(?:strong|b|em|i|code)[^>]*>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseListItems(html) {
  if (!html) return [];
  const items = [];
  const re = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = re.exec(html))) items.push(htmlToPlain(m[1]));
  return items;
}

function parseApproaches(html) {
  if (!html) return [];
  const tbody = (html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i) || [, html])[1];
  const rows = [];
  const trRe = /<tr([^>]*)>([\s\S]*?)<\/tr>/gi;
  let m;
  while ((m = trRe.exec(tbody))) {
    const attrs = m[1] || '';
    const picked = /class\s*=\s*["'][^"']*\bpicked\b/.test(attrs);
    const cells = [];
    const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let c;
    while ((c = cellRe.exec(m[2]))) cells.push(htmlToPlain(c[1]));
    if (cells.length >= 4) {
      rows.push({
        approach: cells[0],
        gist:     cells[1],
        tradeoff: cells[2],
        status:   cells[3],
        picked,
      });
    }
  }
  return rows;
}

function firstSentence(s, max = 120) {
  if (!s) return '';
  const cut = s.split(/(?<=[.!?])\s+/)[0] || s;
  return cut.length > max ? cut.slice(0, max - 1).trimEnd() + '…' : cut;
}

function clamp(arr, n) {
  return Array.isArray(arr) ? arr.slice(0, n) : [];
}

// ─── shared header / footer ────────────────────────────────────────────────
function drawTopicHeader(slide, topicNum, topicLabel, headline) {
  slide.addText([
    { text: `TOPIC ${topicNum}`, options: { bold: true } },
    { text: '   •   ', options: { color: C.teal } },
    { text: topicLabel.toUpperCase() },
  ], {
    x: 0.6, y: 0.42, w: 9.2, h: 0.32,
    fontSize: 11, fontFace: FONT_LABEL, color: C.teal, bold: true,
    charSpacing: 4, margin: 0,
  });

  slide.addText(headline, {
    x: 0.6, y: 0.85, w: 9.2, h: 0.95,
    fontSize: 36, fontFace: FONT_HEAD, color: C.ink, bold: true, margin: 0,
  });
}

function drawFooter(slide, date, n, total) {
  slide.addShape(slide.shapes?.LINE ?? 'line', {
    x: 0.6, y: 5.20, w: 8.8, h: 0,
    line: { color: C.rule, width: 0.5 },
  });
  slide.addText(`STAKEHOLDER BRIEFING   •   ${date}`, {
    x: 0.6, y: 5.30, w: 6.5, h: 0.25,
    fontSize: 9, fontFace: FONT_LABEL, color: C.body, charSpacing: 3, margin: 0,
  });
  slide.addText(`${n} / ${total}`, {
    x: 7.5, y: 5.30, w: 1.9, h: 0.25,
    fontSize: 9, fontFace: FONT_LABEL, color: C.body, align: 'right', margin: 0,
  });
}

// ─── slides ────────────────────────────────────────────────────────────────
async function slideTitle(pres, content) {
  const s = pres.addSlide();
  s.background = { color: C.cream };

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.3, h: 5.625,
    fill: { color: C.navy }, line: { type: 'none' },
  });

  s.addText([
    { text: 'STAKEHOLDER BRIEFING', options: { bold: true } },
    { text: '   •   ', options: { color: C.teal } },
    { text: content.date ?? '' },
  ], {
    x: 0.8, y: 1.45, w: 8.5, h: 0.35,
    fontSize: 12, fontFace: FONT_LABEL, color: C.teal, bold: true,
    charSpacing: 4, margin: 0,
  });

  s.addText(content.title ?? 'Brainstorming review', {
    x: 0.8, y: 1.9, w: 8.5, h: 1.6,
    fontSize: 50, fontFace: FONT_HEAD, color: C.ink, bold: true, margin: 0,
  });

  const subtitle = content.deckSubtitle || firstSentence(content.goal, 140);
  if (subtitle) {
    s.addShape(pres.shapes.LINE, {
      x: 0.8, y: 3.65, w: 1.2, h: 0,
      line: { color: C.teal, width: 1.5 },
    });
    s.addText(subtitle, {
      x: 0.8, y: 3.85, w: 8.5, h: 1.1,
      fontSize: 16, fontFace: FONT_BODY, color: C.body, margin: 0,
    });
  }
}

async function slideWhy(pres, content, topicNum, total) {
  const s = pres.addSlide();
  s.background = { color: C.cream };
  drawTopicHeader(s, topicNum, 'Why', 'Why we’re doing this');

  const items = clamp(parseListItems(content.context), 5);
  const startY = 2.05, rowH = 0.55, gap = 0.07;

  for (let i = 0; i < items.length; i++) {
    const y = startY + i * (rowH + gap);

    s.addShape(pres.shapes.OVAL, {
      x: 0.6, y: y + (rowH - 0.18) / 2, w: 0.18, h: 0.18,
      fill: { color: C.navy }, line: { type: 'none' },
    });

    s.addText(items[i], {
      x: 0.95, y, w: 8.45, h: rowH,
      fontSize: 14, fontFace: FONT_BODY, color: C.ink,
      margin: 0, valign: 'middle',
    });
  }

  drawFooter(s, content.date ?? '', topicNum + 1, total);
}

async function slideApproach(pres, content, topicNum, total) {
  const s = pres.addSlide();
  s.background = { color: C.cream };
  drawTopicHeader(s, topicNum, 'How', 'The approach + what it solves');

  // LEFT — "What we're building" with bulb icons
  s.addText('WHAT WE’RE BUILDING', {
    x: 0.6, y: 2.05, w: 4.5, h: 0.3,
    fontSize: 10, fontFace: FONT_LABEL, color: C.teal, bold: true,
    charSpacing: 3, margin: 0,
  });

  const approachItems = clamp(parseListItems(content.approach), 5);
  const bulb = await iconPng(FaLightbulb, '#' + C.navy, 256);
  const apprStartY = 2.45, apprRowH = 0.55;
  for (let i = 0; i < approachItems.length; i++) {
    const y = apprStartY + i * apprRowH;
    s.addImage({ data: bulb, x: 0.6, y: y + 0.08, w: 0.32, h: 0.38 });
    s.addText(approachItems[i], {
      x: 1.05, y, w: 3.85, h: apprRowH,
      fontSize: 11.5, fontFace: FONT_BODY, color: C.ink, bold: true,
      margin: 0, valign: 'middle',
    });
  }

  // RIGHT — navy panel with amber-circle checkmarks
  const panelX = 5.15, panelY = 1.95, panelW = 4.25, panelH = 3.15;
  s.addShape(pres.shapes.RECTANGLE, {
    x: panelX, y: panelY, w: panelW, h: panelH,
    fill: { color: C.navy }, line: { type: 'none' },
  });

  s.addText('WHY IT SOLVES OUR PROBLEMS', {
    x: panelX + 0.35, y: panelY + 0.3, w: panelW - 0.7, h: 0.3,
    fontSize: 10, fontFace: FONT_LABEL, color: C.amber, bold: true,
    charSpacing: 3, margin: 0,
  });

  s.addText('Each problem, addressed', {
    x: panelX + 0.35, y: panelY + 0.62, w: panelW - 0.7, h: 0.6,
    fontSize: 18, fontFace: FONT_HEAD, color: C.white, bold: true, margin: 0,
  });

  // payoffs: accept string[] or {title, body}[], default to context list
  const rawPayoffs = content.payoffs ?? parseListItems(content.context);
  const payoffs = clamp(rawPayoffs, 4).map(p => {
    if (typeof p === 'string') return p;
    if (p?.title && p?.body) return `${p.title} — ${p.body}`;
    return p?.title ?? p?.body ?? String(p);
  });

  const cmIcon = await iconPng(FaCheck, '#FFFFFF', 256);
  const poStartY = panelY + 1.3, poRowH = 0.46;
  for (let i = 0; i < payoffs.length; i++) {
    const y = poStartY + i * poRowH;
    s.addShape(pres.shapes.OVAL, {
      x: panelX + 0.35, y: y + 0.04, w: 0.3, h: 0.3,
      fill: { color: C.amber }, line: { type: 'none' },
    });
    s.addImage({ data: cmIcon, x: panelX + 0.41, y: y + 0.10, w: 0.18, h: 0.18 });
    s.addText(payoffs[i], {
      x: panelX + 0.78, y, w: panelW - 1.1, h: poRowH,
      fontSize: 11, fontFace: FONT_BODY, color: C.white,
      margin: 0, valign: 'middle',
    });
  }

  drawFooter(s, content.date ?? '', topicNum + 1, total);
}

async function slideOptions(pres, content, topicNum, total) {
  const s = pres.addSlide();
  s.background = { color: C.cream };
  drawTopicHeader(s, topicNum, 'Options', 'How we considered solving it');

  const rows = clamp(parseApproaches(content.approachesConsidered), 3);
  const cardW = 2.85, cardH = 2.95, gap = 0.125;
  const startX = 0.6, startY = 2.0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const x = startX + i * (cardW + gap);

    s.addShape(pres.shapes.RECTANGLE, {
      x, y: startY, w: cardW, h: cardH,
      fill: { color: r.picked ? C.navy : C.white },
      line: { color: r.picked ? C.navy : C.rule, width: r.picked ? 0 : 0.5 },
    });

    if (r.picked) {
      s.addShape(pres.shapes.RECTANGLE, {
        x, y: startY, w: cardW, h: 0.08,
        fill: { color: C.amber }, line: { type: 'none' },
      });
    }

    s.addText(r.picked ? 'PICKED' : 'REJECTED', {
      x: x + 0.25, y: startY + 0.22, w: cardW - 0.5, h: 0.3,
      fontSize: 10, fontFace: FONT_LABEL,
      color: r.picked ? C.amber : C.danger, bold: true,
      charSpacing: 3, margin: 0,
    });

    s.addText(r.approach, {
      x: x + 0.25, y: startY + 0.55, w: cardW - 0.5, h: 0.95,
      fontSize: 17, fontFace: FONT_HEAD,
      color: r.picked ? C.white : C.ink, bold: true, margin: 0,
    });

    s.addShape(pres.shapes.LINE, {
      x: x + 0.25, y: startY + 1.55, w: cardW - 0.5, h: 0,
      line: { color: r.picked ? C.amber : C.rule, width: 0.5 },
    });

    s.addText(r.gist, {
      x: x + 0.25, y: startY + 1.65, w: cardW - 0.5, h: cardH - 1.8,
      fontSize: 11, fontFace: FONT_BODY,
      color: r.picked ? C.white : C.body, margin: 0,
    });
  }

  drawFooter(s, content.date ?? '', topicNum + 1, total);
}

async function slideTradeoffs(pres, content, topicNum, total) {
  const s = pres.addSlide();
  s.background = { color: C.cream };
  drawTopicHeader(s, topicNum, 'Trade-offs', 'What we’re trading off');

  const items = clamp(parseListItems(content.tradeoffs), 5);
  const warn = await iconPng(FaExclamationTriangle, '#' + C.amber, 256);
  const startY = 2.05, rowH = 0.58, gap = 0.07;

  for (let i = 0; i < items.length; i++) {
    const y = startY + i * (rowH + gap);
    s.addImage({ data: warn, x: 0.6, y: y + 0.12, w: 0.32, h: 0.32 });
    s.addText(items[i], {
      x: 1.05, y, w: 8.35, h: rowH,
      fontSize: 13, fontFace: FONT_BODY, color: C.ink,
      margin: 0, valign: 'middle',
    });
  }

  drawFooter(s, content.date ?? '', topicNum + 1, total);
}

// ─── main ──────────────────────────────────────────────────────────────────
async function resolveInput(rawPath) {
  const abs = path.resolve(rawPath);
  if (abs.endsWith('.content.json')) return abs;
  if (abs.endsWith('.html')) {
    const sibling = abs.replace(/\.html$/, '.content.json');
    try {
      await fs.access(sibling);
      return sibling;
    } catch {
      throw new Error(
        `Passed an HTML path (${rawPath}) but couldn't find sibling ${path.basename(sibling)}. ` +
        `The brainstorming HTML is baked from the JSON — the JSON is the source of truth.`,
      );
    }
  }
  if (abs.endsWith('.json')) return abs;
  throw new Error(`Unrecognised input: ${rawPath}. Expected *.content.json or *.html.`);
}

async function main() {
  const [, , rawIn, rawOut] = process.argv;
  if (!rawIn) {
    console.error('Usage: build-deck.mjs <content.json|html> [output.pptx]');
    process.exit(1);
  }

  const inputPath = await resolveInput(rawIn);
  const content = JSON.parse(await fs.readFile(inputPath, 'utf8'));

  const outputPath = rawOut
    ? path.resolve(rawOut)
    : inputPath.replace(/\.content\.json$/, '.pptx').replace(/\.json$/, '.pptx');

  const pres = new pptxgen();
  pres.layout = 'LAYOUT_16x9';
  pres.author = 'Brainstorming Deck';
  pres.title  = content.title || 'Brainstorming Review';

  const TOTAL = 5;
  await slideTitle(pres, content);
  await slideWhy(pres, content, 1, TOTAL);
  await slideApproach(pres, content, 2, TOTAL);
  await slideOptions(pres, content, 3, TOTAL);
  await slideTradeoffs(pres, content, 4, TOTAL);

  await pres.writeFile({ fileName: outputPath });
  console.log(`✓ ${outputPath}`);
}

main().catch(err => {
  console.error('✗', err.message);
  process.exit(1);
});
