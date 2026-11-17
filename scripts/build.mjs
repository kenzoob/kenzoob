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
// lines : textes ; total : durée du cycle ; renvoie les éléments à poser à (x, y).
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
    // keyTimes doit finir à 1 en mode discret
    kt.push('1'); vals.push(0);
    const cur = pts.map((p) => r2(Math.min(p[1], n * cw)));
    cur.push(0);
    out += `<clipPath id="${id}${i}"><rect x="${x}" y="${y - size}" height="${size * 1.6}" width="0"><animate attributeName="width" dur="${total}s" repeatCount="indefinite" calcMode="discrete" keyTimes="${kt.join(';')}" values="${vals.join(';')}"/></rect></clipPath>
<text x="${x}" y="${y}" class="${cls}" textLength="${r2(n * cw)}" lengthAdjust="spacing" clip-path="url(#${id}${i})">${esc(txt)}</text>
<rect x="${x + 2}" y="${y - size * 0.85}" width="${r2(cw * 0.9)}" height="${size * 1.05}" fill="${t.ink}" opacity="0"><animate attributeName="opacity" dur="${total}s" repeatCount="indefinite" calcMode="discrete" keyTimes="0;${r2(s / total).toFixed(4)};${r2((s + slot - 0.2) / total).toFixed(4)};1" values="0;1;0;0"/><animateTransform attributeName="transform" type="translate" dur="${total}s" repeatCount="indefinite" calcMode="discrete" keyTimes="${kt.join(';')}" values="${cur.map((v) => `${v} 0`).join(';')}"/></rect>`;
  });
  return out;
}

