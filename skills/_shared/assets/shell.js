// Shared review-doc shell runtime — inlined by gen-artifact.mjs into every
// generated review HTML. Content is baked in at gen time (not fetched at
// runtime), so this script handles only browser-side concerns:
//
//   - Mermaid diagram rendering
//   - highlight.js for code blocks
//   - TOC build + scroll-spy
//   - Semantic <strong>NEW/CHANGED/...</strong> tag pills
//   - Inline-comment system (talks to the review server at /api/comments)

import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
import svgPanZoom from "https://cdn.jsdelivr.net/npm/svg-pan-zoom@3.6.2/+esm";

const FILE = location.pathname.replace(/^\//, '');
const COMMENTS_API = `/api/comments?file=${encodeURIComponent(FILE)}`;

function esc(s) {
  return String(s).replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}

function setStatus(msg, cls) {
  const s = document.getElementById('cmStatus');
  if (!s) return;
  s.textContent = msg;
  s.className = 'cm-status ' + (cls || '');
}

function showBanner(text) {
  const b = document.getElementById('cmBanner');
  if (!b) return;
  if (text) b.textContent = text;
  b.classList.add('visible');
  document.body.style.paddingTop = '44px';
}

// 1. Mermaid
function initMermaid() {
  mermaid.initialize({
    startOnLoad: false,
    theme: "dark",
    securityLevel: "strict",
    themeVariables: {
      darkMode: true,
      background: "#161b22",
      primaryColor: "#1c2128",
      primaryTextColor: "#e6edf3",
      primaryBorderColor: "#30363d",
      lineColor: "#7d8590",
      secondaryColor: "#21262d",
      tertiaryColor: "#0d1117",
      noteBkgColor: "#1c2128",
      noteTextColor: "#e6edf3",
      noteBorderColor: "#30363d",
      actorBkg: "#1c2128",
      actorBorder: "#58a6ff",
      actorTextColor: "#e6edf3",
      signalColor: "#7d8590",
      signalTextColor: "#e6edf3",
      labelBoxBkgColor: "#1c2128",
      labelBoxBorderColor: "#30363d",
      labelTextColor: "#e6edf3",
      activationBkgColor: "#21262d",
      activationBorderColor: "#58a6ff",
      sequenceNumberColor: "#0d1117",
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: "13px"
    },
    flowchart: { curve: "basis", htmlLabels: true },
    sequence: { showSequenceNumbers: true, mirrorActors: false },
    er: { useMaxWidth: true }
  });
}

async function renderMermaid() {
  try { await mermaid.run(); } catch (e) { console.error("mermaid render failed", e); return; }
  document.querySelectorAll(".diagram").forEach((diagram) => {
    const svg = diagram.querySelector("svg");
    if (!svg || svg.closest(".diagram-canvas")) return;
    const canvas = document.createElement("div");
    canvas.className = "diagram-canvas";
    svg.parentNode.insertBefore(canvas, svg);
    canvas.appendChild(svg);
    svg.removeAttribute("style");
    const pz = svgPanZoom(svg, {
      zoomEnabled: true, panEnabled: true, controlIconsEnabled: false,
      fit: true, center: true, minZoom: 0.2, maxZoom: 20, contain: false, dblClickZoomEnabled: true
    });
    const tb = document.createElement("div");
    tb.className = "diagram-toolbar";
    tb.innerHTML =
      '<button data-act="in" title="Zoom in" aria-label="Zoom in">+</button>' +
      '<button data-act="out" title="Zoom out" aria-label="Zoom out">−</button>' +
      '<button data-act="fit" title="Fit" aria-label="Fit">⤢</button>' +
      '<button data-act="reset" title="Reset" aria-label="Reset">⟲</button>';
    tb.addEventListener("click", (e) => {
      const act = e.target.closest("button")?.dataset.act;
      if (act === "in") pz.zoomIn();
      else if (act === "out") pz.zoomOut();
      else if (act === "fit") { pz.resize(); pz.fit(); pz.center(); }
      else if (act === "reset") pz.reset();
    });
    const hint = document.createElement("div");
    hint.className = "diagram-hint";
    hint.textContent = "drag · scroll to zoom";
    canvas.appendChild(tb);
    canvas.appendChild(hint);
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(() => { pz.resize(); pz.fit(); pz.center(); }).observe(canvas);
    }
  });
}

