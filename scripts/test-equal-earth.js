import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { geoPath } from 'd3';
import { feature } from 'topojson-client';
import { DEG2RAD, PROJECTION_CONFIG, EQUAL_EARTH_STANDARD_PARALLEL } from '../src/core/mapMath.js';
import { createProjectionModel, sourcePoint, surfacePoint, projectionLinks, projectedLines, fitProjection, SPHERE, GRATICULE, EQUAL_EARTH_PLANE_DEPTH } from '../src/core/projectionModel.js';
import { getIndicatrices } from '../src/core/indicatrix.js';
import { getProjectionTeaching } from '../src/core/projectionTeaching.js';

let assertions = 0;
const close = (a, b, label, tolerance = 1e-8) => {
  assertions++;
  assert.ok(Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < tolerance, `${label}: ${a} != ${b}`);
};
const pairClose = (a, b, label, tolerance) => a.forEach((v, i) => close(v, b[i], label, tolerance));

// Independent transcription of Eq. (1), Savric, Patterson & Jenny (2018/2019).
const paperForward = (lambda, phi) => {
  const theta = Math.asin(Math.sqrt(3) / 2 * Math.sin(phi));
  const y = 1.340264 * theta - 0.081106 * theta ** 3 + 0.000893 * theta ** 7 + 0.003796 * theta ** 9;
  const derivative = 1.340264 - 3 * 0.081106 * theta ** 2 + 7 * 0.000893 * theta ** 6 + 9 * 0.003796 * theta ** 8;
  return [2 * Math.sqrt(3) * lambda * Math.cos(theta) / (3 * derivative), y];
};
const model = createProjectionModel('equalEarth', 'equalArea');
assert.deepEqual(Object.keys(PROJECTION_CONFIG.equalEarth), ['equalArea']);
assert.equal(createProjectionModel('equalEarth', 'conformal').mode, 'equalArea');
assert.equal(getProjectionTeaching('equalEarth', 'equalArea', model.params).source, false);
for (const lon of [-180, -179.999, -120, -60, 0, 60, 120, 179.999, 180]) {
  for (const lat of [-90, -89.99, -80, -60, -40, 0, 40, 60, 80, 89.99, 90]) {
    const [lambda, phi] = [lon, lat].map(v => v * DEG2RAD);
    const p = model.raw(lambda, phi);
    pairClose(p, paperForward(lambda, phi), 'Published forward formula');
    if (Math.abs(lat) < 90) pairClose(model.raw.invert(...p), [lambda, phi], 'Inverse round trip', 1e-7);
    pairClose(model.raw(-lambda, -phi), p.map(v => -v), 'Bilateral symmetry');
    close(Math.hypot(...sourcePoint(model, p)), 5, 'Source remains on the sphere');
    for (const t of [0, 0.25, 0.5, 0.99, 1]) {
      pairClose(surfacePoint(model, p, t), [5 * p[0], 5 * p[1], 5 * EQUAL_EARTH_PLANE_DEPTH * (1 - t)], 'Plane placement preserves x/y');
    }
  }
}

const delta = 1e-6;
for (let lon = -170; lon <= 170; lon += 20) for (let lat = -85; lat <= 85; lat += 10) {
  const [lambda, phi] = [lon, lat].map(v => v * DEG2RAD);
  const l0 = model.raw(lambda - delta, phi), l1 = model.raw(lambda + delta, phi);
  const p0 = model.raw(lambda, phi - delta), p1 = model.raw(lambda, phi + delta);
  const jacobian = ((l1[0] - l0[0]) * (p1[1] - p0[1]) - (l1[1] - l0[1]) * (p1[0] - p0[0])) / (4 * delta ** 2);
  close(jacobian / Math.cos(phi), 1, 'Unit local area ratio', 2e-6);
}
for (const lat of [EQUAL_EARTH_STANDARD_PARALLEL, -EQUAL_EARTH_STANDARD_PARALLEL]) {
  close(model.raw(1, lat * DEG2RAD)[0] / Math.cos(lat * DEG2RAD), 1, 'Fixed parallel has true length scale');
  close(model.raw(0, lat * DEG2RAD)[1], model.raw(2, lat * DEG2RAD)[1], 'Standard line is horizontal');
}
const equator = model.raw(Math.PI, 0), pole = model.raw(Math.PI, Math.PI / 2);
close(equator[0] / pole[1], 2.05458, 'Paper width-to-height ratio', 5e-6);
close(pole[0] / equator[0], 0.59247, 'Paper pole-line/equator ratio', 5e-6);
close(geoPath(model.createProjection().precision(1e-6)).area(SPHERE), 4 * Math.PI, 'High-precision global map area', 5e-6);
close(geoPath(model.projection).area(SPHERE) / (4 * Math.PI), 1, 'Display tessellation area error', 6e-4);

