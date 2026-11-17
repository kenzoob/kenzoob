#!/usr/bin/env node
// Génère les SVG animés du profil, en version claire et sombre.
// Usage : node scripts/build.mjs   (écrit dans assets/)
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
mkdirSync(OUT, { recursive: true });

const THEMES = {
  light: { ink: '#1f2328', muted: '#59636e', faint: '#8c959f', line: '#d1d9e0', card: '#f6f8fa', bg: '#ffffff', ok: '#1a7f37', ko: '#cf222e' },
  dark: { ink: '#e6edf3', muted: '#9198a1', faint: '#656c76', line: '#3d444d', card: '#151b23', bg: '#0d1117', ok: '#3fb950', ko: '#f85149' },
};

const MONO = `ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,'Liberation Mono',monospace`;
const SANS = `-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif`;
const SERIF = `'Iowan Old Style','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif`;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const r2 = (n) => Math.round(n * 100) / 100;

// Petit générateur pseudo-aléatoire déterministe : le build donne toujours le même dessin.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function svg(w, h, t, css, body, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xml:space="preserve" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
<style>
.ink{fill:${t.ink}}.muted{fill:${t.muted}}.faint{fill:${t.faint}}
text{white-space:pre}.mono{font-family:${MONO}}.sans{font-family:${SANS}}.serif{font-family:${SERIF}}
${css}
</style>
${body}
</svg>
`;
}

function write(name, build) {
  for (const [mode, t] of Object.entries(THEMES)) {
    writeFileSync(join(OUT, `${name}-${mode}.svg`), build(t, mode));
  }
}

// ---------- Effet machine à écrire (SMIL, sans JS) ----------
function typer(id, lines, { x, y, cw, size, cls, slot = 5, type = 2, hold = 2.3, erase = 0.5, t }) {
  const total = slot * lines.length;
  let out = '';
  lines.forEach((txt, i) => {
    const n = txt.length;
    const s = i * slot;
    const pts = [[0, 0]];
    for (let j = 1; j <= n; j++) pts.push([s + 0.15 + (type * j) / n, j === n ? n * cw + 400 : j * cw]);
    for (let j = 1; j <= n; j++) pts.push([s + 0.15 + type + hold + (erase * j) / n, (n - j) * cw]);
    const kt = pts.map((p) => r2(p[0] / total).toFixed(4));
    if (kt[0] !== '0.0000') kt.unshift('0');
    const vals = pts.map((p) => r2(p[1]));
    kt.push('1'); vals.push(0);
    const cur = pts.map((p) => r2(Math.min(p[1], n * cw)));
    cur.push(0);
    out += `<clipPath id="${id}${i}"><rect x="${x}" y="${y - size}" height="${size * 1.6}" width="0"><animate attributeName="width" dur="${total}s" repeatCount="indefinite" calcMode="discrete" keyTimes="${kt.join(';')}" values="${vals.join(';')}"/></rect></clipPath>
<text x="${x}" y="${y}" class="${cls}" textLength="${r2(n * cw)}" lengthAdjust="spacing" clip-path="url(#${id}${i})">${esc(txt)}</text>
<rect x="${x + 2}" y="${y - size * 0.85}" width="${r2(cw * 0.9)}" height="${size * 1.05}" fill="${t.ink}" opacity="0"><animate attributeName="opacity" dur="${total}s" repeatCount="indefinite" calcMode="discrete" keyTimes="0;${r2(s / total).toFixed(4)};${r2((s + slot - 0.2) / total).toFixed(4)};1" values="0;1;0;0"/><animateTransform attributeName="transform" type="translate" dur="${total}s" repeatCount="indefinite" calcMode="discrete" keyTimes="${kt.join(';')}" values="${cur.map((v) => `${v} 0`).join(';')}"/></rect>`;
  });
  return out;
}

// ---------- Matrice de points « { ▮ } » pour l'en-tête ----------
const BRACE = [
  '....XXX', '...XXXX',
  ...Array(7).fill('...XX..'),
  '..XXX..', '.XXX...', 'XXX....', 'XX.....', 'XXX....', '.XXX...', '..XXX..',
  ...Array(7).fill('...XX..'),
  '...XXXX', '....XXX',
];
const GLYPH = BRACE.map((row, y) => {
  const right = [...row].reverse().join('');
  const cursor = y >= 9 && y <= 15 ? 'CCC' : '...';
  return row + '.....' + cursor + '.....' + right;
});

// ================= 1. En-tête =================
write('header', (t) => {
  const W = 1200, H = 470;
  const gx = 838, gy = 82, sp = 12.4;
  const cx = gx + 13 * sp, cy = gy + 12 * sp; // centre du curseur, d'où part l'onde
  let grid = '', dots = '', cur = '';
  GLYPH.forEach((row, y) => [...row].forEach((ch, x) => {
    const px = r2(gx + x * sp), py = r2(gy + y * sp);
    if (ch === '.') { grid += `<circle cx="${px}" cy="${py}" r="1.5"/>`; return; }
    const d = Math.hypot(px - cx, py - cy);
    if (ch === 'C') cur += `<circle cx="${px}" cy="${py}" r="3.4"/>`;
    else dots += `<circle cx="${px}" cy="${py}" r="3.2" style="animation-delay:${r2(0.5 + d / 300)}s,${r2(d / 160)}s"/>`;
  }));
  const css = `