// ---------- Carte du Bénin en points ----------
// Contour simplifié (longitude, latitude). Assez juste pour la silhouette, pas pour un cadastre.
const BENIN = [
  [1.62, 6.22], [2.72, 6.36], [2.74, 7.0], [2.72, 7.9], [2.76, 8.6], [2.74, 9.05], [3.1, 9.1], [3.15, 9.6],
  [3.36, 9.85], [3.6, 10.3], [3.85, 10.45], [3.73, 10.85], [3.6, 11.1], [3.65, 11.5], [3.58, 11.7],
  [3.4, 11.88], [3.1, 12.1], [2.85, 12.38], [2.4, 11.95], [1.95, 11.5], [1.45, 11.42],
  [1.1, 11.2], [0.92, 11.0], [0.78, 10.6], [0.9, 10.35], [1.35, 10.0], [1.36, 9.5], [1.6, 9.05],
  [1.62, 8.5], [1.63, 7.6], [1.64, 6.9], [1.62, 6.22],
];
function inside([px, py], poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]; const [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// ================= 1. En-tête =================
write('header', (t) => {
  const W = 1200, H = 470;
  // carte
  const mx = 905, my = 40, mh = 390; // zone de la carte
  const sc = mh / (12.45 - 6.15);
  const P = (lon, lat) => [mx + (lon - 0.75) * sc, my + (12.45 - lat) * sc];
  const step = 9.5;
  const coto = P(2.42, 6.37);
  let dots = '';
  for (let lat = 12.45; lat > 6.15; lat -= step / sc) {
    for (let lon = 0.75; lon < 3.9; lon += step / sc) {
      if (!inside([lon, lat], BENIN)) continue;
      const [x, y] = P(lon, lat);
      const d = Math.hypot(x - coto[0], y - coto[1]);
      dots += `<circle cx="${r2(x)}" cy="${r2(y)}" r="2.4" style="animation-delay:${r2(0.6 + d / 260)}s,${r2(d / 180)}s"/>`;
    }
  }
  const css = `
.dots circle{fill:${t.ink};opacity:0;animation:pop .5s ease-out both,wave 7s ease-in-out infinite}
@keyframes pop{from{opacity:0}to{opacity:.22}}
@keyframes wave{0%,100%{opacity:.22}8%{opacity:.85}22%{opacity:.22}}
.ring{fill:none;stroke:${t.ink};stroke-width:1.5;transform-origin:${r2(coto[0])}px ${r2(coto[1])}px;animation:ring 2.8s ease-out infinite}
@keyframes ring{0%{transform:scale(.3);opacity:.9}100%{transform:scale(3.2);opacity:0}}
.up{opacity:0;animation:up .9s cubic-bezier(.2,.7,.2,1) both}
@keyframes up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.rule{stroke:${t.line};stroke-width:1;stroke-dasharray:720;stroke-dashoffset:720;animation:draw 1.4s .2s ease-out forwards}
@keyframes draw{to{stroke-dashoffset:0}}
.box{fill:${t.card};stroke:${t.line}}
`;
  const body = `
<text x="60" y="72" class="mono muted up" font-size="14" style="animation-delay:.1s">kenzoob  /  Cotonou, Bénin</text>
<text x="54" y="168" class="serif ink up" font-size="82" style="animation-delay:.25s">Kenzo O'Bryan</text>
<line x1="60" y1="196" x2="780" y2="196" class="rule"/>
<text x="60" y="236" class="sans muted up" font-size="20" style="animation-delay:.6s">Je suis dev à Cotonou. Je construis des outils autour des LLM,</text>
<text x="60" y="264" class="sans muted up" font-size="20" style="animation-delay:.7s">et surtout je vérifie qu'ils tiennent quand quelque chose casse.</text>
<g class="up" style="animation-delay:.9s">
<rect x="60" y="298" width="720" height="56" rx="10" class="box"/>
<text x="80" y="332" class="mono faint" font-size="15">en ce moment ›</text>
</g>
${typer('ty', [
    'un circuit breaker pour les appels LLM',
    'des évals pour voir quand un agent RAG invente',
    'un serveur MCP qui ne fait rien sans permission',
  ], { x: 212, y: 332, cw: 9.05, size: 15, cls: 'mono ink" font-size="15', t })}
<text x="60" y="412" class="mono faint up" font-size="13" style="animation-delay:1.1s">TypeScript  ·  Node.js  ·  Python  ·  Flutter  ·  C  ·  FastAPI  ·  React  ·  Docker</text>
<g class="dots">${dots}</g>
<circle cx="${r2(coto[0])}" cy="${r2(coto[1])}" r="6" class="ring"/>
<circle cx="${r2(coto[0])}" cy="${r2(coto[1])}" r="3.6" fill="${t.ink}"/>
<text x="${r2(coto[0] + 14)}" y="${r2(coto[1] + 5)}" class="mono ink" font-size="13">Cotonou</text>
<text x="${r2(coto[0] + 14)}" y="${r2(coto[1] + 22)}" class="mono faint" font-size="11">6.37°N  2.43°E</text>
`;
  return svg(W, H, t, css, body, "Kenzo O'Bryan, dev à Cotonou, Bénin");
});

// ================= 2. resilient-llm en action =================
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
.ko{fill:${t.ko}}.ok{fill:${t.ok}}
${ps.map((p) => p.css).join('\n')}
${win('b1', 15, 24)}${win('b2', 33, 41)}${win('b3', 50, 57)}${win('b4', 64, 96)}
${win('l1', 16, 96)}${win('l2', 34, 96)}${win('l3', 51, 96)}${win('l4', 65, 96)}
${win('f0', 0, 15)}${win('f1', 15.01, 33)}${win('f2', 33.01, 50)}${win('f3', 50.01, 96)}
${win('done', 80, 96)}
@keyframes dim{0%,52%{opacity:1}54%,95%{opacity:.35}100%{opacity:1}}.dim{animation:dim ${T}s linear infinite}
`;
  const badge = (cls, x, y, txt, color) => `<g class="${cls}"><rect x="${x}" y="${y - 15}" width="52" height="22" rx="11" fill="none" stroke="${color}"/><text x="${x + 26}" y="${y + 1}" text-anchor="middle" class="mono" font-size="13" fill="${color}">${txt}</text></g>`;
  const logs = [
    ['→ anthropic', '429', 'essai 1', 'on attend ≈ 500 ms, puis on réessaie', t.ko],
    ['→ anthropic', '503', 'essai 2', 'on attend ≈ 1 s', t.ko],
    ['→ anthropic', '503', 'essai 3', 'plus d’essai : on passe au fournisseur suivant', t.ko],
    ['→ openai', '200', 'ok', 'la réponse revient à l’app, sans que l’app ait rien vu', t.ok],
  ];
  const body = `
<text x="60" y="44" class="mono faint" font-size="13">resilient-llm  ·  exemple avec retries: 2, failureThreshold: 5</text>
<text x="60" y="74" class="sans ink" font-size="21">Ce qui se passe quand Anthropic répond mal à ton appel</text>
<path d="M${A[0]} ${A[1]}H${R1[0]}" class="wire"/>
<path d="M${R2[0]} ${R2[1]}L${AN[0]} ${AN[1]}" class="wire"/>
<path d="M${R2[0]} ${R2[1]}L${OA[0]} ${OA[1]}" class="wire d"/>
<rect x="60" y="150" width="190" height="50" rx="10" class="box"/>
<text x="155" y="181" text-anchor="middle" class="mono ink" font-size="15">ton app</text>
<text x="155" y="226" text-anchor="middle" class="mono done" font-size="13" fill="${t.ok}">✓ réponse reçue</text>
<rect x="440" y="140" width="270" height="70" rx="12" class="box"/>
<text x="575" y="170" text-anchor="middle" class="mono ink" font-size="16">resilient-llm</text>
<g class="mono faint" font-size="12" text-anchor="middle">
<text x="575" y="193" class="f0">échecs : 0/5   circuit fermé</text>
<text x="575" y="193" class="f1">échecs : 1/5   circuit fermé</text>
<text x="575" y="193" class="f2">échecs : 2/5   circuit fermé</text>
<text x="575" y="193" class="f3">échecs : 3/5   on bascule</text>
</g>
<g class="dim"><rect x="920" y="85" width="220" height="50" rx="10" class="box"/>
<text x="942" y="115" class="mono ink" font-size="15">Anthropic</text></g>
${badge('b1', 1076, 115, '429', t.ko)}${badge('b2', 1076, 115, '503', t.ko)}${badge('b3', 1076, 115, '503', t.ko)}
<rect x="920" y="215" width="220" height="50" rx="10" class="box"/>
<text x="942" y="245" class="mono ink" font-size="15">OpenAI</text>
${badge('b4', 1076, 245, '200', t.ok)}
${ps.map((p) => p.el).join('')}
<line x1="60" y1="290" x2="1140" y2="290" stroke="${t.line}"/>
${logs.map(([to, code, n, msg, col], i) => `<text y="${322 + i * 24}" class="mono l${i + 1}" font-size="13"><tspan x="60" class="muted">${esc(to)}</tspan><tspan x="200" fill="${col}">${code}</tspan><tspan x="250" class="faint">${n}</tspan><tspan x="340" class="ink">${esc(msg)}</tspan></text>`).join('\n')}
`;
  return svg(W, H, t, css, body, 'Animation : resilient-llm réessaie, puis bascule vers un autre fournisseur');
});

// ================= 3. Cartes de projets =================
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
<g transform="translate(400,24)">${motif}</g>
`;
  return svg(W, H, t, base, body, `${title} : ${lines.join(' ')}`);
}

