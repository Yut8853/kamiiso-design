import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { readSafeViewport, getPopoverArea, placePopover } from '../assets/js/viewport.js';

// These are geometry/event tests, not browser or physical-device emulation.
function viewportFixture(t, { width, height, insets = {}, visual }) {
  const names = ['window', 'document', 'getComputedStyle'];
  const previous = names.map(name => Object.getOwnPropertyDescriptor(globalThis, name));
  t.after(() => names.forEach((name, index) => {
    if (previous[index]) Object.defineProperty(globalThis, name, previous[index]);
    else delete globalThis[name];
  }));
  globalThis.window = { innerHeight: height, visualViewport: visual };
  globalThis.document = { documentElement: { clientWidth: width } };
  globalThis.getComputedStyle = () => ({
    getPropertyValue: name => `${insets[name.replace('--safe-area-', '')] ?? 0}px`,
  });
}

test('safe viewport excludes gesture bar and notch in portrait', t => {
  viewportFixture(t, { width: 393, height: 852, insets: { top: 59, bottom: 34 } });
  assert.deepEqual(readSafeViewport(), { left: 0, top: 59, right: 393, bottom: 818 });
});

test('landscape respects asymmetric left/right safe areas', t => {
  viewportFixture(t, { width: 852, height: 393, insets: { left: 59, right: 24, bottom: 21 } });
  assert.deepEqual(readSafeViewport(), { left: 59, top: 0, right: 828, bottom: 372 });
});

test('visual viewport accounts for browser UI/keyboard without double-counting insets', t => {
  viewportFixture(t, {
    width: 393, height: 852, insets: { top: 59, bottom: 34 },
    visual: { offsetLeft: 0, offsetTop: 0, width: 393, height: 480 },
  });
  assert.deepEqual(readSafeViewport(), { left: 0, top: 59, right: 393, bottom: 480 });
  window.visualViewport = { offsetLeft: 90, offsetTop: 80, width: 200, height: 380 };
  assert.deepEqual(readSafeViewport(), { left: 90, top: 80, right: 290, bottom: 460 });
});

test('zero safe insets preserve desktop viewport bounds', t => {
  viewportFixture(t, { width: 1425, height: 900 });
  assert.deepEqual(readSafeViewport(), { left: 0, top: 0, right: 1425, bottom: 900 });
});

test('insets and visual viewport are read again after rotation/UI changes', t => {
  const insets = { bottom: 0 };
  viewportFixture(t, { width: 412, height: 915, insets });
  assert.equal(readSafeViewport().bottom, 915);
  insets.bottom = 24;
  assert.equal(readSafeViewport().bottom, 891);
  document.documentElement.clientWidth = 915;
  window.innerHeight = 412;
  insets.left = 32;
  assert.deepEqual(readSafeViewport(), { left: 32, top: 0, right: 915, bottom: 388 });
});

const scenarios = [
  { width: 320, height: 568, left: 0, right: 0, top: 0, bottom: 24 },
  { width: 393, height: 852, left: 0, right: 0, top: 59, bottom: 34 },
  { width: 412, height: 915, left: 0, right: 0, top: 32, bottom: 24 },
  { width: 852, height: 393, left: 59, right: 59, top: 0, bottom: 21 },
  { width: 915, height: 412, left: 32, right: 0, top: 0, bottom: 24 },
  { width: 1024, height: 768, left: 0, right: 0, top: 0, bottom: 0 },
  { width: 1440, height: 900, left: 0, right: 0, top: 0, bottom: 0 },
];

test('cards remain within frame, safe viewport and header across 189 placements', () => {
  let count = 0;
  for (const s of scenarios) {
    const viewport = { left: s.left, top: s.top, right: s.width - s.right, bottom: s.height - s.bottom };
    const frame = { left: s.left + 25, top: 40, right: s.width - s.right - 25, bottom: 720 };
    const area = getPopoverArea(frame, viewport, s.top + 80);
    assert(area.width > 80 && area.height > 80);
    for (const x of [0, 0.5, 1]) for (const y of [0, 0.5, 1]) for (const height of [70, 240, 1000]) {
      const anchor = { left: frame.left + x * (frame.right - frame.left - 60), width: 60,
        top: frame.top + y * (frame.bottom - frame.top - 50) };
      anchor.bottom = anchor.top + 50;
      const width = Math.min(400, area.width);
      const card = placePopover(area, anchor, width, height);
      const actualHeight = Math.min(height, card.maxHeight);
      assert(card.left >= area.left && card.left + width <= area.right + 0.01);
      assert(card.top >= area.top && card.top + actualHeight <= area.bottom + 0.01);
      if (height > area.height) assert(actualHeight < height, 'long cards must scroll');
      count++;
    }
  }
  assert.equal(count, 189);
});

test('edge tap scrolls into safe space and remains open; second tap and outside tap close', () => {
  const code = readFileSync(new URL('../assets/js/site.js', import.meta.url), 'utf8');
  const start = code.indexOf('function initializeKeywordPopovers()');
  const end = code.indexOf('\nconst showLoadingScreen', start);
  const handlers = {}, documentHandlers = {}, styles = {};
  let boardTop = 800;
  let scrollCalls = 0;
  const panel = { hidden: true, offsetWidth: 300, offsetHeight: 200,
    classList: { toggle() {} }, style: { setProperty: (k, v) => styles[k] = parseFloat(v), removeProperty: k => delete styles[k] } };
  const button = {
    setAttribute() {}, addEventListener: (key, fn) => handlers[key] = fn,
    getBoundingClientRect: () => ({ left: 40, width: 120, top: boardTop + 20, bottom: boardTop + 65 }),
    scrollIntoView() { boardTop = 220; scrollCalls++; },
  };
  const item = { classList: { toggle() {} }, querySelector: selector => selector.endsWith('__trigger') ? button : panel };
  const board = { querySelectorAll: () => [item], contains: target => target === button,
    getBoundingClientRect: () => ({ left: 25, right: 368, top: boardTop, bottom: boardTop + 670 }) };
  const context = vm.createContext({
    document: { querySelector: selector => selector === '.keyword-composition' ? board : { getBoundingClientRect: () => ({ bottom: 139 }) },
      addEventListener: (name, fn) => documentHandlers[name] = fn },
    window: { matchMedia: () => ({ matches: false, addEventListener() {} }), addEventListener() {} },
    requestAnimationFrame: () => 1,
    readSafeViewport: () => ({ left: 0, right: 393, top: 59, bottom: 818 }), getPopoverArea, placePopover,
  });
  vm.runInContext(code.slice(start, end) + '\ninitializeKeywordPopovers();', context);
  const click = () => handlers.click({ preventDefault() {} });
  click();
  assert.equal(scrollCalls, 1);
  assert.equal(panel.hidden, false);
  assert(boardTop + styles['--panel-top'] + Math.min(200, styles['--panel-max-height']) <= 806);
  click(); assert.equal(panel.hidden, true);
  click(); assert.equal(panel.hidden, false);
  documentHandlers.pointerdown({ target: {} }); assert.equal(panel.hidden, true);
});