.grid circle{fill:${t.ink};opacity:.09}
.dots circle{fill:${t.ink};opacity:0;animation:pop .5s ease-out both,wave 6s ease-in-out infinite}
@keyframes pop{from{opacity:0}to{opacity:.55}}
@keyframes wave{0%,100%{opacity:.55}8%{opacity:1}24%{opacity:.55}}
.cur circle{fill:${t.ink};animation:blink 1.1s steps(1) infinite}
@keyframes blink{50%{opacity:0}}
.up{opacity:0;animation:up .9s cubic-bezier(.2,.7,.2,1) both}
@keyframes up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.rule{stroke:${t.line};stroke-width:1;stroke-dasharray:720;stroke-dashoffset:720;animation:draw 1.4s .2s ease-out forwards}
@keyframes draw{to{stroke-dashoffset:0}}
.box{fill:${t.card};stroke:${t.line}}
`;
  const body = `
<text x="60" y="72" class="mono muted up" font-size="14" style="animation-delay:.1s">@kenzoob</text>
<text x="54" y="168" class="serif ink up" font-size="82" style="animation-delay:.25s">Kenzo O'Bryan</text>
<line x1="60" y1="196" x2="780" y2="196" class="rule"/>
<text x="60" y="236" class="sans muted up" font-size="20" style="animation-delay:.6s">Fullstack developer. In the evenings I build tools for LLM apps,</text>
<text x="60" y="264" class="sans muted up" font-size="20" style="animation-delay:.7s">mostly the code that runs when the model or the API fails.</text>
<g class="up" style="animation-delay:.9s">
<rect x="60" y="298" width="720" height="56" rx="10" class="box"/>
<text x="80" y="332" class="mono faint" font-size="15">working on ›</text>
</g>
${typer('ty', [
    'a circuit breaker for LLM API calls',
    'evals that catch my RAG agent making things up',
    'an MCP server for GitHub issues, read-only by default',
  ], { x: 196, y: 332, cw: 9.05, size: 15, cls: 'mono ink" font-size="15', t })}
<text x="60" y="412" class="mono faint up" font-size="13" style="animation-delay:1.1s">TypeScript  ·  Node.js  ·  Python  ·  Flutter  ·  C  ·  FastAPI  ·  React  ·  Docker</text>
<g class="grid">${grid}</g>
<g class="dots">${dots}</g>
<g class="cur">${cur}</g>
`;
  return svg(W, H, t, css, body, "Kenzo O'Bryan, fullstack developer");
});

// ================= 2. Bureau, la nuit =================
write('night', (t) => {
  const W = 1200, H = 330;
  const R = rng(7);
  // ciel et ville dans la fenêtre
  let stars = '';
  for (let i = 0; i < 18; i++) {
    const x = r2(85 + R() * 400), y = r2(36 + R() * 90);
    if (x > 392 && x < 448 && y < 104) continue; // pas d'étoile sur la lune
    stars += `<circle cx="${x}" cy="${y}" r="${r2(0.8 + R() * 1.1)}" class="st" style="animation-delay:${r2(R() * 4)}s"/>`;
  }
  const blds = [[72, 40, 70], [116, 30, 105], [150, 55, 60], [210, 26, 132], [240, 44, 86], [288, 60, 55], [352, 34, 116], [390, 50, 76], [444, 24, 96], [472, 26, 62]];
  let city = '', lit = '';
  for (const [x, w, h] of blds) {
    city += `<rect x="${x}" y="${264 - h}" width="${w}" height="${h}"/>`;
    for (let wy = 264 - h + 10; wy < 256; wy += 14) {
      for (let wx = x + 6; wx < x + w - 6; wx += 10) {
        if (R() < 0.7) continue;
        lit += `<rect x="${wx}" y="${wy}" width="4" height="6" class="lw" style="animation-delay:${r2(R() * 9)}s"/>`;
      }
    }
  }
  // code qui défile sur l'écran
  let code = '';
  const lines = [];
  let ind = 0;
  for (let i = 0; i < 26; i++) {
    const segs = [];
    let x = ind * 16;
    const n = 1 + Math.floor(R() * 3);
    for (let k = 0; k < n; k++) { const w = 14 + Math.floor(R() * 70); segs.push([x, w, R() < 0.35 ? 'ink' : 'faint']); x += w + 7; }
    lines.push(segs);
    ind = Math.max(0, Math.min(3, ind + (R() < 0.3 ? 1 : R() < 0.5 ? -1 : 0)));
  }
  for (let rep = 0; rep < 2; rep++) lines.forEach((segs, i) => {
    const y = 122 + (rep * 26 + i) * 12;
    for (const [x, w, c] of segs) code += `<rect x="${756 + x}" y="${y}" width="${Math.min(w, 262 - x)}" height="5" rx="2" class="${c}" opacity="${c === 'ink' ? 0.8 : 0.6}"/>`;
  });
  const css = `