write('card-resilient', (t) => card('resilient', t, {
  title: 'resilient-llm',
  lines: ['Des appels LLM qui ne lâchent pas', 'en prod : retries, circuit breaker,', 'fournisseur de secours, streaming.'],
  tags: 'TypeScript · npm · zéro dépendance · 70 tests',
  css: `@keyframes m1{0%{transform:translate(0,0);opacity:0}5%{opacity:1}35%{transform:translate(70px,0)}45%{transform:translate(70px,0)}65%{transform:translate(70px,60px)}95%{transform:translate(150px,60px);opacity:1}100%{transform:translate(150px,60px);opacity:0}}
.m1{animation:m1 3.2s ease-in-out infinite}
@keyframes x1{0%,30%{opacity:.2}36%,48%{opacity:1}60%,100%{opacity:.2}}.x1{animation:x1 3.2s linear infinite}`,
  motif: `<line x1="0" y1="50" x2="160" y2="50" stroke="${t.line}" stroke-dasharray="4 4"/><line x1="0" y1="110" x2="160" y2="110" stroke="${t.line}" stroke-dasharray="4 4"/>
<g class="x1" stroke="${t.ko}" stroke-width="2.5"><line x1="84" y1="40" x2="100" y2="60"/><line x1="100" y1="40" x2="84" y2="60"/></g>
<circle cx="6" cy="50" r="6" fill="${t.ink}" class="m1"/>
<text x="0" y="30" class="mono faint" font-size="11">anthropic</text><text x="0" y="135" class="mono faint" font-size="11">openai</text>`,
}));

