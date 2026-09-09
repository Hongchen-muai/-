import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { annotationHelp, placeHelp, projectionHelp } from '../src/ui/projectionHelp.js';
import { PROJECTION_MODES } from '../src/core/mapMath.js';

const tour = readFileSync(new URL('../src/components/OnboardingTour.vue', import.meta.url), 'utf8');
assert.doesNotMatch(tour, /openTimer|setTimeout\(open|isTourDismissed|localStorage/);
const tooltip = readFileSync(new URL('../src/components/ContextHelp.vue', import.meta.url), 'utf8');
assert.match(tooltip, /HOVER_DELAY = 800/);
assert.match(tooltip, /if \(!keyboardMode\) return/);
assert.equal(PROJECTION_MODES.compromise.label, '任意投影');
assert.match(annotationHelp('O', 'cylinder'), /不是真实光源|不是该圆柱投影的真实光源/);
assert.match(annotationHelp('O', 'planar'), /对跖点/);
assert.match(annotationHelp('P=G=M', 'cylinder'), /位置重合/);
assert.match(projectionHelp('planar', 'equalArea').standardCircleDistance, /不因.*改变/);
assert.match(projectionHelp('conic', 'compromise').latitudeOfOrigin, /零点/);
assert.match(projectionHelp('equalEarth', 'equalArea').standard, /40.38/);
let cases = 0;
for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1280, 720], [1440, 900]]) {
  for (const [left, top] of [[0, 0], [width - 30, 12], [width / 2, height / 2], [width - 30, height - 20]]) {
    const size = { width: Math.min(318, width - 24), height: 180 };
    const p = placeHelp({ left, top, right: left + 24, bottom: top + 20 }, size, { width, height });
    assert.ok(p.x >= 12 && p.y >= 12 && p.x + size.width <= width - 12 && p.y + size.height <= height - 12);
    cases++;
  }
}
console.log(`UI help: manual-only guide, contextual symbols and ${cases} tooltip placements passed.`);