.fr{fill:none;stroke:${t.ink};stroke-width:1.5}
.st{fill:${t.ink};animation:tw 4s ease-in-out infinite}@keyframes tw{0%,100%{opacity:.25}50%{opacity:1}}
.city rect{fill:${t.faint};opacity:.3}
.lw{fill:${t.ink};opacity:0;animation:lw 9s steps(1) infinite}@keyframes lw{0%{opacity:.7}40%{opacity:0}70%{opacity:.7}}
.scroll{animation:sc 22s linear infinite}@keyframes sc{to{transform:translateY(-312px)}}
.cone{fill:${t.ink};animation:fl 5s ease-in-out infinite}@keyframes fl{0%,100%{opacity:.05}50%{opacity:.08}}
.sm{fill:none;stroke:${t.faint};stroke-width:1.6;stroke-linecap:round;animation:sm 3s ease-in-out infinite}
@keyframes sm{0%{opacity:0;transform:translateY(4px)}30%{opacity:.9}100%{opacity:0;transform:translateY(-12px)}}
.bk{animation:blink 1s steps(1) infinite}@keyframes blink{50%{fill-opacity:0}}
`;
  const body = `
<clipPath id="win"><rect x="71" y="25" width="428" height="238"/></clipPath>
<g clip-path="url(#win)">
${stars}
<circle cx="420" cy="78" r="22" fill="${t.ink}" opacity=".85"/><circle cx="431" cy="71" r="20" fill="${t.bg}"/>
<g class="city">${city}</g>
<line x1="223" y1="132" x2="223" y2="110" stroke="${t.faint}" stroke-width="1.5"/><circle cx="223" cy="108" r="2" fill="${t.ink}" class="st"/>
${lit}
</g>
<rect x="70" y="24" width="430" height="240" rx="6" class="fr"/>
<line x1="285" y1="24" x2="285" y2="264" stroke="${t.line}" stroke-width="1.5"/>
<line x1="70" y1="144" x2="500" y2="144" stroke="${t.line}" stroke-width="1.5"/>
<line x1="40" y1="292" x2="1160" y2="292" stroke="${t.ink}" stroke-width="1.5"/>
<polygon points="566,170 620,160 760,292 560,292" class="cone"/>
<ellipse cx="610" cy="289" rx="26" ry="4" fill="${t.ink}"/>
<polyline points="610,287 642,202 598,152" fill="none" stroke="${t.ink}" stroke-width="3" stroke-linejoin="round"/>
<path d="M574 142 L608 128 L624 160 L562 172 Z" fill="${t.ink}"/>
<rect x="740" y="104" width="300" height="180" rx="8" fill="${t.card}" class="fr"/>
<clipPath id="scr"><rect x="752" y="116" width="276" height="156" rx="3"/></clipPath>
<g clip-path="url(#scr)"><g class="scroll">${code}</g></g>
<path d="M712 284 H1068 L1058 292 H722 Z" fill="${t.ink}"/>
<rect x="1092" y="254" width="34" height="38" rx="4" class="fr"/>
<path d="M1126 262 q14 0 14 12 q0 12 -14 12" class="fr"/>
${[1100, 1109, 1118].map((x, i) => `<path d="M${x} 246 q-5 -7 0 -14 q5 -7 0 -14" class="sm" style="animation-delay:${i * 0.9}s"/>`).join('')}
<text x="70" y="320" class="mono faint" font-size="13">23<tspan class="bk">:</tspan>14</text>
`;
  return svg(W, H, t, css, body, 'A desk at night: laptop scrolling code, lamp, mug, city through the window');
});

// ================= 3. Tableau à volets =================
write('board', (t) => {
  const N = 22, CW = 46, CH = 66, G = 5, D = 2.4;
  const msgs = ['429 TOO MANY REQUESTS', '503 UNAVAILABLE', 'RETRY IN 500 MS', 'FALLBACK: OPENAI', '200 OK'];
  const T = D * msgs.length;
  const W = 1200, H = 116, y0 = 24;
  const x0 = (W - (N * CW + (N - 1) * G)) / 2;
  const pad = (s) => { const l = Math.floor((N - s.length) / 2); return (' '.repeat(l) + s).padEnd(N); };
  const rows = msgs.map(pad);
  let cells = '';
  for (let c = 0; c < N; c++) {
    const x = r2(x0 + c * (CW + G));
    const off = 0.05 + c * 0.035;
    cells += `<rect x="${x}" y="${y0}" width="${CW}" height="${CH}" rx="5" class="cell"/>`;
    rows.forEach((row, m) => {
      const ch = row[c];
      if (ch === ' ') return;
      const a = (m * D + off) / T, b = ((m + 1) * D + off) / T;
      const last = m === rows.length - 1;
      const kt = last ? `0;${(off / T).toFixed(4)};${a.toFixed(4)};1` : `0;${a.toFixed(4)};${b.toFixed(4)};1`;
      const vals = last ? '1;0;1;1' : '0;1;0;0';
      const col = m === rows.length - 1 ? t.ok : m < 2 ? t.ko : t.ink;
      cells += `<text x="${r2(x + CW / 2)}" y="${y0 + 46}" text-anchor="middle" class="mono" font-size="34" font-weight="700" fill="${col}" opacity="${last ? 1 : 0}"><animate attributeName="opacity" dur="${T}s" repeatCount="indefinite" calcMode="discrete" keyTimes="${kt}" values="${vals}"/>${esc(ch)}</text>`;
    });
    cells += `<line x1="${x}" y1="${y0 + CH / 2}" x2="${r2(x + CW)}" y2="${y0 + CH / 2}" stroke="${t.bg}" stroke-width="2"/>`;
    cells += `<rect x="${x}" y="${y0}" width="${CW}" height="${CH / 2}" rx="5" class="fl" style="animation-delay:${r2(off)}s"/>`;
  }
  const css = `.cell{fill:${t.card};stroke:${t.line}}