write('card-evals', (t) => {
  const data = [['corr.', 95, 60], ['cit.', 55, 60], ['abst.', 0, 100], ['inj.', 0, 0]];
  let m = '', css = '';
  data.forEach(([lab, a, b], i) => {
    const x = i * 42;
    const ha = Math.max(2, a * 1.1), hb = Math.max(2, b * 1.1);
    m += `<rect x="${x}" y="${120 - ha}" width="14" height="${ha}" fill="${t.faint}" class="g" style="animation-delay:${i * 0.15}s"/>
<rect x="${x + 16}" y="${120 - hb}" width="14" height="${hb}" fill="${t.ink}" class="g" style="animation-delay:${i * 0.15 + 0.1}s"/>
<text x="${x + 15}" y="138" text-anchor="middle" class="mono faint" font-size="10">${lab}</text>`;
  });
  m += `<text x="0" y="158" class="mono faint" font-size="10">▪ v1   </text><text x="48" y="158" class="mono ink" font-size="10">▪ v2</text>`;
  css = `.g{transform-box:fill-box;transform-origin:bottom;animation:g 4s cubic-bezier(.2,.7,.2,1) infinite}@keyframes g{0%{transform:scaleY(0)}25%,85%{transform:scaleY(1)}100%{transform:scaleY(0)}}`;
  return card('evals', t, {
    title: 'agent-evals',
    lines: ['Un agent RAG sur la doc Node.js,', 'et 30 cas de test pour savoir', 'si on peut le croire.'],
    tags: 'TypeScript · LLM-as-judge · injections · CI',
    css, motif: m,
  });
});

write('card-mcp', (t) => {
  const labels = ['lecture seule', 'allowlist', 'validation', 'contenu marqué'];
  let m = '';
  labels.forEach((l, i) => {
    const p = i * 14;
    m += `<rect x="${p}" y="${p}" width="${160 - 2 * p}" height="${160 - 2 * p}" rx="${12 - i * 2}" class="st ly" style="animation-delay:${i * 0.45}s"/>`;
  });
  m += `<circle cx="80" cy="80" r="7" fill="${t.ink}" class="core"/>`;
  return card('mcp', t, {
    title: 'github-triage-mcp',
    lines: ['Un serveur MCP pour trier les issues', 'GitHub sans donner les clés du dépôt', 'à l’IA. Quatre couches de sécurité.'],
    tags: 'MCP · TypeScript · lecture seule par défaut',
    css: `.ly{stroke-width:1.5;opacity:.18;animation:ly 4s ease-in-out infinite}@keyframes ly{0%,100%{opacity:.18}12%,60%{opacity:1}}
.core{transform-origin:480px 104px;animation:core 4s ease-in-out infinite}@keyframes core{0%,40%{opacity:.4}55%,80%{opacity:1}100%{opacity:.4}}`,
    motif: m,
  });
});