// 3. highlight.js (loaded as a side-script, attached to window.hljs)
async function loadHighlightJs() {
  if (typeof window.hljs !== 'undefined') return;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/highlight.js@11/lib/common.min.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  }).catch(() => {});
}

function runHljs() {
  if (typeof window.hljs === 'undefined') return;
  document.querySelectorAll('pre.code').forEach((pre) => {
    if (pre.querySelector('code')) return;
    const code = document.createElement('code');
    while (pre.firstChild) code.appendChild(pre.firstChild);
    const lang = pre.dataset.lang;
    if (lang) code.className = 'language-' + lang;
    pre.appendChild(code);
  });
  document.querySelectorAll('pre code').forEach((el) => {
    if (el.closest('.diagram')) return;
    try { window.hljs.highlightElement(el); } catch (e) { console.warn('hljs', e); }
  });
}

// 4. TOC
function buildToc() {
  const tocList = document.getElementById("toc-list");
  if (!tocList) return;
  const sections = [...document.querySelectorAll("main section[id]")];
  sections.forEach((s) => {
    const h2 = s.querySelector("h2");
    if (!h2) return;
    const titleNode = h2.cloneNode(true);
    titleNode.querySelectorAll(".anchor").forEach((n) => n.remove());
    const text = titleNode.textContent.trim();
    if (!text) return;
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = "#" + s.id;
    a.textContent = text;
    a.dataset.target = s.id;
    li.appendChild(a);
    tocList.appendChild(li);
  });
  const links = [...tocList.querySelectorAll("a")];
  let ticking = false;
  const updateActive = () => {
    ticking = false;
    const targetY = window.innerHeight * 0.2;
    let activeId = sections[0]?.id || null;
    for (const s of sections) {
      if (s.getBoundingClientRect().top <= targetY) activeId = s.id;
    }
    links.forEach((a) => a.classList.toggle("active", a.dataset.target === activeId));
  };
  window.addEventListener("scroll", () => {
    if (!ticking) { requestAnimationFrame(updateActive); ticking = true; }
  }, { passive: true });
  updateActive();
}

// 5. Semantic tag pills (<strong>NEW</strong> → <strong class="tag tag-add">NEW</strong>)
function applyTagPills() {
  const TAG_MAP = {
    NEW: "add", ADD: "add", ADDED: "add",
    CHANGED: "change", CHANGE: "change", UPDATE: "change", UPDATED: "change", MOVED: "change", RENAMED: "change",
    BREAKING: "break",
    DEPRECATED: "warn", DEPRECATE: "warn", REMOVED: "warn", REMOVE: "warn",
    FIX: "fix", FIXED: "fix"
  };
  document.querySelectorAll("li").forEach((li) => {
    let first = li.firstElementChild;
    if (first && first.tagName === "P") first = first.firstElementChild;
    if (!first || first.tagName !== "STRONG") return;
    const m = first.textContent.trim().match(/^([A-Za-z]+):?$/);
    if (!m) return;
    const key = m[1].toUpperCase();
    const cls = TAG_MAP[key];
    if (!cls) return;
    first.textContent = key;
    first.classList.add("tag", "tag-" + cls);
    const nxt = first.nextSibling;
    if (nxt && nxt.nodeType === 3) {
      nxt.textContent = nxt.textContent.replace(/^[\s:.]+/, " ");
    }
  });
}