.fl{fill:${t.line};opacity:0;transform-box:fill-box;transform-origin:bottom;animation:fl ${D}s linear infinite}
@keyframes fl{0%{opacity:1;transform:scaleY(1)}7%{opacity:1;transform:scaleY(0)}7.1%,100%{opacity:0;transform:scaleY(0)}}`;
  return svg(W, H, t, css, cells, 'Split-flap board: 429 TOO MANY REQUESTS, 503 UNAVAILABLE, RETRY IN 500 MS, FALLBACK: OPENAI, 200 OK');
});

// ================= 4. resilient-llm en action =================
write('resilience', (t) => {
  const W = 1200, H = 420, T = 12;
  const pkt = (id, x1, y1, x2, y2, a, b) => {
    const dx = x2 - x1, dy = y2 - y1;
    return { css: `@keyframes ${id}{0%,${a - 0.01}%{opacity:0;transform:translate(0,0)}${a}%{opacity:1;transform:translate(0,0)}${b}%{opacity:1;transform:translate(${dx}px,${dy}px)}${b + 0.01}%,100%{opacity:0;transform:translate(${dx}px,${dy}px)}}#${id}{animation:${id} ${T}s linear infinite}`,
      el: `<circle id="${id}" cx="${x1}" cy="${y1}" r="6" fill="${t.ink}"/>` };
  };
  const win = (id, a, b) => `@keyframes ${id}{0%,${a - 0.01}%{opacity:0}${a}%,${b}%{opacity:1}${b + 0.01}%,100%{opacity:0}}.${id}{opacity:0;animation:${id} ${T}s linear infinite}`;
  const A = [250, 175], R1 = [440, 175], R2 = [710, 175], AN = [920, 110], OA = [920, 240];
  const ps = [
    pkt('p1', ...A, ...R1, 2, 8), pkt('p2', ...R2, ...AN, 9, 15),
    pkt('p3', ...R2, ...AN, 27, 33), pkt('p4', ...R2, ...AN, 44, 50),
    pkt('p5', ...R2, ...OA, 58, 64), pkt('p6', ...OA, ...R2, 67, 73), pkt('p7', ...R1, ...A, 74, 80),
  ];
  const css = `
.box{fill:${t.card};stroke:${t.line};stroke-width:1.2}
.wire{stroke:${t.line};stroke-width:1.5;fill:none}
.wire.d{stroke-dasharray:5 5;animation:flow 1s linear infinite}
@keyframes flow{to{stroke-dashoffset:-10}}
${ps.map((p) => p.css).join('\n')}
${win('b1', 15, 24)}${win('b2', 33, 41)}${win('b3', 50, 57)}${win('b4', 64, 96)}
${win('l1', 16, 96)}${win('l2', 34, 96)}${win('l3', 51, 96)}${win('l4', 65, 96)}
${win('f0', 0, 15)}${win('f1', 15.01, 33)}${win('f2', 33.01, 50)}${win('f3', 50.01, 96)}
${win('done', 80, 96)}
@keyframes dim{0%,52%{opacity:1}54%,95%{opacity:.35}100%{opacity:1}}.dim{animation:dim ${T}s linear infinite}
`;
  const badge = (cls, x, y, txt, color) => `<g class="${cls}"><rect x="${x}" y="${y - 15}" width="52" height="22" rx="11" fill="none" stroke="${color}"/><text x="${x + 26}" y="${y + 1}" text-anchor="middle" class="mono" font-size="13" fill="${color}">${txt}</text></g>`;
  const logs = [
    ['→ anthropic', '429', 'try 1', 'wait ~500 ms, then retry', t.ko],
    ['→ anthropic', '503', 'try 2', 'wait ~1 s, then retry', t.ko],
    ['→ anthropic', '503', 'try 3', 'out of retries, move to the next provider', t.ko],
    ['→ openai', '200', 'ok', 'response goes back to the app', t.ok],
  ];
  const body = `
<text x="60" y="44" class="mono faint" font-size="13">resilient-llm  ·  example with retries: 2, failureThreshold: 5</text>
<text x="60" y="74" class="sans ink" font-size="21">Anthropic keeps failing, your request still gets an answer</text>
<path d="M${A[0]} ${A[1]}H${R1[0]}" class="wire"/>
<path d="M${R2[0]} ${R2[1]}L${AN[0]} ${AN[1]}" class="wire"/>
<path d="M${R2[0]} ${R2[1]}L${OA[0]} ${OA[1]}" class="wire d"/>
<rect x="60" y="150" width="190" height="50" rx="10" class="box"/>
<text x="155" y="181" text-anchor="middle" class="mono ink" font-size="15">your app</text>
<text x="155" y="226" text-anchor="middle" class="mono done" font-size="13" fill="${t.ok}">✓ got a response</text>
<rect x="440" y="140" width="270" height="70" rx="12" class="box"/>
<text x="575" y="170" text-anchor="middle" class="mono ink" font-size="16">resilient-llm</text>
<g class="mono faint" font-size="12" text-anchor="middle">
<text x="575" y="193" class="f0">failures 0/5   circuit closed</text>
<text x="575" y="193" class="f1">failures 1/5   circuit closed</text>
<text x="575" y="193" class="f2">failures 2/5   circuit closed</text>
<text x="575" y="193" class="f3">failures 3/5   falling back</text>
</g>
<g class="dim"><rect x="920" y="85" width="220" height="50" rx="10" class="box"/>
<text x="942" y="115" class="mono ink" font-size="15">Anthropic</text></g>
${badge('b1', 1076, 115, '429', t.ko)}${badge('b2', 1076, 115, '503', t.ko)}${badge('b3', 1076, 115, '503', t.ko)}
<rect x="920" y="215" width="220" height="50" rx="10" class="box"/>
<text x="942" y="245" class="mono ink" font-size="15">OpenAI</text>
${badge('b4', 1076, 245, '200', t.ok)}
${ps.map((p) => p.el).join('')}
<line x1="60" y1="290" x2="1140" y2="290" stroke="${t.line}"/>
${logs.map(([to, code, n, msg, col], i) => `<text y="${322 + i * 24}" class="mono l${i + 1}" font-size="13"><tspan x="60" class="muted">${esc(to)}</tspan><tspan x="200" fill="${col}">${code}</tspan><tspan x="250" class="faint">${n}</tspan><tspan x="330" class="ink">${esc(msg)}</tspan></text>`).join('\n')}
`;
  return svg(W, H, t, css, body, 'Animation: resilient-llm retries, then falls back to another provider');
});

