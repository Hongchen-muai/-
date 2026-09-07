import assert from 'node:assert/strict';
import {
  DEG2RAD,
  PROJECTION_CONFIG,
  PROJECTION_FAMILIES,
  PROJECTION_MODES,
  normalizeProjectionParams,
  mercatorRaw,
  cylindricalEqualAreaRaw,
  equidistantCylindricalRaw,
  getStandardFeatures,
  getAzimuthalPlaneDistance,
  getConicConstants,
  conicForward,
  getSurfaceMetrics
} from '../src/core/mapMath.js';

const isFiniteNumber = (value) => Number.isFinite(value) && !Number.isNaN(value);
const assertFinitePair = (pair, label) => {
  assert.equal(pair.length, 2, `${label} should return a coordinate pair`);
  assert.ok(pair.every(isFiniteNumber), `${label} should be finite`);
};

for (const family of Object.keys(PROJECTION_FAMILIES)) {
  assert.ok(PROJECTION_CONFIG[family], `${family} should have projection config`);

  for (const mode of Object.keys(PROJECTION_MODES)) {
    const details = PROJECTION_CONFIG[family][mode];
    assert.ok(details?.title, `${family}/${mode} should have a Chinese title`);
    assert.ok(details?.titleEn, `${family}/${mode} should have an English title`);
    assert.ok(details?.history, `${family}/${mode} should have history text`);
    assert.ok(details?.usage, `${family}/${mode} should have usage text`);
    assert.ok(details?.distortion, `${family}/${mode} should have distortion text`);

    const params = normalizeProjectionParams(family, mode);
    assert.ok(isFiniteNumber(params.centralMeridian), `${family}/${mode} centralMeridian should be finite`);
    assert.ok(isFiniteNumber(params.latitudeOfOrigin), `${family}/${mode} latitudeOfOrigin should be finite`);
    assert.ok(isFiniteNumber(params.standardParallel), `${family}/${mode} standardParallel should be finite`);
    assert.ok(isFiniteNumber(params.standardParallel1), `${family}/${mode} standardParallel1 should be finite`);
    assert.ok(isFiniteNumber(params.standardParallel2), `${family}/${mode} standardParallel2 should be finite`);
    assert.ok(isFiniteNumber(params.standardCircleDistance), `${family}/${mode} standardCircleDistance should be finite`);

    const standardFeatures = getStandardFeatures(family, params);
    assert.ok(standardFeatures.values.length > 0, `${family}/${mode} should expose a standard feature`);

    const surfaceMetrics = getSurfaceMetrics(family, mode, params);
    assert.ok(surfaceMetrics.contact, `${family}/${mode} should expose contact label`);
    assert.ok(surfaceMetrics.primary, `${family}/${mode} should expose primary metric`);
  }
}

assertFinitePair(mercatorRaw(0)(20 * DEG2RAD, 35 * DEG2RAD), 'Mercator raw');
assertFinitePair(cylindricalEqualAreaRaw(30)(20 * DEG2RAD, 35 * DEG2RAD), 'Lambert cylindrical equal-area raw');
assertFinitePair(equidistantCylindricalRaw(0)(20 * DEG2RAD, 35 * DEG2RAD), 'Equidistant cylindrical raw');

assert.equal(getStandardFeatures('cylinder', normalizeProjectionParams('cylinder', 'conformal')).values[0], 0);
assert.deepEqual(getStandardFeatures('cylinder', normalizeProjectionParams('cylinder', 'equalArea', { standardParallel: 30 })).values, [30, -30]);

const planeDistance = getAzimuthalPlaneDistance(5, 30);
assert.ok(planeDistance > 0 && planeDistance < 5, 'Secant plane distance should be inside sphere radius');

for (const mode of Object.keys(PROJECTION_MODES)) {
  const constants = getConicConstants(mode, 25, 47);
  assert.ok(Math.abs(constants.n) > 0.01, `${mode} conic constant n should be meaningful`);
  const point = conicForward(110 * DEG2RAD, 35 * DEG2RAD, mode, 25, 47, 5);
  assert.ok(isFiniteNumber(point.x), `${mode} conic x should be finite`);
  assert.ok(isFiniteNumber(point.y), `${mode} conic y should be finite`);
  assert.ok(isFiniteNumber(point.n), `${mode} conic n should be finite`);
}

const normalizedConic = normalizeProjectionParams('conic', 'equalArea', {
  standardParallel1: 20,
  standardParallel2: -40
});
assert.equal(normalizedConic.standardParallel2, -40, 'Valid standard parallels must not be silently moved to another hemisphere');
assert.equal(normalizeProjectionParams('conic', 'conformal', { standardParallel1: 30, standardParallel2: 30 }).standardParallel2, 30, 'Tangent conic parameters must remain identical');

console.log('mapMath regression checks passed');
