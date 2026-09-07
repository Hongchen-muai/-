import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { feature } from 'topojson-client';
import { geoPath, geoDistance } from 'd3';
import { createProjectionModel, fitProjection, projectionLinks, lonLatToVector, surfacePoint, cylindricalStandardComparison, SPHERE } from '../src/core/projectionModel.js';
import { getIndicatrices, INDICATRIX_RADIUS } from '../src/core/indicatrix.js';
import { DEG2RAD } from '../src/core/mapMath.js';
import { resizeView, stepProgress, mappingPhases, sphereLinePositions, coastlineTriangles, earthLineMaterial, RENDER_ORDER, DIAGRAM_COLORS } from '../src/core/scenePresentation.js';

const close = (a, b, message, tolerance = 1e-7) => assert.ok(Math.abs(a - b) < tolerance, `${message}: ${a} != ${b}`);
assert.notEqual(DIAGRAM_COLORS.source, DIAGRAM_COLORS.standard, 'Source and projected standard lines must be distinguishable');
assert.deepEqual(mappingPhases('cylinder', 0.25), { geometry: 0.5, mathematics: 0 });
assert.deepEqual(mappingPhases('cylinder', 0.75), { geometry: 1, mathematics: 0.5 });
const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 1000);
camera.position.set(-20, 14, 30);
camera.lookAt(1, 2, 3);
camera.zoom = 1.7;
const position = camera.position.clone(), rotation = camera.quaternion.clone();
resizeView(camera, 390, 430);
assert.ok(camera.position.equals(position), 'Resize must not move the camera');
assert.ok(camera.quaternion.equals(rotation), 'Resize must not reset the viewing angle');
assert.equal(camera.zoom, 1.7, 'Resize must retain user zoom');
close((camera.right - camera.left) / (camera.top - camera.bottom), 390 / 430, 'Camera aspect');
for (let step = 0; step < 3; step++) {
  const progress = { mapping: 0.22, unfold: 0.67 };
  Object.assign(progress, stepProgress(step));
  assert.deepEqual(progress, { mapping: step ? 1 : 0, unfold: step === 2 ? 1 : 0 });
}

const topology = JSON.parse(readFileSync(new URL('../public/world-110m.json', import.meta.url)));
const land = feature(topology, topology.objects.land || topology.objects.countries);
const material = earthLineMaterial(0x263e34, 0.98);
assert.equal(material.depthWrite, false);
assert.equal(material.depthTest, false);
assert.ok(RENDER_ORDER.globe < RENDER_ORDER.surface && RENDER_ORDER.surface < RENDER_ORDER.globeLines, 'Transparent fills must be drawn before coastlines');
material.dispose();
let segments = 0;
for (const family of ['cylinder', 'planar', 'conic']) for (const mode of ['conformal', 'equalArea', 'compromise']) {
  const p = createProjectionModel(family, mode, { centralMeridian: -22, projectionCenterLon: 110, projectionCenterLat: 35, latitudeOfOrigin: 18, standardParallel1: 17, standardParallel2: 75, standardParallel: 30, standardCircleDistance: 30 });
  const positions = sphereLinePositions(land, coord => lonLatToVector(p.rotation(coord), 5 * 1.004));
  assert.ok(positions.length > 1000 && positions.every(Number.isFinite));
  const thick = coastlineTriangles(positions);
  assert.ok(thick.length > 1000 && thick.every(Number.isFinite), 'Thick coastlines must stay finite');
  for (let i = 0; i < positions.length; i += 6) {
    const midpoint = [0, 1, 2].map(j => (positions[i + j] + positions[i + j + 3]) / 2);
    assert.ok(Math.hypot(...midpoint) > 5, 'Coastline chord must never sink into the sphere');
    segments++;
  }
  const links = projectionLinks(p);
  assert.ok(links.length > 4 && links.length <= 18);
  for (const link of links) {
    close(Math.hypot(...link.source), 5, 'Ray source lies on Earth');
    assert.ok([...link.source, ...link.target, ...link.origin].every(Number.isFinite));
    const projected = p.projection(link.geographic);
    close(projected[0], link.flat[0], 'Linked map x');
    close(-projected[1], link.flat[1], 'Linked map y');
    if (link.kind === 'perspective') {
      const a = new THREE.Vector3(...link.source).sub(new THREE.Vector3(...link.origin));
      const b = new THREE.Vector3(...link.target).sub(new THREE.Vector3(...link.origin));
      close(a.cross(b).length(), 0, 'Perspective source and target are collinear');
    }
    if (link.kind === 'parallel') {
      close(link.source[0], link.target[0], 'Parallel x');
      close(link.source[1], link.target[1], 'Parallel y');
    }
    if (link.kind === 'construction') {
      const a = new THREE.Vector3(...link.source), b = new THREE.Vector3(...link.geometric);
      close(a.clone().cross(b).length(), 0, 'Geometric reference is radial from O');
      const radial = Math.hypot(link.geometric[p.transverse ? 1 : 0], link.geometric[2]);
      close(radial, 5 * Math.cos(p.params.standardParallel * DEG2RAD), 'G lies on the auxiliary cylinder');
      close(link.geometric[p.transverse ? 1 : 0], link.target[p.transverse ? 1 : 0], 'Correction stays on the cylinder generator');
      close(link.geometric[2], link.target[2], 'Correction stays on the same generator');
    }
  }
  const glyphs = getIndicatrices(p);
  assert.ok(glyphs.length > 10, 'Both views must have a useful common indicatrix set');
  const fitted = fitProjection(p, 600, 520), scale = fitted.scale(), [tx, ty] = fitted.translate();
  for (const glyph of glyphs) {
    const [px, py] = fitted(glyph.geographic);
    close(px, glyph.center[0] * scale + tx, 'Shared glyph center x');
    close(py, -glyph.center[1] * scale + ty, 'Shared glyph center y');
    for (const point of glyph.sourceCircle) close(geoDistance(glyph.geographic, point), INDICATRIX_RADIUS, 'Reference circles have equal angular radius');
    for (const point of glyph.outline) {
      const end = surfacePoint(p, point, 1);
      close(end[0], point[0] * 5, '3D indicatrix unfolds to the same x');
      close(end[1], point[1] * 5, '3D indicatrix unfolds to the same y');
      assert.ok(surfacePoint(p, point, 0).every(Number.isFinite));
    }
    const { east: e, north: n } = glyph;
    if (mode === 'equalArea') close(e[0] * n[1] - e[1] * n[0], 1, 'Indicatrix area ratio', 1e-5);
    if (mode === 'conformal') {
      close(Math.hypot(...e) / Math.hypot(...n), 1, 'Conformal indicatrices are circles', 1e-5);
      close((e[0] * n[0] + e[1] * n[1]) / Math.hypot(...e) / Math.hypot(...n), 0, 'Conformal tangent directions remain perpendicular', 1e-5);
    }
  }
}