// ================= 5. Cartes de projets =================
function card(name, t, { title, lines, tags, motif, css = '' }) {
  const W = 580, H = 210;
  const base = `
.box{fill:${t.card};stroke:${t.line}}
.st{stroke:${t.ink};fill:none}
${css}`;
  const body = `
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="14" class="box"/>
<text x="28" y="48" class="mono ink" font-size="19">${esc(title)}</text>
${lines.map((l, i) => `<text x="28" y="${84 + i * 22}" class="sans muted" font-size="15">${esc(l)}</text>`).join('')}
<text x="28" y="182" class="mono faint" font-size="12">${esc(tags)}</text>
<g transform="translate(392,20)">${motif}</g>
`;
  return svg(W, H, t, base, body, `${title}: ${lines.join(' ')}`);
}

// resilient-llm : la requête bute sur une erreur, le disjoncteur s'ouvre, elle passe par l'autre voie.
write('card-resilient', (t) => card('resilient', t, {
  title: 'resilient-llm',
  lines: ['Keeps LLM calls working when a', 'provider fails: retries, a circuit', 'breaker, fallback and streaming.'],
  tags: 'TypeScript · npm · no dependencies · 70 tests',
  css: `@keyframes m1{0%{transform:translate(0,0);opacity:0}5%{opacity:1}30%{transform:translate(64px,0)}44%{transform:translate(64px,0)}62%{transform:translate(64px,84px)}88%{transform:translate(150px,84px);opacity:1}94%,100%{transform:translate(150px,84px);opacity:0}}
.m1{animation:m1 3.6s ease-in-out infinite}
@keyframes x1{0%,28%{opacity:0}32%,90%{opacity:1}100%{opacity:0}}.x1{animation:x1 3.6s linear infinite}
@keyframes sw{0%,40%{transform:rotate(0)}48%,92%{transform:rotate(-38deg)}100%{transform:rotate(0)}}.sw{transform-box:view-box;transform-origin:36px 152px;animation:sw 3.6s ease-in-out infinite}
@keyframes ok{0%,84%{opacity:0}88%,96%{opacity:1}100%{opacity:0}}.okm{animation:ok 3.6s linear infinite}
@keyframes lane{0%,40%{opacity:1}48%,92%{opacity:.3}100%{opacity:1}}.lane{animation:lane 3.6s linear infinite}`,
  motif: `<text x="0" y="22" class="mono faint" font-size="11">anthropic</text>
<line x1="0" y1="40" x2="170" y2="40" stroke="${t.line}" stroke-width="2" class="lane"/>
<text x="0" y="106" class="mono faint" font-size="11">openai</text>
<line x1="0" y1="124" x2="170" y2="124" stroke="${t.line}" stroke-width="2"/>
<path d="M70 40 V124" stroke="${t.line}" stroke-dasharray="3 4"/>
<g class="x1" stroke="${t.ko}" stroke-width="2.5" stroke-linecap="round"><line x1="80" y1="30" x2="96" y2="50"/><line x1="96" y1="30" x2="80" y2="50"/></g>
<circle cx="6" cy="40" r="6.5" fill="${t.ink}" class="m1"/>
<text x="160" y="116" class="mono okm" font-size="14" fill="${t.ok}">✓</text>
<circle cx="36" cy="152" r="3" fill="${t.ink}"/><circle cx="76" cy="152" r="3" fill="${t.ink}"/>
<line x1="36" y1="152" x2="76" y2="152" stroke="${t.ink}" stroke-width="2.5" stroke-linecap="round" class="sw"/>
<text x="90" y="156" class="mono faint" font-size="11">breaker</text>`,
}));