write('card-serp', (t) => {
  // rangs Google -> Bing (exemple illustratif)
  const map = [2, 0, 5, 1, 9, 3, 4, 8, 6, 7];
  let m = '';
  for (let i = 0; i < 10; i++) {
    m += `<rect x="0" y="${i * 15}" width="${38 - i * 2}" height="8" rx="2" fill="${t.ink}" opacity=".8"/>`;
    m += `<rect x="${122 + i * 2}" y="${map[i] * 15}" width="${38 - i * 2}" height="8" rx="2" fill="${t.faint}"/>`;
    m += `<path d="M42 ${i * 15 + 4}C80 ${i * 15 + 4} 80 ${map[i] * 15 + 4} 118 ${map[i] * 15 + 4}" class="st ln" stroke-width="1" style="animation-delay:${i * 0.12}s"/>`;
  }
  m += `<text x="0" y="168" class="mono faint" font-size="10">Google</text><text x="128" y="168" class="mono faint" font-size="10">Bing</text>`;
  return card('serp', t, {
    title: 'serp-compare',
    lines: ['Le top 10 de Google et de Bing', 'côte à côte pour une même recherche.', 'Cache 24 h, démo sans clé d’API.'],
    tags: 'TypeScript · Docker · rate limiting',
    css: `.ln{stroke-dasharray:140;stroke-dashoffset:140;opacity:.6;animation:ln 4.5s ease-out infinite}@keyframes ln{0%{stroke-dashoffset:140}35%,85%{stroke-dashoffset:0}100%{stroke-dashoffset:0;opacity:0}}`,
    motif: m,
  });
});

write('card-radar', (t) => {
  const blips = [[40, -35, 0.6], [-50, 20, 1.6], [25, 52, 2.4], [-20, -55, 3.2], [60, 15, 0.2]];
  let m = `<g transform="translate(80,80)">`;
  for (const r of [26, 52, 76]) m += `<circle r="${r}" fill="none" stroke="${t.line}"/>`;
  m += `<line x1="-78" y1="0" x2="78" y2="0" stroke="${t.line}"/><line x1="0" y1="-78" x2="0" y2="78" stroke="${t.line}"/>`;
  m += `<g class="sw"><path d="M0 0L76 0A76 76 0 0 0 65.8 -38Z" fill="${t.ink}" opacity=".18"/><line x1="0" y1="0" x2="76" y2="0" stroke="${t.ink}" stroke-width="1.5"/></g>`;
  for (const [x, y, d] of blips) m += `<circle cx="${x}" cy="${y}" r="3.5" fill="${t.ink}" class="bl" style="animation-delay:${d}s"/>`;
  m += `</g>`;
  return card('radar', t, {
    title: 'radartech',
    lines: ['Ma veille tech à moi : actus IA,', 'emploi remote, bourses, financements.', 'Trié et vérifié automatiquement.'],
    tags: 'Python · FastAPI · React · Docker',
    css: `.sw{transform-origin:0 0;animation:sw 4s linear infinite}@keyframes sw{to{transform:rotate(-360deg)}}
.bl{opacity:0;animation:bl 4s ease-out infinite}@keyframes bl{0%{opacity:0}5%{opacity:1}60%{opacity:.15}100%{opacity:0}}`,
    motif: m,
  });
});

write('card-engine', (t) => card('engine', t, {
  title: 'my-engine',
  lines: ['Un petit moteur de jeu 2D', 'en JavaScript, pour des jeux web', 'simples. Publié sur npm.'],
  tags: 'JavaScript · Canvas · npm',
  css: `.bx{transform-box:fill-box;transform-origin:bottom center;animation:bx 1.4s cubic-bezier(.4,0,.6,1) infinite}
@keyframes bx{0%,100%{transform:translateY(0) scale(1.25,.75)}12%{transform:translateY(0) scale(1,1)}50%{transform:translateY(-92px) scale(.92,1.08)}88%{transform:translateY(0) scale(1,1)}}
.sh{transform-box:fill-box;transform-origin:center;animation:sh 1.4s cubic-bezier(.4,0,.6,1) infinite}@keyframes sh{0%,100%{transform:scaleX(1);opacity:.5}50%{transform:scaleX(.45);opacity:.15}}`,
  motif: `<line x1="10" y1="150" x2="150" y2="150" stroke="${t.line}"/>
<ellipse cx="80" cy="152" rx="20" ry="3" fill="${t.ink}" class="sh"/>
<rect x="66" y="122" width="28" height="28" rx="3" fill="${t.ink}" class="bx"/>
${[0, 1, 2, 3, 4, 5, 6].map((i) => `<rect x="${12 + i * 20}" y="154" width="16" height="4" fill="${t.line}"/>`).join('')}`,
}));

