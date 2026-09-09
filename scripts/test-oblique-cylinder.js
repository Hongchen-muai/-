import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { feature } from 'topojson-client';
import { createProjectionModel, surfacePoint, sourcePoint, orientToWorld, projectionLinks, projectedLines, fitProjection, SPHERE, GRATICULE } from '../src/core/projectionModel.js';
import { getIndicatrices } from '../src/core/indicatrix.js';
import { DEG2RAD, normalizeProjectionParams } from '../src/core/mapMath.js';
import { geoPath } from 'd3';

let checks = 0;
const close = (a, b, label, tolerance = 1e-7) => {
  checks++;
  assert.ok(Number.isFinite(a + b) && Math.abs(a - b) < tolerance, `${label}: ${a} != ${b}`);
};
const vectorClose = (a, b, label, tolerance) => a.forEach((v, i) => close(v, b[i], label, tolerance));
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const earthVector = ([lon, lat]) => {
  const l = lon * DEG2RAD, p = lat * DEG2RAD;
  return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
};

// Independent geographic tangent basis: no D3 rotations in this reference.
function reference(params, mode, coordinate) {
  const l = params.obliqueCenterLon * DEG2RAD, p = params.obliqueCenterLat * DEG2RAD, a = params.obliqueAzimuth * DEG2RAD;
  const center = earthVector([params.obliqueCenterLon, params.obliqueCenterLat]);
  const east = [-Math.sin(l), Math.cos(l), 0];
  const north = [-Math.sin(p) * Math.cos(l), -Math.sin(p) * Math.sin(l), Math.cos(p)];
  const along = east.map((v, i) => Math.sin(a) * v + Math.cos(a) * north[i]);
  const pole = cross(center, along), v = earthVector(coordinate);
  const lambda = Math.atan2(dot(v, along), dot(v, center));
  const phi = Math.asin(Math.max(-1, Math.min(1, dot(v, pole))));
  const k = Math.cos(params.standardParallel * DEG2RAD), beta = Math.PI / 2 - a;
  const x = k * lambda;
  const y = mode === 'conformal' ? k * Math.log(Math.tan(Math.PI / 4 + phi / 2)) : mode === 'equalArea' ? Math.sin(phi) / k : phi;
  return [x * Math.cos(beta) - y * Math.sin(beta), x * Math.sin(beta) + y * Math.cos(beta)];
}