// agent-evals : 30 cas de test qui passent un à un (motif illustratif, pas les vrais résultats).
write('card-evals', (t) => {
  const fails = new Set([4, 9, 13, 17, 22, 27]);
  let m = '';
  for (let i = 0; i < 30; i++) {
    const x = (i % 6) * 27, y = Math.floor(i / 6) * 27;
    const d = r2(i * 0.11);
    m += `<rect x="${x}" y="${y}" width="21" height="21" rx="4" fill="none" stroke="${t.line}"/>`;
    if (fails.has(i)) m += `<g class="c" style="animation-delay:${d}s" stroke="${t.ko}" stroke-width="2" stroke-linecap="round"><line x1="${x + 6}" y1="${y + 6}" x2="${x + 15}" y2="${y + 15}"/><line x1="${x + 15}" y1="${y + 6}" x2="${x + 6}" y2="${y + 15}"/></g>`;
    else m += `<rect x="${x + 4}" y="${y + 4}" width="13" height="13" rx="2" fill="${t.ink}" class="c" style="animation-delay:${d}s"/>`;
  }
  m += `<text x="0" y="158" class="mono faint" font-size="11">30 test cases, run in CI</text>`;
  return card('evals', t, {
    title: 'agent-evals',
    lines: ['A RAG agent over the Node.js docs,', 'with 30 test cases to check whether', 'its answers can be trusted.'],
    tags: 'TypeScript · LLM-as-judge · prompt injection · CI',
    css: `.c{opacity:0;animation:c 6s ease-out infinite}@keyframes c{0%{opacity:0}4%,80%{opacity:1}90%,100%{opacity:0}}`,
    motif: m,
  });
});