// ================= 4. Ce que j'ai appris en mesurant =================
write('evals-story', (t) => {
  const W = 1200, H = 300;
  const rows = [['Réponses justes', 95, 60, 'hausse'], ['Citations exactes', 55, 60], ['Dit « je ne sais pas » hors sujet', 0, 100], ['Injections qui passent (plus bas = mieux)', 0, 0]];
  let b = '', css = '';
  rows.forEach(([lab, v1, v2], i) => {
    const y = 96 + i * 46;
    b += `<text x="60" y="${y + 12}" class="sans ink" font-size="15">${esc(lab)}</text>`;
    b += `<rect x="440" y="${y}" width="560" height="6" rx="3" fill="${t.line}" opacity=".6"/>`;
    b += `<rect x="440" y="${y}" width="${Math.max(3, v1 * 5.6)}" height="6" rx="3" fill="${t.faint}" class="gr" style="animation-delay:${0.2 + i * 0.15}s"/>`;
    b += `<rect x="440" y="${y + 10}" width="560" height="6" rx="3" fill="${t.line}" opacity=".6"/>`;
    b += `<rect x="440" y="${y + 10}" width="${Math.max(3, v2 * 5.6)}" height="6" rx="3" fill="${t.ink}" class="gr" style="animation-delay:${0.35 + i * 0.15}s"/>`;
    b += `<text x="1020" y="${y + 7}" class="mono faint" font-size="12">v1 ${v1} %</text><text x="1020" y="${y + 18}" class="mono ink" font-size="12">v2 ${v2} %</text>`;
  });
  css = `.gr{transform-box:fill-box;transform-origin:left;animation:gr 1.6s cubic-bezier(.2,.7,.2,1) both}@keyframes gr{from{transform:scaleX(0)}to{transform:scaleX(1)}}`;
  const body = `
<text x="60" y="44" class="mono faint" font-size="13">agent-evals  ·  30 cas  ·  gemini-3.1-flash-lite  ·  octobre 2026</text>
<text x="60" y="70" class="sans ink" font-size="20">v1 = prompt simple, v2 = prompt durci</text>
${b}
<text x="60" y="282" class="mono faint" font-size="12">▪ v1</text><text x="110" y="282" class="mono ink" font-size="12">▪ v2</text>
`;
  return svg(W, H, t, css, body, "Résultats d'agent-evals, v1 contre v2");
});

// ================= 5. Pied de page =================
write('footer', (t) => {
  const W = 1200, H = 120;
  // une trace : ligne plate, une impulsion qui la traverse
  const css = `.tr{stroke:${t.line};stroke-width:1.5;fill:none}
.pu{stroke:${t.ink};stroke-width:2;fill:none;stroke-dasharray:90 1400;animation:pu 4s linear infinite}@keyframes pu{from{stroke-dashoffset:90}to{stroke-dashoffset:-1400}}`;
  const d = `M0 50H520L540 50L552 22L566 78L580 34L590 50H1200`;
  const body = `<path d="${d}" class="tr"/><path d="${d}" class="pu"/>
<text x="600" y="102" text-anchor="middle" class="mono faint" font-size="13">kenzoob  ·  Cotonou, Bénin  ·  UTC+1</text>`;
  return svg(W, H, t, css, body, 'Pied de page');
});

console.log('SVG générés dans', OUT);