const topology = JSON.parse(readFileSync(new URL('../public/world-110m.json', import.meta.url)));
const land = feature(topology, topology.objects.land || topology.objects.countries);
for (const center of [-180, -170, -90, 0, 110, 170, 180]) {
  const p = createProjectionModel('equalEarth', 'equalArea', { centralMeridian: center });
  const ignored = createProjectionModel('equalEarth', 'equalArea', { centralMeridian: center, standardParallel: 75, standardParallel1: -80, latitudeOfOrigin: 60, standardCircleDistance: 75, aspect: 'transverse' });
  for (const coord of [[116.4, 39.9], [47.5, -18.9], [-42, 72], [-60, -3], [151.2, -33.9], [179.99, 30], [-179.99, -30]]) {
    assert.ok(p.contains(coord));
    pairClose(p.projection(coord), ignored.projection(coord), 'Other families parameters have no effect');
    const local = p.rotation(coord).map(v => v * DEG2RAD);
    const [x, y] = paperForward(...local);
    pairClose(p.projection(coord), [x, -y], 'Known place follows central meridian');
  }
  for (const geometry of [SPHERE, GRATICULE, land, p.standardGeometry]) {
    const lines = projectedLines(p, geometry);
    assert.ok(lines.length > 0 && lines.flat(2).every(Number.isFinite));
    for (const point of lines.flat().filter((_, i) => i % 17 === 0)) {
      assert.ok(sourcePoint(p, point).every(Number.isFinite), 'Clipped paths have finite sphere sources');
      pairClose(surfacePoint(p, point, 1), [point[0] * 5, point[1] * 5, 0], '3D final path equals 2D');
    }
  }
  // D3 can emit subpixel seam stubs after floating-point rotation at +/-180.
  const redLines = projectedLines(p, p.standardGeometry);
  const spans = redLines.map(line => Math.max(...line.map(v => v[0])) - Math.min(...line.map(v => v[0])));
  assert.equal(spans.filter(span => span > 1e-4).length, 2, 'Two continuous red parallels, excluding numerical seam stubs');
  close(spans.reduce((sum, span) => sum + span, 0), 4 * model.raw(Math.PI, EQUAL_EARTH_STANDARD_PARALLEL * DEG2RAD)[0], 'Complete red-line coverage', 1e-5);
  for (const [width, height] of [[320, 430], [520, 520], [1000, 520]]) {
    const fitted = fitProjection(p, width, height);
    const bounds = geoPath(fitted).bounds(SPHERE);
    assert.ok(bounds[0][0] >= 0 && bounds[1][0] <= width && bounds[0][1] >= 0 && bounds[1][1] <= height);
  }
  const links = projectionLinks(p);
  assert.ok(links.length > 8 && links.some(link => link.focus));
  close(links.find(link => link.focus).local[1], EQUAL_EARTH_STANDARD_PARALLEL, 'Highlighted P/M link follows the blue/red standard line');
  for (const link of links) {
    assert.equal(link.kind, 'mapping');
    assert.equal(link.geometric, null);
    pairClose(link.source, link.origin, 'Mapping starts at P, with no invented light source');
    pairClose(link.target.slice(0, 2), link.flat.map(v => v * 5), 'P/M coordinates correspond');
  }
  const glyphs = getIndicatrices(p);
  assert.ok(glyphs.length > 40);
  for (const { east, north, center: point } of glyphs) {
    close(east[0] * north[1] - east[1] * north[0], 1, 'Shared indicatrix area', 1e-5);
    pairClose(surfacePoint(p, point, 1), [point[0] * 5, point[1] * 5, 0], 'Shared indicatrix position');
  }
}
console.log(`Equal Earth: ${assertions} checks passed (paper equations, area, poles, seams, standards, links, indicatrices and flat endpoints).`);