// github-triage-mcp : une requête normale traverse les 4 couches, une requête piégée est arrêtée.
write('card-mcp', (t) => {
  let m = '';
  for (let i = 0; i < 4; i++) {
    const p = i * 15;
    m += `<rect x="${10 + p}" y="${p}" width="${150 - 2 * p}" height="${150 - 2 * p}" rx="${12 - i * 2}" class="st ly" style="animation-delay:${r2(0.25 + i * 0.22)}s"/>`;
  }
  m += `<circle cx="85" cy="75" r="9" fill="none" stroke="${t.ink}" stroke-width="2" class="core"/>`;
  m += `<circle cx="85" cy="-14" r="5" fill="${t.ink}" class="good"/>`;
  m += `<circle cx="85" cy="168" r="5" fill="${t.ko}" class="bad"/>`;
  m += `<rect x="40" y="146" width="90" height="8" rx="4" fill="${t.ko}" class="hit"/>`;
  return card('mcp', t, {
    title: 'github-triage-mcp',
    lines: ['An MCP server that triages GitHub', 'issues without handing the AI the', 'keys to the repo. Four safety layers.'],
    tags: 'MCP · TypeScript · read-only by default',
    css: `.ly{stroke-width:1.5;opacity:.2;animation:ly 5s ease-in-out infinite}@keyframes ly{0%,4%{opacity:.2}8%,14%{opacity:1}22%,100%{opacity:.2}}
.good{animation:good 5s ease-in-out infinite}@keyframes good{0%{transform:translateY(0);opacity:0}4%{opacity:1}30%{transform:translateY(89px);opacity:1}40%,100%{transform:translateY(89px);opacity:0}}
.core{transform-box:fill-box;transform-origin:center;animation:core 5s ease-out infinite}@keyframes core{0%,28%{transform:scale(1);opacity:.4}34%{transform:scale(1.6);opacity:1}46%,100%{transform:scale(1);opacity:.4}}
.bad{animation:bad 5s ease-in infinite}@keyframes bad{0%,52%{transform:translateY(0);opacity:0}56%{opacity:1}66%{transform:translateY(-12px);opacity:1}78%,100%{transform:translateY(-12px);opacity:0}}
.hit{opacity:0;animation:hit 5s linear infinite}@keyframes hit{0%,65%{opacity:0}67%{opacity:.5}80%,100%{opacity:0}}`,
    motif: m,
  });
});

write('card-serp', (t) => {
  // rangs Google -> Bing (exemple illustratif)
  const map = [2, 0, 5, 1, 9, 3, 4, 8, 6, 7];
  let m = '';
  for (let i = 0; i < 10; i++) {
    m += `<text x="0" y="${i * 15 + 8}" class="mono faint" font-size="9">${i + 1}</text>`;
    m += `<rect x="14" y="${i * 15}" width="${38 - i * 2}" height="8" rx="2" fill="${t.ink}" opacity=".8"/>`;
    m += `<rect x="${136 + i * 2}" y="${map[i] * 15}" width="${38 - i * 2}" height="8" rx="2" fill="${t.faint}"/>`;
    m += `<path d="M56 ${i * 15 + 4}C94 ${i * 15 + 4} 94 ${map[i] * 15 + 4} 132 ${map[i] * 15 + 4}" class="st ln" stroke-width="1" style="animation-delay:${i * 0.12}s"/>`;
  }
  m += `<text x="14" y="168" class="mono faint" font-size="10">Google</text><text x="142" y="168" class="mono faint" font-size="10">Bing</text>`;
  return card('serp', t, {
    title: 'serp-compare',
    lines: ['Google and Bing top 10, side by side,', 'for the same search. 24 h cache, and', 'the demo runs without an API key.'],
    tags: 'TypeScript · Docker · rate limiting',
    css: `.ln{stroke-dasharray:140;stroke-dashoffset:140;opacity:.6;animation:ln 4.5s ease-out infinite}@keyframes ln{0%{stroke-dashoffset:140}35%,85%{stroke-dashoffset:0}100%{stroke-dashoffset:0;opacity:0}}`,
    motif: m,
  });
});

// ================= 6. Résultats des évals =================
write('evals-story', (t) => {
  const W = 1200, H = 300;
  const rows = [['Correct answers', 95, 60], ['Correct citations', 55, 60], ['Says "I don\'t know" when off-topic', 0, 100], ['Prompt injections that got through (lower is better)', 0, 0]];
  let b = '';
  rows.forEach(([lab, v1, v2], i) => {
    const y = 96 + i * 46;
    b += `<text x="60" y="${y + 12}" class="sans ink" font-size="15">${esc(lab)}</text>`;
    b += `<rect x="460" y="${y}" width="540" height="6" rx="3" fill="${t.line}" opacity=".6"/>`;
    b += `<rect x="460" y="${y}" width="${Math.max(3, v1 * 5.4)}" height="6" rx="3" fill="${t.faint}" class="gr" style="animation-delay:${0.2 + i * 0.15}s"/>`;
    b += `<rect x="460" y="${y + 10}" width="540" height="6" rx="3" fill="${t.line}" opacity=".6"/>`;
    b += `<rect x="460" y="${y + 10}" width="${Math.max(3, v2 * 5.4)}" height="6" rx="3" fill="${t.ink}" class="gr" style="animation-delay:${0.35 + i * 0.15}s"/>`;
    b += `<text x="1020" y="${y + 7}" class="mono faint" font-size="12">v1 ${v1}%</text><text x="1020" y="${y + 18}" class="mono ink" font-size="12">v2 ${v2}%</text>`;
  });
  const css = `.gr{transform-box:fill-box;transform-origin:left;animation:gr 1.6s cubic-bezier(.2,.7,.2,1) both}@keyframes gr{from{transform:scaleX(0)}to{transform:scaleX(1)}}`;
  const body = `
<text x="60" y="44" class="mono faint" font-size="13">agent-evals  ·  30 cases  ·  gemini-3.1-flash-lite  ·  October 2026</text>
<text x="60" y="70" class="sans ink" font-size="20">v1 = basic prompt, v2 = stricter prompt</text>
${b}
<text x="60" y="282" class="mono faint" font-size="12">▪ v1</text><text x="110" y="282" class="mono ink" font-size="12">▪ v2</text>
`;
  return svg(W, H, t, css, body, 'agent-evals results, v1 vs v2');
});