const topology = JSON.parse(readFileSync(new URL('../public/world-110m.json', import.meta.url)));
const land = feature(topology, topology.objects.land || topology.objects.countries);
const locations = [[116.4, 39.9], [47.5, -18.9], [-42, 72], [-60, -3], [149.1, -35.3], [179.99, 12], [-179.99, -12]];
const configurations = [[110, 35, 60], [-75, -30, 120], [179.9, 60, 15], [-180, 0, 180], [0, 0, 90], [35, 0, 0], [0, 90, 45], [180, -90, 270], [110, 35, 360]];
for (const mode of ['conformal', 'equalArea', 'compromise']) for (const [lon, lat, azimuth] of configurations) for (const standard of [0, 30, 75]) {
  const model = createProjectionModel('cylinder', mode, { aspect: 'oblique', obliqueCenterLon: lon, obliqueCenterLat: lat, obliqueAzimuth: azimuth, standardParallel: standard });
  const label = `${mode}/${lon}/${lat}/${azimuth}/${standard}`;
  vectorClose(model.projection(model.origin), [0, 0], `${label}: C is origin`);
  vectorClose(model.rotation(model.origin), [0, 0], `${label}: C lies on axial equator`);
  const axis = orientToWorld(model, [0, 1, 0]);
  close(Math.hypot(...axis), 1, 'Unit cylinder axis');
  close(dot(axis, sourcePoint(model, [0, 0])), 0, 'C is perpendicular to cylinder axis');
  if (standard === 0) vectorClose(surfacePoint(model, [0, 0]), sourcePoint(model, [0, 0]), 'Tangent C is on cylinder and sphere');

  for (const coordinate of locations) {
    if (!model.contains(coordinate, 1)) continue;
    const xy = model.projection(coordinate), point = [xy[0], -xy[1]];
    vectorClose(point, reference(model.params, mode, coordinate), `${label}: geographic basis`, 2e-6);
    const deltaLon = (coordinate[0] - lon) * DEG2RAD, phi = coordinate[1] * DEG2RAD;
    vectorClose(sourcePoint(model, point), [5 * Math.cos(phi) * Math.sin(deltaLon), 5 * Math.sin(phi), 5 * Math.cos(phi) * Math.cos(deltaLon)], 'Earth geography is not tilted with cylinder', 2e-6);
    const wrapped = surfacePoint(model, point);
    close(Math.sqrt(Math.max(0, dot(wrapped, wrapped) - dot(wrapped, axis) ** 2)), 5 * Math.cos(standard * DEG2RAD), 'Wrapped point on inclined cylinder', 2e-6);
    for (const t of [0, 0.35, 0.8, 0.9999, 1]) {
      assert.ok(surfacePoint(model, point, t).every(Number.isFinite));
      if (t === 1) vectorClose(surfacePoint(model, point, t), [...point.map(v => v * 5), 0], 'Exact shared planar endpoint');
    }
  }
  for (const geometry of [SPHERE, GRATICULE, model.standardGeometry, land]) {
    const lines = projectedLines(model, geometry);
    assert.ok(lines.length > 0 && lines.flat(2).every(Number.isFinite), `${label}: clipped paths`);
    for (const p of lines.flat().filter((_, i) => i % 97 === 0)) {
      close(Math.hypot(...sourcePoint(model, p)), 5, 'Clipped path sources stay on sphere', 2e-6);
      assert.ok(surfacePoint(model, p, .4).every(Number.isFinite));
    }
  }
  for (const link of projectionLinks(model)) {
    assert.equal(link.kind, 'construction');
    close(Math.hypot(...cross(link.source, link.geometric)), 0, 'O/P/G collinear', 1e-6);
    close(Math.hypot(...cross(link.target.map((v, i) => v - link.geometric[i]), axis)), 0, 'G/M correction parallel to oblique axis', 1e-6);
    close(Math.sqrt(dot(link.geometric, link.geometric) - dot(link.geometric, axis) ** 2), 5 * Math.cos(standard * DEG2RAD), 'G on geometric cylinder', 1e-6);
  }
  const glyphs = getIndicatrices(model);
  assert.ok(glyphs.length > 10);
  for (const { east: e, north: n, center } of glyphs) {
    if (mode === 'equalArea') close(e[0] * n[1] - e[1] * n[0], 1, 'Oblique area ratio', 2e-5);
    if (mode === 'conformal') {
      close(Math.hypot(...e) / Math.hypot(...n), 1, 'Oblique conformality', 2e-5);
      close(dot(e, n) / Math.hypot(...e) / Math.hypot(...n), 0, 'Oblique local orthogonality', 2e-5);
    }
    vectorClose(surfacePoint(model, center, 1), [...center.map(v => v * 5), 0], 'Shared indicatrix center');
  }
  const bounds = geoPath(fitProjection(model, 540, 520)).bounds(SPHERE);
  assert.ok(bounds[0][0] >= 0 && bounds[1][0] <= 540 && bounds[0][1] >= 0 && bounds[1][1] <= 520, 'Desktop fitted bounds');
}

for (const mode of ['conformal', 'equalArea', 'compromise']) {
  for (const standardParallel of [0, 30, 75]) {
    const p = { centralMeridian: 110, obliqueCenterLon: 110, obliqueCenterLat: 0, standardParallel };
    for (const [aspect, azimuth] of [['normal', 90], ['transverse', 180]]) {
      const original = createProjectionModel('cylinder', mode, { ...p, aspect });
      const oblique = createProjectionModel('cylinder', mode, { ...p, aspect: 'oblique', obliqueAzimuth: azimuth });
      for (const coordinate of [[110, 0], [115, 30], [100, -45]]) vectorClose(oblique.projection(coordinate), original.projection(coordinate), 'Normal/transverse limiting cases');
      const independent = createProjectionModel('cylinder', mode, { ...p, aspect, obliqueCenterLon: -40, obliqueCenterLat: -70, obliqueAzimuth: 13 });
      vectorClose(independent.projection([115, 30]), original.projection([115, 30]), 'Oblique fields do not affect existing axes');
    }
  }
}
const sample = createProjectionModel('cylinder', 'equalArea', { aspect: 'oblique', standardParallel: 30 });
for (const t of [0, .3, .8, 1]) {
  const eps = 1e-6, at = (x, y) => surfacePoint(sample, sample.output([x, y]), t);
  const dx = at(.4 + eps, .7).map((v, i) => (v - at(.4 - eps, .7)[i]) / (2 * eps));
  const dy = at(.4, .7 + eps).map((v, i) => (v - at(.4, .7 - eps)[i]) / (2 * eps));
  close(Math.hypot(...dx), 5, 'Unfold preserves horizontal length');
  close(Math.hypot(...dy), 5, 'Unfold preserves vertical length');
  close(dot(dx, dy), 0, 'Unfold preserves orthogonality', 1e-6);
}
const invalid = normalizeProjectionParams('cylinder', 'conformal', { aspect: 'oblique', obliqueCenterLon: 500, obliqueCenterLat: -100, obliqueAzimuth: Infinity });
assert.equal(invalid.obliqueCenterLon, 180);
assert.equal(invalid.obliqueCenterLat, -90);
assert.equal(invalid.obliqueAzimuth, 60);
console.log(`Oblique cylinder: ${checks} checks passed across three modes, 81 configurations, geography, standards, links and unfolding.`);
