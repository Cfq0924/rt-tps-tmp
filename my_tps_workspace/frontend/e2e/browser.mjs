/**
 * Zero-dependency browser harness for interactive exploration and smoke
 * tests of the TPS frontend (CDP over headless Chrome, Node >= 22).
 *
 * Why: ad-hoc CDP scripts with fixed sleeps are slow and brittle — element
 * lookups fail mid-render, crashes blank the page silently, and every new
 * session re-invents event synthesis. This harness provides:
 *
 *   - persistent Chrome reuse (launch once, connect from every command)
 *   - auto-waiting interactions (waitFor/settle) instead of fixed sleeps
 *   - realistic event sequences (pointer+mouse, React native setters)
 *   - a page-side error ring buffer (`__errs`) surfaced on every failure
 *   - screenshots and a small step-runner for repeatable smoke scripts
 *
 * Usage:
 *   node e2e/browser.mjs launch [--url URL]   start/reuse Chrome + open app
 *   node e2e/browser.mjs close                shut the managed Chrome down
 *   node e2e/browser.mjs eval "<js expr>"     run async snippet, print JSON
 *   node e2e/browser.mjs shot [name]          screenshot → e2e/shots/
 *   node e2e/browser.mjs console              print captured page errors
 *   node e2e/browser.mjs run <file.mjs>       run a step script (see smoke)
 *   node e2e/browser.mjs probe                page/health/console snapshot
 *
 * Env: E2E_PORT (9223), E2E_URL (http://localhost:5173/viewer/1),
 *      CHROME_BIN (google-chrome), E2E_HEADED=1 to watch.
 *
 * eval contract: the snippet body runs inside an async function — use
 * `return` to produce output. `window.__h` (aliased `h`) exposes:
 *   sleep, waitFor(fn,{timeout}), settle({idleMs}), click(el), clickText(sel,text),
 *   select(label, option), fill(label, value), byText(sel,text), all(sel),
 *   inputByLabel(label), button(text), text(), errs()
 * The legacy names (setInput, selectByLabel) are kept as aliases.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = Number(process.env.E2E_PORT ?? 9223);
const APP_URL = process.env.E2E_URL ?? 'http://localhost:5173/viewer/1';
const CHROME_BIN = process.env.CHROME_BIN ?? 'google-chrome';
const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(HERE, 'shots');
const DATA_DIR = join(HERE, '.chrome-profile');

const TOOLKIT = `
window.__errs = window.__errs ?? [];
if (!window.__errsHooked) {
  window.__errsHooked = true;
  window.addEventListener('error', e => {
    window.__errs.push(String(e.message).slice(0, 300));
    if (window.__errs.length > 60) window.__errs.shift();
  });
  window.addEventListener('unhandledrejection', e => {
    window.__errs.push('unhandled: ' + String(e.reason?.message ?? e.reason).slice(0, 300));
    if (window.__errs.length > 60) window.__errs.shift();
  });
  const orig = console.error.bind(console);
  console.error = (...a) => {
    window.__errs.push(a.map(x => String(x?.message ?? x).slice(0, 200)).join(' '));
    if (window.__errs.length > 60) window.__errs.shift();
    orig(...a);
  };
}

window.__h = {
  sleep: ms => new Promise(r => setTimeout(r, ms)),
  errs: () => [...window.__errs],

  async waitFor(fn, { timeout = 8000, step = 120 } = {}) {
    const t0 = Date.now();
    for (;;) {
      let v;
      try { v = await fn(); } catch { v = null; }
      if (v) return v === true ? (Date.now() - t0) : v;
      if (Date.now() - t0 > timeout) {
        throw new Error('waitFor timeout: ' + (fn.toString().slice(0, 120)));
      }
      await this.sleep(step);
    }
  },

  // wait until the DOM stops mutating for idleMs (React render settled)
  settle({ idleMs = 250, timeout = 6000 } = {}) {
    return new Promise(resolve => {
      let timer = null;
      const finish = () => { if (!done) { done = true; mo.disconnect(); clearTimeout(hard); resolve(); } };
      let done = false;
      const mo = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(finish, idleMs); });
      mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
      timer = setTimeout(finish, idleMs);
      const hard = setTimeout(finish, timeout);
    });
  },

  all: sel => [...document.querySelectorAll(sel)],
  byText(sel, text) {
    const t = String(text).trim();
    const els = this.all(sel);
    return els.find(el => el.textContent.trim() === t)
      ?? els.find(el => el.textContent.trim().includes(t))
      ?? null;
  },

  inputByLabel(label) {
    const forms = this.all('.MuiFormControl-root');
    const f = forms.find(x => (x.querySelector('.MuiInputLabel-root')?.textContent ?? '').trim() === label)
      ?? forms.find(x => (x.querySelector('.MuiInputLabel-root')?.textContent ?? '').includes(label));
    return f ? (f.querySelector('input') ?? f.querySelector('textarea')) : null;
  },

  button(text) { return this.byText('button', text); },

  // dispatch a realistic event sequence at the element's center
  fire(el, type, coords) {
    const r = el.getBoundingClientRect();
    const x = coords?.x ?? r.x + r.width / 2;
    const y = coords?.y ?? r.y + r.height / 2;
    const init = { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, pointerId: 1, isPrimary: true };
    if (type.startsWith('pointer')) el.dispatchEvent(new PointerEvent(type, { ...init, buttons: 1 }));
    else el.dispatchEvent(new MouseEvent(type, { ...init }));
  },

  async click(el, { settle = true } = {}) {
    if (!el) throw new Error('click: element not found');
    el.scrollIntoView({ block: 'center' });
    await this.sleep(40);
    // hit-test: something must actually receive the click at the center
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    if (!hit || !(hit === el || el.contains(hit) || hit.contains(el))) {
      throw new Error('click: center of element is covered (by ' + (hit?.tagName ?? 'nothing') + ')');
    }
    this.fire(el, 'pointerdown'); this.fire(el, 'mousedown');
    this.fire(el, 'pointerup'); this.fire(el, 'mouseup'); this.fire(el, 'click');
    if (settle) await this.settle();
    return el;
  },

  async clickText(sel, text) { return this.click(this.byText(sel, text)); },

  setInput(el, value) {
    if (!el) throw new Error('setInput: element not found');
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, String(value));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  },

  async fill(label, value) {
    const el = this.inputByLabel(label);
    if (!el) throw new Error('fill: no input labelled "' + label + '"');
    this.setInput(el, value);
    await this.settle();
    return el;
  },

  async select(label, optionText) {
    const forms = this.all('.MuiFormControl-root');
    const f = forms.find(x => (x.querySelector('.MuiInputLabel-root')?.textContent ?? '').trim() === label);
    if (!f) throw new Error('select: no field labelled "' + label + '"');
    const div = f.querySelector('[role="combobox"], .MuiSelect-select') ?? f.querySelector('input');
    this.fire(div, 'mousedown'); this.fire(div, 'click');
    const opt = await this.waitFor(() =>
      this.all('li[role="option"]').find(o => o.textContent.trim() === optionText)
      ?? this.all('li[role="option"]').find(o => o.textContent.trim().includes(optionText)));
    await this.click(opt, { settle: false });
    await this.settle();
    return true;
  },

  text() { return document.body.innerText; },
};
// legacy aliases
window.__h.selectByLabel = window.__h.select;
'__h ready';
`;

class Cdp {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); }

  static cdpPortUp() {
    return fetch(`http://127.0.0.1:${PORT}/json/version`).then(r => r.ok).catch(() => false);
  }

  static async connect({ navigate = false } = {}) {
    for (let i = 0; i < 40; i++) {
      if (await Cdp.cdpPortUp()) break;
      await sleep(250);
    }
    const pages = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const httpPages = pages.filter(t => t.type === 'page' && t.url.startsWith('http'));
    const page = httpPages.at(0) ?? pages.find(t => t.type === 'page');
    if (!page) throw new Error('no browser page — run: node e2e/browser.mjs launch');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const cdp = new Cdp(ws);
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id && cdp.pending.has(m.id)) { cdp.pending.get(m.id)(m); cdp.pending.delete(m.id); }
    };
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    if (navigate || !page.url.includes('/viewer/')) {
      await cdp.send('Page.navigate', { url: APP_URL });
      await cdp.waitForReady();
    }
    await cdp.ensureToolkit();
    return cdp;
  }

  send(method, params = {}) {
    return new Promise((res, rej) => {
      const id = ++this.id;
      this.pending.set(id, m => (m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result)));
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expr, { awaitPromise = true, timeout = 60000 } = {}) {
    const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise, returnByValue: true, timeout });
    if (r.exceptionDetails) {
      let errs = [];
      try { errs = await this.eval('window.__errs.slice(-5)', { awaitPromise: false }); } catch {}
      const desc = (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text).split('\n').slice(0, 3).join(' | ');
      throw new Error(`page: ${desc}${errs.length ? '\nrecent page errors:\n  ' + errs.join('\n  ') : ''}`);
    }
    return r.result.value;
  }

  async ensureToolkit() {
    const has = await this.eval('typeof window.__h', { awaitPromise: false });
    if (has !== 'object') await this.eval(TOOLKIT, { awaitPromise: false });
  }

  async waitForReady({ timeout = 30000 } = {}) {
    const t0 = Date.now();
    for (;;) {
      try {
        const v = await this.eval(
          "document.readyState === 'complete' && (document.querySelector('#root')?.children.length ?? 0) > 0",
          { awaitPromise: false });
        if (v === true) return;
      } catch {}
      if (Date.now() - t0 > timeout) throw new Error('app did not become ready');
      await sleep(400);
    }
  }

  async shot(name = 'shot') {
    const v = await this.send('Page.captureScreenshot', { format: 'png' });
    mkdirSync(SHOTS, { recursive: true });
    const file = join(SHOTS, `${name.replace(/[^\w-]/g, '_')}.png`);
    writeFileSync(file, Buffer.from(v.data, 'base64'));
    return file;
  }
}

// ---------- commands ----------

async function launch() {
  const fresh = process.argv.includes('--fresh');
  if (fresh && !(await Cdp.cdpPortUp())) {
    rmSync(DATA_DIR, { recursive: true, force: true });
  }
  if (await Cdp.cdpPortUp()) {
    console.log(`chrome already up on :${PORT}`);
  } else {
    mkdirSync(DATA_DIR, { recursive: true });
    const args = [
      '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
      '--enable-gpu', '--ignore-gpu-blocklist',
      `--remote-debugging-port=${PORT}`, `--user-data-dir=${DATA_DIR}`,
      '--window-size=1500,950', 'about:blank',
    ];
    if (process.env.E2E_HEADED === '1') args[0] = '--headed';
    const child = spawn(CHROME_BIN, args, { stdio: 'ignore', detached: true });
    child.unref();
    for (let i = 0; i < 40 && !(await Cdp.cdpPortUp()); i++) await sleep(250);
    console.log(`chrome launched on :${PORT} (pid ${child.pid})`);
  }
  const cdp = await Cdp.connect({ navigate: true });
  await cdp.eval(TOOLKIT, { awaitPromise: false });
  console.log('app ready at', APP_URL);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'launch') return launch();
  if (cmd === 'close') {
    const up = await Cdp.cdpPortUp();
    if (!up) return console.log('not running');
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
    const ws = new WebSocket(list.webSocketDebuggerUrl);
    await new Promise(res => { ws.onopen = res; ws.onerror = res; });
    ws.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
    await sleep(500);
    return console.log('chrome closed');
  }
  if (cmd === 'eval') {
    const expr = rest[0];
    if (!expr) { console.error('usage: eval "<js>"'); process.exit(1); }
    const cdp = await Cdp.connect({ navigate: true });
    const out = await cdp.eval(`(async () => { const { sleep } = window.__h; ${expr} })()`);
    console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 1));
    return;
  }
  if (cmd === 'shot') {
    const cdp = await Cdp.connect({ navigate: true });
    console.log('saved', await cdp.shot(rest[0] ?? 'shot'));
    return;
  }
  if (cmd === 'console') {
    const cdp = await Cdp.connect();
    const errs = await cdp.eval('window.__errs ?? []', { awaitPromise: false });
    console.log(errs.length ? errs.join('\n') : '(no page errors captured)');
    return;
  }
  if (cmd === 'probe') {
    const cdp = await Cdp.connect({ navigate: true });
    const info = await cdp.eval(`({
      url: location.href,
      ready: document.readyState,
      rootChildren: document.querySelector('#root')?.children.length ?? -1,
      tabs: [...document.querySelectorAll('.MuiTab-root')].map(t => t.textContent),
      errs: (window.__errs ?? []).slice(-5),
    })`);
    console.log(JSON.stringify(info, null, 1));
    return;
  }
  if (cmd === 'run') {
    const file = rest[0];
    if (!file) { console.error('usage: run <steps.mjs>'); process.exit(1); }
    const mod = await import(new URL(file, `file://${HERE}/`).href);
    const steps = mod.default;
    const cdp = await Cdp.connect({ navigate: true });
    let failed = 0;
    for (const step of steps) {
      const t0 = Date.now();
      try {
        const out = await cdp.eval(`(async () => { const h = window.__h; ${step.do} })()`);
        const ok = step.expect ? !!step.expect(out) : out !== undefined && out !== false;
        if (!ok) throw new Error('expectation failed: ' + JSON.stringify(out)?.slice(0, 200));
        console.log(`✔ ${step.name} (${Date.now() - t0}ms)`);
        if (step.shot) console.log('  ', await cdp.shot(step.shot));
      } catch (e) {
        failed++;
        console.log(`✗ ${step.name} (${Date.now() - t0}ms)\n  ${String(e.message).slice(0, 600)}`);
        try { console.log('  ', await cdp.shot(`fail-${step.name.replace(/\W+/g, '_')}`)); } catch {}
        if (step.stop) break;
      }
    }
    console.log(failed ? `${failed} step(s) failed` : 'all steps passed');
    process.exit(failed ? 1 : 0);
  }
  console.log('usage: launch | close | eval "<js>" | shot [name] | console | probe | run <file.mjs>');
  process.exit(1);
}

main().then(() => process.exit(0)).catch(e => { console.error('E2E ERROR:', e.message); process.exit(2); });