// ================= 7. Graphe git =================
write('graph', (t) => {
  const W = 1200, H = 210, T = 11, END = 42; // le main se dessine de 0 à END %
  const at = (x) => r2(((x - 60) / 1080) * END);
  let css = `.ln{fill:none;stroke-width:2.5;stroke-linecap:round}`;
  let body = `<text x="60" y="26" class="mono faint" font-size="13">$ git log --graph</text>`;
  const line = (id, d, x1, x2, col) => {
    const a = at(x1), b = at(x2);
    css += `@keyframes ${id}{0%,${a}%{stroke-dashoffset:1;opacity:1}${b}%,88%{stroke-dashoffset:0;opacity:1}95%,100%{stroke-dashoffset:0;opacity:0}}#${id}{stroke-dasharray:1;stroke-dashoffset:1;animation:${id} ${T}s linear infinite}`;
    body += `<path id="${id}" d="${d}" pathLength="1" class="ln" stroke="${col}"/>`;
  };
  line('gm', 'M60 115 H1140', 60, 1140, t.faint);
  line('gf', 'M240 115 C270 115 270 65 300 65 H540 C570 65 570 115 600 115', 240, 600, t.ink);
  line('gx', 'M660 115 C690 115 690 165 720 165 H900 C930 165 930 115 960 115', 660, 960, t.ink);
  let n = 0;
  const dot = (x, y, big = false) => {
    const id = `c${n++}`, a = at(x);
    css += `@keyframes ${id}{0%,${a}%{opacity:0;transform:scale(.2)}${r2(a + 2)}%,88%{opacity:1;transform:scale(1)}95%,100%{opacity:0}}#${id}{opacity:0;transform-box:fill-box;transform-origin:center;animation:${id} ${T}s ease-out infinite}`;
    body += big
      ? `<circle id="${id}" cx="${x}" cy="${y}" r="8" fill="${t.bg}" stroke="${t.ink}" stroke-width="2.5"/>`
      : `<circle id="${id}" cx="${x}" cy="${y}" r="6" fill="${t.ink}"/>`;
  };
  const label = (x, y, txt, from, anchor = 'start') => {
    const id = `t${n++}`, a = at(from);
    css += `@keyframes ${id}{0%,${a}%{opacity:0}${r2(a + 3)}%,88%{opacity:1}95%,100%{opacity:0}}#${id}{opacity:0;animation:${id} ${T}s linear infinite}`;
    body += `<text id="${id}" x="${x}" y="${y}" text-anchor="${anchor}" class="mono muted" font-size="12">${esc(txt)}</text>`;
  };
  [60, 150, 240].forEach((x) => dot(x, 115));
  [330, 420, 510].forEach((x) => dot(x, 65));
  dot(600, 115, true); dot(660, 115);
  [750, 840].forEach((x) => dot(x, 165));
  dot(960, 115, true); dot(1050, 115); dot(1140, 115);
  label(60, 143, 'main', 60);
  label(300, 47, 'evals/v2', 300);
  label(720, 195, 'fix/empty-answers', 720);
  label(1140, 92, 'HEAD', 1140, 'middle');
  css += `.head{fill:none;stroke:${t.ink};stroke-width:1.5;transform-box:fill-box;transform-origin:center;opacity:0;animation:head 2s ease-out ${r2((END / 100) * T)}s infinite}@keyframes head{0%{transform:scale(1);opacity:.8}100%{transform:scale(2.6);opacity:0}}`;
  body += `<circle cx="1140" cy="115" r="7" class="head"/>`;
  return svg(W, H, t, css, body, 'Animated git graph with two branches merging into main');
});

// ================= 8. Pied de page =================
write('footer', (t) => {
  const W = 1200, H = 110;
  const css = `.tr{stroke:${t.line};stroke-width:1.5;fill:none}
.pu{stroke:${t.ink};stroke-width:2;fill:none;stroke-dasharray:90 1400;animation:pu 4s linear infinite}@keyframes pu{from{stroke-dashoffset:90}to{stroke-dashoffset:-1400}}`;
  const d = `M0 50H520L540 50L552 22L566 78L580 34L590 50H1200`;
  const body = `<path d="${d}" class="tr"/><path d="${d}" class="pu"/>
<text x="600" y="100" text-anchor="middle" class="mono faint" font-size="13">kenzoob  ·  npm: @kenzoobryan27</text>`;
  return svg(W, H, t, css, body, 'Footer');
});

console.log('SVG générés dans', OUT);
