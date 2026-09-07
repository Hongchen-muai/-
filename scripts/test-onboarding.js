import assert from 'node:assert/strict';
import { isTourDismissed, saveTourPreference, tourLayout, TOUR_STORAGE_KEY } from '../src/onboarding/tour.js';

let stored = null;
const storage = {
  getItem(key) { assert.equal(key, TOUR_STORAGE_KEY); return stored; },
  setItem(key, value) { assert.equal(key, TOUR_STORAGE_KEY); stored = value; },
  removeItem(key) { assert.equal(key, TOUR_STORAGE_KEY); stored = null; }
};
assert.equal(isTourDismissed(storage), false);
assert.equal(saveTourPreference(storage, true), true);
assert.equal(isTourDismissed(storage), true);
assert.equal(saveTourPreference(storage, false), true);
assert.equal(isTourDismissed(storage), false);
for (const value of ['{', 'null', 'true', '{"dismissed":true}', '{"version":2,"dismissed":true}', '{"version":1,"dismissed":"true"}']) {
  stored = value;
  assert.equal(isTourDismissed(storage), false);
}
const denied = new Proxy({}, { get() { throw new Error('Storage denied'); } });
for (const unavailable of [undefined, null, denied]) {
  assert.equal(isTourDismissed(unavailable), false);
  assert.equal(saveTourPreference(unavailable, true), false);
  assert.equal(saveTourPreference(unavailable, false), false);
}

const area = r => r.width * r.height;
const intersection = (a, b) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
  * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
let cases = 0;
for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1024, 768], [1280, 720], [1440, 900], [1920, 1080], [844, 390]]) {
  const scenarios = [
    [],
    [{ x: 10, y: 16, width: width - 20, height: 430 }],
    [{ x: 24, y: 120, width: width * 0.33, height: 468 }, { x: width * 0.66, y: 120, width: width * 0.33 - 24, height: 520 }],
    [{ x: width * 0.4, y: 120, width: 140, height: 44 }],
    [{ x: 10, y: -200, width: width - 20, height: 400 }],
    [{ x: -100, y: -100, width: 40, height: 40 }],
    [{ x: 10, y: 100, width: 200, height: 100 }, { x: 100, y: 130, width: 200, height: 140 }]
  ];
  for (const targets of scenarios) {
    const { panel, holes, tiles } = tourLayout(width, height, targets);
    for (const rect of [panel, ...holes, ...tiles]) {
      assert.ok(Object.values(rect).every(Number.isFinite));
      assert.ok(rect.x >= 0 && rect.y >= 0 && rect.width > 0 && rect.height > 0);
      assert.ok(rect.x + rect.width <= width + 1e-6 && rect.y + rect.height <= height + 1e-6);
    }
    for (const hole of holes) {
      assert.ok(intersection(panel, hole) < 1e-6, 'The explanation must not cover its spotlight');
      for (const tile of tiles) assert.ok(intersection(tile, hole) < 1e-6, 'The spotlight must remain unblurred');
    }
    for (let i = 0; i < tiles.length; i++) {
      for (let j = i + 1; j < tiles.length; j++) assert.ok(intersection(tiles[i], tiles[j]) < 1e-6);
    }
    const overlap = holes.length === 2 ? intersection(holes[0], holes[1]) : 0;
    const covered = [...tiles, ...holes].reduce((sum, r) => sum + area(r), 0) - overlap;
    assert.ok(Math.abs(covered - width * height) < 1e-5, 'No unmasked gaps outside the spotlight');
    cases++;
  }
}
console.log(`Onboarding: storage preferences and ${cases} responsive spotlight layouts passed.`);
