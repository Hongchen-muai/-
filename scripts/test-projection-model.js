import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as d3 from 'd3';
import { feature } from 'topojson-client';
import { DEG2RAD, getConicConstants, conicForward, getProjectionDetails } from '../src/core/mapMath.js';
import { createProjectionModel, surfacePoint, sourcePoint, projectedLines, fitProjection, SPHERE, GRATICULE } from '../src/core/projectionModel.js';

let assertions = 0;
const close = (a, b, label, tolerance = 1e-7) => {
  assertions++;
  assert.ok(Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < tolerance, `${label}: ${a} != ${b}`);
};
const pairClose = (a, b, label, tolerance) => a.forEach((v, i) => close(v, b[i], label, tolerance));
const topology = JSON.parse(readFileSync(new URL('../public/world-110m.json', import.meta.url)));
const land = feature(topology, topology.objects.land || topology.objects.countries);

const derivative = (raw, lon, lat) => {
  const h = 1e-6;
  const lambda = lon * DEG2RAD, phi = lat * DEG2RAD;
  const a = raw(lambda + h, phi), b = raw(lambda - h, phi);
  const c = raw(lambda, phi + h), d = raw(lambda, phi - h);
  const east = a.map((v, i) => (v - b[i]) / (2 * h * Math.cos(phi)));
  const north = c.map((v, i) => (v - d[i]) / (2 * h));
  return { east, north, k: Math.hypot(...east), h: Math.hypot(...north), area: east[0] * north[1] - east[1] * north[0] };
};

for (const family of ['cylinder', 'planar', 'conic']) for (const mode of ['conformal', 'equalArea', 'compromise']) {
  const variations = family === 'cylinder'
    ? [ {}, { standardParallel: 30 }, { standardParallel: 75, centralMeridian: 180 }, { aspect: 'transverse' }, { aspect: 'transverse', centralMeridian: 110, standardParallel: 30 } ]
    : family === 'planar'
      ? [{}, { projectionCenterLon: 110, projectionCenterLat: 35 }, { projectionCenterLat: 90 }, { projectionCenterLat: -90, standardCircleDistance: 75 }]
      : [{}, { latitudeOfOrigin: 35, centralMeridian: 110 }, { standardParallel1: -25, standardParallel2: -47 }, { standardParallel1: 30, standardParallel2: 30 }, { standardParallel1: -30, standardParallel2: 30 }, { standardParallel1: 0, standardParallel2: 0 }, { standardParallel1: 80, standardParallel2: 79.99 }, { standardParallel1: 30, standardParallel2: -29.999 }];
  for (const params of variations) {
    const model = createProjectionModel(family, mode, params);
    const label = `${family}/${mode}/${JSON.stringify(params)}`;
    assert.ok(model.bounds.flat().every(Number.isFinite), `${label}: finite bounds`);
    assert.ok(projectedLines(model, model.standardGeometry).length <= 6, `${label}: reference lines must not fragment into clipped dots`);
    for (const geometry of [land, GRATICULE, SPHERE, model.standardGeometry]) {
      const lines = projectedLines(model, geometry);
      assert.ok(lines.length, `${label}: nonempty clipped geometry`);
      for (const point of lines.flat().filter((_, i) => i % 23 === 0)) {
        const source = sourcePoint(model, point);
        close(Math.hypot(...source), 5, `${label}: sphere radius`, 1e-6);
        for (const t of [0, 0.25, 0.75, 0.9999, 1]) {
          const p = surfacePoint(model, point, t);
          assert.ok(p.every(Number.isFinite), `${label}: finite unfolding ${t}`);
          if (t === 1) pairClose(p, [point[0] * 5, point[1] * 5, 0], `${label}: exact flat endpoint`);
          if (t === 0.9999) pairClose(p, [point[0] * 5, point[1] * 5, 0], `${label}: continuous endpoint`, 0.03);
        }
      }
    }
    for (const [w, h] of [[517, 520], [320, 430]]) {
      const projection = fitProjection(model, w, h);
      const bounds = d3.geoPath(projection).bounds(SPHERE);
      assert.ok(bounds[0][0] > -1 && bounds[1][0] < w + 1 && bounds[0][1] > -1 && bounds[1][1] < h + 1, `${label}: fitted bounds inside viewport`);
    }
    for (const [lon, lat] of [[0, 0], [25, 35], [-20, -40], [60, 60]]) {
      const p = model.raw(lon * DEG2RAD, lat * DEG2RAD);
      const back = model.raw.invert(...p);
      pairClose(back, [lon * DEG2RAD, lat * DEG2RAD], `${label}: raw inverse`, 2e-6);
      const local = model.rotation(model.rotation.invert([lon, lat]));
      pairClose(local, [lon, lat], `${label}: shared rotation`, 2e-6);
      const metric = derivative(model.raw, lon, lat);
      if (mode === 'equalArea') close(metric.area, 1, `${label}: equal area`, 2e-5);
      if (mode === 'conformal') {
        close(metric.k / metric.h, 1, `${label}: equal local scales`, 2e-5);
        close((metric.east[0] * metric.north[0] + metric.east[1] * metric.north[1]) / metric.k / metric.h, 0, `${label}: orthogonal`, 2e-5);
      }
      if (mode === 'compromise' && family !== 'planar') close(metric.h, 1, `${label}: meridian distance`, 2e-5);
    }
    if (family !== 'planar') {
      const lats = family === 'cylinder' ? [model.params.standardParallel] : [model.params.standardParallel1, model.params.standardParallel2];
      for (const lat of lats) close(derivative(model.raw, 0, lat).k, 1, `${label}: standard-parallel true scale`, 2e-5);
    }
  }
}