const reported = createProjectionModel('cylinder', 'compromise', { centralMeridian: 8, standardParallel: 60 });
const focus = projectionLinks(reported).find(link => link.focus);
close(focus.local[1], 60, 'Illustrated point belongs to the 60-degree standard parallel');
close(focus.source[1], 5 * Math.sin(Math.PI / 3), 'Blue source circle height');
close(focus.target[1], 5 * Math.PI / 3, 'Red mapped circle height');
close(new THREE.Vector3(...focus.source).distanceTo(new THREE.Vector3(...focus.geometric)), 0, 'P and G coincide on the standard parallel');
assert.ok(Math.abs(focus.target[1] - focus.source[1]) > 0.9, 'Do not incorrectly force the two circles to coincide');
const comparison = cylindricalStandardComparison('compromise', { standardParallel: 60 });
close(comparison.sphere, Math.sqrt(3) / 2, 'Explained sphere height');
close(comparison.mapped, Math.PI / 3, 'Explained map height');
assert.ok(projectionLinks(reported).some(link => Math.hypot(...link.geometric) < 5), 'Secant geometry may encounter G before P');
for (const mode of ['conformal', 'equalArea', 'compromise']) for (const latitude of [0, 60, 75]) {
  const transverse = createProjectionModel('cylinder', mode, { aspect: 'transverse', centralMeridian: 110, standardParallel: latitude });
  for (const link of projectionLinks(transverse)) {
    close(Math.hypot(link.geometric[1], link.geometric[2]), 5 * Math.cos(latitude * DEG2RAD), 'Transverse geometric cylinder radius');
    close(link.geometric[1], link.target[1], 'Transverse correction uses the axial direction');
    close(link.geometric[2], link.target[2], 'Transverse correction remains on the surface');
  }
  const glyphs = getIndicatrices(transverse);
  assert.ok(glyphs.length > 10);
  for (const glyph of glyphs) for (const p of glyph.outline) assert.ok(surfacePoint(transverse, p, 0).every(Number.isFinite), 'Transverse indicatrices remain finite');
}

const ratio = model => {
  const [[x0, y0], [x1, y1]] = geoPath(fitProjection(model, 600, 520)).bounds(SPHERE);
  return (x1 - x0) / (y1 - y0);
};
for (const [family, mode, key] of [['cylinder', 'conformal', 'standardParallel'], ['planar', 'conformal', 'standardCircleDistance']]) {
  const a = createProjectionModel(family, mode, { [key]: 0 });
  const b = createProjectionModel(family, mode, { [key]: 60 });
  const pa = fitProjection(a, 600, 520), pb = fitProjection(b, 600, 520);
  for (const coord of [[0, 0], [20, 35], [-40, -25]]) {
    const x = pa(coord), y = pb(coord);
    x.forEach((v, i) => close(v, y[i], 'Auto-fit cancels uniform scaling'));
  }
}
for (const mode of ['equalArea', 'compromise']) {
  const a = createProjectionModel('cylinder', mode, { standardParallel: 0 });
  const b = createProjectionModel('cylinder', mode, { standardParallel: 60 });
  close(ratio(b) / ratio(a), mode === 'equalArea' ? 0.25 : 0.5, 'Cylindrical aspect-ratio change');
  const planeA = createProjectionModel('planar', mode, { standardCircleDistance: 0 });
  const planeB = createProjectionModel('planar', mode, { standardCircleDistance: 60 });
  assert.deepEqual(planeA.raw(0.4, 0.5), planeB.raw(0.4, 0.5), 'Moving this plane must not change mathematical x/y');
}
for (const circle of [0, 15, 30, 60, 75]) {
  const model = createProjectionModel('planar', 'conformal', { standardCircleDistance: circle });
  const c = circle * DEG2RAD, h = 1e-6;
  const radialScale = (model.raw(c + h, 0)[0] - model.raw(c - h, 0)[0]) / (2 * h);
  close(radialScale, 1, 'Stereographic plane intersection is a true-scale circle', 1e-6);
  if (c) close(model.raw(c, 0)[0] / Math.sin(c), 1, 'Stereographic tangential scale', 1e-6);
}
console.log(`Scene presentation passed: ${segments} coastline chords, nine projection link sets, preserved camera state and parameter-effect checks.`);