// 6. Inline comment system
function initComments(serverOk) {
  let comments = [];

  if (!serverOk) {
    setStatus('server not running — comments disabled', 'err');
    document.getElementById('cmToggle').onclick = () => document.getElementById('cmPanel').classList.toggle('open');
    return;
  }

  setStatus('connected · ' + FILE, 'ok');

  function findSectionTitle(node) {
    let n = node && node.nodeType === 3 ? node.parentNode : node;
    while (n && n !== document.body) {
      if (n.tagName === 'SECTION') {
        const h2 = n.querySelector('h2');
        return h2 ? h2.textContent.replace(/#/g, '').trim() : (n.id || 'Section');
      }
      if (n.classList?.contains('step')) {
        const t = n.querySelector('.step-header h3, h3');
        return t ? 'Step: ' + t.textContent.trim() : 'Step';
      }
      if (n.classList?.contains('test-entry')) {
        const t = n.querySelector('.test-name');
        return t ? 'Test: ' + t.textContent.trim() : 'Test';
      }
      n = n.parentNode;
    }
    return 'Top';
  }

  function sectionElement(sectionName) {
    return Array.from(document.querySelectorAll('section, article.step, article.test-entry')).find(s => {
      const h2 = s.querySelector('h2');
      const h3 = s.querySelector('.step-header h3, h3, .test-name');
      return (h2 && h2.textContent.replace(/#/g,'').trim() === sectionName)
          || (sectionName?.startsWith('Step: ') && h3 && sectionName === 'Step: ' + h3.textContent.trim())
          || (sectionName?.startsWith('Test: ') && h3 && sectionName === 'Test: ' + h3.textContent.trim());
    }) || document.body;
  }

  function isCommentableNode(n) {
    return !n.parentElement?.closest('.cm-panel, .cm-popup, .cm-banner, .cm-select-btn, mark.cm-hl, script, style');
  }

  function computeOccurrence(sectionEl, quote, startContainer, startOffset) {
    let cumulative = '';
    const walker = document.createTreeWalker(sectionEl, NodeFilter.SHOW_TEXT, { acceptNode: n => isCommentableNode(n) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
    let node;
    while ((node = walker.nextNode())) {
      if (node === startContainer) { cumulative += node.textContent.substring(0, startOffset); break; }
      cumulative += node.textContent;
    }
    let count = 0, i = 0;
    while ((i = cumulative.indexOf(quote, i)) !== -1) { count++; i += quote.length; }
    return count;
  }

  function openPopup(rect, quote, section, occurrence) {
    document.querySelectorAll('.cm-popup').forEach(p => p.remove());
    const p = document.createElement('div');
    p.className = 'cm-popup';
    p.innerHTML = `<div class="cm-quote">${esc(quote.slice(0, 200))}</div><textarea placeholder="Leave a comment..."></textarea><div class="cm-row"><button data-cancel>Cancel</button><button class="primary" data-save>Save</button></div>`;
    p.style.top = (window.scrollY + rect.bottom + 8) + 'px';
    p.style.left = Math.min(window.scrollX + rect.left, window.scrollX + window.innerWidth - 360) + 'px';
    document.body.appendChild(p);
    const ta = p.querySelector('textarea'); ta.focus();
    p.querySelector('[data-cancel]').onclick = () => p.remove();
    p.querySelector('[data-save]').onclick = async () => {
      const body = ta.value.trim(); if (!body) return;
      comments.push({ id: 'cm' + Date.now() + Math.random().toString(36).slice(2,6), section, quote: quote.slice(0, 240), occurrence: occurrence | 0, body, ts: new Date().toISOString() });
      p.remove();
      await persist();
    };
    setTimeout(() => {
      document.addEventListener('click', function h(e) {
        if (!p.contains(e.target) && !e.target.closest('.cm-add, .cm-select-btn')) { p.remove(); document.removeEventListener('click', h); }
      });
    }, 0);
  }

  function onSelection() {
    const sel = window.getSelection();
    const btn = document.getElementById('cmSelectBtn');
    if (!sel.rangeCount || sel.isCollapsed) { btn.classList.remove('visible'); return; }
    const text = sel.toString().trim();
    if (text.length < 2) { btn.classList.remove('visible'); return; }
    if (sel.anchorNode && (sel.anchorNode.parentElement?.closest('.cm-panel, .cm-popup, .cm-banner, .cm-select-btn'))) { btn.classList.remove('visible'); return; }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    btn.style.top = (window.scrollY + rect.bottom + 6) + 'px';
    btn.style.left = (window.scrollX + rect.left) + 'px';
    btn.classList.add('visible');
    btn.onclick = (e) => {
      e.stopPropagation();
      const quote = sel.toString().trim();
      const section = findSectionTitle(sel.anchorNode);
      const sectionEl = sectionElement(section);
      const occurrence = computeOccurrence(sectionEl, quote, range.startContainer, range.startOffset);
      btn.classList.remove('visible');
      openPopup(rect, quote, section, occurrence);
      sel.removeAllRanges();
    };
  }

  function openPopupForElement(el) {
    const heading = el.querySelector('h3, .test-name, .step-header h3');
    const quote = heading ? heading.textContent.trim() : el.textContent.replace(/\s+/g,' ').trim().slice(0,140);
    const section = findSectionTitle(el);
    const rect = el.getBoundingClientRect();
    openPopup(rect, quote, section, 0);
  }

  function attachAddBtns() {
    document.querySelectorAll('.diagram, article.step, article.test-entry').forEach(el => {
      if (el.querySelector(':scope > .cm-add')) return;
      el.classList.add('cm-commentable');
      const b = document.createElement('button');
      b.className = 'cm-add'; b.textContent = '+'; b.title = 'Add comment';
      b.onclick = e => { e.stopPropagation(); openPopupForElement(el); };
      el.appendChild(b);
    });
  }

  function highlightComments() {
    document.querySelectorAll('mark.cm-hl').forEach(m => {
      const parent = m.parentNode;
      while (m.firstChild) parent.insertBefore(m.firstChild, m);
      parent.removeChild(m);
      parent.normalize();
    });
    comments.forEach(c => {
      const root = sectionElement(c.section);
      const target = c.occurrence | 0;
      let seen = 0;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: n => (!n.textContent.trim() || !isCommentableNode(n)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
      });
      let node;
      outer: while ((node = walker.nextNode())) {
        let pos = 0;
        while (true) {
          const idx = node.textContent.indexOf(c.quote, pos);
          if (idx === -1) break;
          if (seen === target) {
            const after = node.splitText(idx);
            after.splitText(c.quote.length);
            const mk = document.createElement('mark');
            mk.className = 'cm-hl'; mk.dataset.cmId = c.id; mk.title = c.body;
            mk.onclick = e => { e.stopPropagation(); document.getElementById('cmPanel').classList.add('open'); };
            node.parentNode.replaceChild(mk, after);
            mk.appendChild(document.createTextNode(c.quote));
            break outer;
          }
          seen++;
          pos = idx + c.quote.length;
        }
      }
    });
  }

  function renderPanel() {
    const list = document.getElementById('cmItems');
    document.getElementById('cmBadge').textContent = comments.length;
    if (!comments.length) { list.innerHTML = '<div class="cm-empty">No comments yet. Select any text and click "💬 Comment".</div>'; return; }
    list.innerHTML = comments.map(c => `<div class="cm-item"><div class="cm-q">${esc(c.section)} — ${esc(c.quote.slice(0, 80))}</div><div class="cm-b">${esc(c.body)}</div><div class="cm-actions"><button data-del="${c.id}">delete</button></div></div>`).join('');
    list.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      comments = comments.filter(c => c.id !== b.dataset.del);
      await persist();
    });
  }

  function render() { attachAddBtns(); highlightComments(); renderPanel(); }

  async function persist() {
    try {
      await fetch(COMMENTS_API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ file: FILE, comments }) });
      render();
    } catch (e) { setStatus('save failed: ' + e.message, 'err'); }
  }

  (async () => {
    try {
      const r = await fetch(COMMENTS_API, { cache: 'no-store' });
      const data = await r.json();
      comments = Array.isArray(data.comments) ? data.comments : [];
    } catch (e) { console.error('load failed', e); }
    render();
  })();

  document.addEventListener('mouseup', () => setTimeout(onSelection, 10));
  document.addEventListener('keyup', (e) => { if (e.shiftKey || e.key === 'Shift') setTimeout(onSelection, 10); });
  document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('.cm-select-btn')) document.getElementById('cmSelectBtn').classList.remove('visible');
  });

  document.getElementById('cmToggle').onclick = () => document.getElementById('cmPanel').classList.toggle('open');
  document.getElementById('cmClear').onclick = async () => {
    if (!confirm('Delete all comments on this page?')) return;
    comments = [];
    await persist();
  };
}

// Boot — content is already in the DOM (baked at gen time). Just run the
// browser-side enhancements, then check the review server for comments.
(async function boot() {
  initMermaid();
  await renderMermaid();
  await loadHighlightJs();
  runHljs();
  applyTagPills();
  buildToc();

  let serverOk = false;
  try {
    const r = await fetch('/api/health', { cache: 'no-store' });
    serverOk = r.ok;
  } catch { serverOk = false; }

  if (!serverOk) showBanner();
  initComments(serverOk);
})();