for (const mode of ['conformal', 'equalArea', 'compromise']) for (const [a, b] of [[25, 47], [-25, -47], [30, 30], [-20, 40]]) {
  const d3Raw = (mode === 'conformal' ? d3.geoConicConformalRaw : mode === 'equalArea' ? d3.geoConicEqualAreaRaw : d3.geoConicEquidistantRaw)(a * DEG2RAD, b * DEG2RAD);
  const offset = d3Raw(0, 35 * DEG2RAD)[1];
  for (const lon of [-150, 0, 110]) for (const lat of [-20, 30, 70]) {
    const p = conicForward(lon * DEG2RAD, lat * DEG2RAD, mode, a, b, 1, 35);
    const expected = d3Raw(lon * DEG2RAD, lat * DEG2RAD);
    pairClose([p.x, p.y], [expected[0], expected[1] - offset], `D3 conic reference ${mode}`);
  }
}
const transverse = createProjectionModel('cylinder', 'conformal', { aspect: 'transverse', centralMeridian: 110 });
const reference = d3.geoTransverseMercator().rotate([-110, 0]).scale(1).translate([0, 0]);
for (const coord of [[110, 0], [115, 30], [100, -45]]) pairClose(transverse.projection(coord), reference(coord), 'D3 transverse Mercator');

// Match the shader's packed attributes: rho - rho0 is computed in double
// precision before upload, not by subtracting two huge Float32 radii on GPU.
for (const mode of ['conformal', 'equalArea', 'compromise']) {
  const model = createProjectionModel('conic', mode, { standardParallel1: 30, standardParallel2: -29.999, latitudeOfOrigin: 35 });
  for (const coord of [[0, 0], [110, 45], [-90, -20]]) {
    const xy = model.raw(coord[0] * DEG2RAD, coord[1] * DEG2RAD);
    const rho = Math.abs(conicForward(coord[0] * DEG2RAD, coord[1] * DEG2RAD, mode, 30, -29.999).rho) * 5;
    const rho0 = model.surface.rho0 * 5;
    const delta = Math.fround(rho - rho0), r0 = Math.fround(rho0);
    const n = Math.fround(model.constants.n), lambda = Math.fround(coord[0] * DEG2RAD);
    for (const u of [0, 0.1, 0.5, 0.99]) {
      const opening = Math.abs(n) + (1 - Math.abs(n)) * u * (2 - u);
      const angle = Math.abs(n) * lambda / opening;
      const v = -Math.sign(n) * Math.sqrt(1 - opening * opening) * delta;
      const d = opening * (delta * Math.cos(angle) - 2 * r0 * Math.sin(angle / 2) ** 2);
      const tilt = Math.sign(n) * u * Math.PI / 2;
      const actual = [(r0 * opening + delta * opening) * Math.sin(angle), v * Math.cos(tilt) - d * Math.sin(tilt) + Math.fround(model.surface.anchor * 5) * (1 - u), v * Math.sin(tilt) + d * Math.cos(tilt) + Math.abs(n) * r0 * (1 - u)];
      pairClose(actual, surfacePoint(model, xy, u), 'Near-cylinder Float32 packed coordinates', 1e-4);
    }
  }
}

const originA = createProjectionModel('conic', 'equalArea', { latitudeOfOrigin: 0 });
const originB = createProjectionModel('conic', 'equalArea', { latitudeOfOrigin: 50 });
pairClose(originB.projection([0, 50]), [0, 0], 'Conic origin maps to zero');
pairClose(originA.rotation([110, 35]), originB.rotation([110, 35]), 'Origin latitude does not rotate the globe');
for (const mode of ['conformal', 'equalArea', 'compromise']) for (const p of [{}, { standardParallel1: -25, standardParallel2: -47 }, { standardParallel1: -30, standardParallel2: 30 }]) {
  const a = createProjectionModel('conic', mode, { ...p, latitudeOfOrigin: 0 });
  const b = createProjectionModel('conic', mode, { ...p, latitudeOfOrigin: 50 });
  for (const coord of [[0, 30], [110, 35], [-60, -10]]) {
    const pa = a.projection(coord), pb = b.projection(coord);
    pairClose(surfacePoint(a, [pa[0], -pa[1]], 0), surfacePoint(b, [pb[0], -pb[1]], 0), 'Origin latitude must not move the wrapped surface');
  }
}
assert.equal(getConicConstants('equalArea', -30, 30).n, 0);
assert.equal(getProjectionDetails('cylinder', 'equalArea', { standardParallel: 30 }).title, '圆柱等面积投影');

// Perspective rays must actually pass through the corresponding sphere point.
for (const c of [0, 30, 75]) {
  const stereo = createProjectionModel('planar', 'conformal', { standardCircleDistance: c });
  const ortho = createProjectionModel('planar', 'compromise', { standardCircleDistance: c });
  const xy = stereo.raw(30 * DEG2RAD, 25 * DEG2RAD);
  const s = sourcePoint(stereo, xy), t = surfacePoint(stereo, xy);
  close(s[0] / (s[2] + 5), t[0] / (t[2] + 5), 'Stereographic ray x');
  close(s[1] / (s[2] + 5), t[1] / (t[2] + 5), 'Stereographic ray y');
  const p = ortho.raw(30 * DEG2RAD, 25 * DEG2RAD);
  pairClose(surfacePoint(ortho, p).slice(0, 2), sourcePoint(ortho, p).slice(0, 2), 'Parallel orthographic rays');
}
console.log(`Projection model: ${assertions} numerical assertions passed across all nine projections, clipping, aspects, origins, standard lines and unfold endpoints.`);
