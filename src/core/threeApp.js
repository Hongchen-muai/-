import * as THREE from 'three';
import gsap from 'gsap';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createProjectionModel, projectedLines, surfacePoint, sourcePoint, lonLatToVector, projectionLinks, SPHERE, GRATICULE } from './projectionModel.js';
import { DEG2RAD, conicForward } from './mapMath.js';
import { loadWorldData } from './worldData.js';
import { getIndicatrices } from './indicatrix.js';
import { RENDER_ORDER, DIAGRAM_COLORS, mappingPhases, stepProgress, resizeView, sphereLinePositions, earthLineMaterial, coastlineTriangles } from './scenePresentation.js';

const R_EARTH = 5.0;
const SURFACE_OFFSET = 1.01;
let scene, camera, renderer, controls, resizeObserver, containerEl;
let animationFrameId, timeline, model, land, callbacks = {};
let world, earth, rays, sourceMarker;
let generation = 0;
let sceneKey = '';
let step = 0;
let lastAnnotationKey = '', lastConstructionPhase = '';
const progress = { mapping: 0, unfold: 0 };
const animatedMaterials = [];

const morphVertex = `
  attribute vec3 aSource;
  attribute vec2 aFlat;
  attribute vec2 aCurve;
  uniform float uMapping, uUnfold, uFamily, uRadius, uN, uRho0, uAnchor, uPlane, uTransverse, uOffset, uOriginOffset;
  void main() {
    float u = uUnfold;
    vec3 p;
    if (u > 0.99999) {
      p = vec3(aFlat * 5.0, 0.0);
    } else if (uFamily == 1.0) {
      p = vec3(aFlat * 5.0, uPlane * (1.0 - u));
    } else if (uFamily == 0.0) {
      float bend = 1.0 - u;
      float angle = aCurve.x * bend;
      p = vec3(uRadius / bend * sin(angle), aFlat.y * 5.0 + uOriginOffset * bend,
        -2.0 * uRadius / bend * pow(sin(angle / 2.0), 2.0) + uRadius * bend);
    } else {
      float opening = abs(uN) + (1.0 - abs(uN)) * u * (2.0 - u);
      float angle = abs(uN) * aCurve.x / opening;
      float deltaRho = aCurve.y;
      float vertical = -sign(uN) * sqrt(max(0.0, 1.0 - opening * opening)) * deltaRho;
      float depth = opening * (deltaRho * cos(angle) - 2.0 * uRho0 * pow(sin(angle / 2.0), 2.0));
      float tilt = sign(uN) * u * 1.57079632679;
      p = vec3((uRho0 * opening + deltaRho * opening) * sin(angle),
        vertical * cos(tilt) - depth * sin(tilt) + uAnchor * (1.0 - u),
        vertical * sin(tilt) + depth * cos(tilt) + abs(uN) * uRho0 * (1.0 - u));
    }
    if (uTransverse > 0.5) p = vec3(p.y, -p.x, p.z);
    p = mix(aSource, p * mix(uOffset, 1.0, u), uMapping);
    gl_PointSize = 6.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const makeMorphMaterial = (color, opacity, { surface = false, offset = 1 } = {}) => {
  const p = model.params;
  const conic = model.family === 'conic' && model.constants.n !== 0;
  const rho0 = model.surface.rho0 * R_EARTH;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uMapping: { value: surface ? 1 : progress.mapping }, uUnfold: { value: progress.unfold },
      uFamily: { value: model.family === 'planar' ? 1 : conic ? 2 : 0 },
      uRadius: { value: R_EARTH * Math.cos((model.family === 'conic' ? p.standardParallel1 : p.standardParallel) * DEG2RAD) },
      uN: { value: model.constants?.n || 0 }, uRho0: { value: rho0 },
      uAnchor: { value: model.surface.anchor * R_EARTH },
      uOriginOffset: { value: model.surface.originOffset * R_EARTH },
      uPlane: { value: R_EARTH * Math.cos(p.standardCircleDistance * DEG2RAD) },
      uTransverse: { value: model.transverse ? 1 : 0 }, uOffset: { value: offset },
      uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity }
    },
    vertexShader: morphVertex,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity;
      void main() {
        gl_FragColor = vec4(uColor, uOpacity);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide
  });
  material.userData = { surface, opacity };
  animatedMaterials.push(material);
  return material;
};

const makeMorphGeometry = (points) => {
  const flat = [], source = [], curve = [];
  for (const point of points) {
    const xy = model.undoOutput(point);
    const [lambda, phi] = model.raw.invert(...xy);
    flat.push(...xy);
    source.push(...sourcePoint(model, point, R_EARTH * 1.003));
    const rho = model.family === 'conic' && model.constants.n !== 0
      ? Math.abs(conicForward(lambda, phi, model.mode, model.params.standardParallel1, model.params.standardParallel2).rho) * R_EARTH : 0;
    curve.push(lambda, rho - model.surface.rho0 * R_EARTH);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(source, 3));
  geometry.setAttribute('aSource', new THREE.Float32BufferAttribute(source, 3));
  geometry.setAttribute('aFlat', new THREE.Float32BufferAttribute(flat, 2));
  geometry.setAttribute('aCurve', new THREE.Float32BufferAttribute(curve, 2));
  return geometry;
};

const pairs = (lines) => lines.flatMap((line) => line.slice(1).flatMap((p, i) => [line[i], p]));

// A straight map edge can wrap around a whole cylinder. D3's planar
// resampling alone cannot supply the vertices needed by the curved stage.
const curveSamples = (lines) => lines.map((line) => line.flatMap((point, i) => {
  if (i === 0) return [point];
  const previous = line[i - 1];
  const count = Math.max(1, Math.ceil(Math.hypot(point[0] - previous[0], point[1] - previous[1]) / 0.05));
  return Array.from({ length: count }, (_, j) => {
    const t = (j + 1) / count;
    return [previous[0] + (point[0] - previous[0]) * t, previous[1] + (point[1] - previous[1]) * t];
  });
}));

const addMappedLines = (geometry, color, opacity, options) => {
  const lines = curveSamples(projectedLines(model, geometry));
  const isPoint = geometry.type === 'Point';
  if (color === 0xd92d20 && !isPoint) {
    const vertices = [];
    for (const line of lines) for (let i = 1; i < line.length; i++) {
      const a = line[i - 1], b = line[i];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length < 1e-9) continue;
      const dx = -(b[1] - a[1]) / length * 0.011;
      const dy = (b[0] - a[0]) / length * 0.011;
      const q = [[a[0] + dx, a[1] + dy], [a[0] - dx, a[1] - dy], [b[0] + dx, b[1] + dy], [b[0] - dx, b[1] - dy]];
      vertices.push(q[0], q[1], q[2], q[2], q[1], q[3]);
    }
    const mesh = new THREE.Mesh(makeMorphGeometry(vertices), makeMorphMaterial(color, opacity, options));
    mesh.renderOrder = RENDER_ORDER.map;
    mesh.frustumCulled = false;
    world.add(mesh);
    return mesh;
  }
  const points = isPoint ? lines.flat() : pairs(lines);
  const ObjectType = isPoint ? THREE.Points : THREE.LineSegments;
  const line = new ObjectType(makeMorphGeometry(points), makeMorphMaterial(color, opacity, options));
  line.renderOrder = options?.surface ? RENDER_ORDER.surface : RENDER_ORDER.map;
  line.frustumCulled = false;
  world.add(line);
  return line;
};

const localWorldPoint = (coord, radius) => {
  const v = lonLatToVector(model.rotation(coord), radius);
  return model.transverse ? [v[1], -v[0], v[2]] : v;
};

const earthLines = (data, color, opacity, standard = false) => {
  if (data.type === 'Point') {
    const material = earthLineMaterial(color, opacity);
    const point = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 8), material);
    point.renderOrder = RENDER_ORDER.globeLines;
    point.position.set(...localWorldPoint(data.coordinates, R_EARTH));
    earth.add(point);
    return;
  }
  if (standard) {
    const lines = data.type === 'MultiLineString' ? data.coordinates : [data.coordinates];
    for (const line of lines) {
      const curve = new THREE.CatmullRomCurve3(line.map((coord) => new THREE.Vector3(...localWorldPoint(coord, R_EARTH))));
      const material = earthLineMaterial(color, opacity);
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 180, 0.025, 6, false), material);
      mesh.renderOrder = RENDER_ORDER.globeLines;
      earth.add(mesh);
    }
    return;
  }
  const points = sphereLinePositions(data, (coord) => localWorldPoint(coord, R_EARTH * 1.004));
  const coast = data === land;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(coast ? coastlineTriangles(points) : points, 3));
  const ObjectType = coast ? THREE.Mesh : THREE.LineSegments;
  const line = new ObjectType(g, earthLineMaterial(color, opacity));
  line.renderOrder = RENDER_ORDER.globeLines;
  earth.add(line);
};

const addEarth = () => {
  earth = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color: 0xe6eeea, transparent: true, opacity: 0.96, depthWrite: false });
  material.userData.baseOpacity = 0.96;
  material.userData.globeFill = true;
  const globe = new THREE.Mesh(new THREE.SphereGeometry(R_EARTH, 64, 48), material);
  globe.renderOrder = RENDER_ORDER.globe;
  earth.add(globe);
  world.add(earth);
  earthLines(land, 0x263e34, 0.98);
  if (model.params.showGraticule) earthLines(GRATICULE, 0x748b80, 0.50);
  if (model.params.showStandardLine) earthLines(model.standardGeometry, DIAGRAM_COLORS.source, 0.95, true);
};

const addSurface = () => {
  const points = [], indices = [];
  const columns = 96, rows = 48;
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= columns; i++) {
      let xy;
      if (model.family === 'planar') {
        const radius = (model.mode === 'conformal' ? 1 + Math.cos(model.params.standardCircleDistance * DEG2RAD) : model.mode === 'equalArea' ? Math.SQRT2 : 1) * j / rows;
        const angle = i / columns * Math.PI * 2;
        xy = [radius * Math.cos(angle), radius * Math.sin(angle)];
      } else {
        const lambda = (-180 + 360 * i / columns) * DEG2RAD;
        const [min, max] = model.latitudeRange;
        const phi = (min + (max - min) * j / rows) * DEG2RAD;
        xy = model.output(model.raw(lambda, phi));
      }
      points.push(xy);
      if (i < columns && j < rows) {
        const a = j * (columns + 1) + i, b = a + columns + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geometry = makeMorphGeometry(points);
  geometry.setIndex(indices);
  const mesh = new THREE.Mesh(geometry, makeMorphMaterial(0x7a9d99, 0.17, { surface: true, offset: SURFACE_OFFSET }));
  mesh.renderOrder = RENDER_ORDER.surface;
  mesh.frustumCulled = false;
  mesh.visible = model.params.showSurface;
  world.add(mesh);
  const boundary = addMappedLines(SPHERE, 0x648781, 0.7, { surface: true, offset: SURFACE_OFFSET });
  boundary.visible = model.params.showSurface;
};

const addRays = () => {
  rays = new THREE.Group();
  world.userData.annotations = [];
  world.userData.pulses = [];
  const { source: blue, geometry: grey, correction: amber, target: green, standard: red } = DIAGRAM_COLORS;
  const markerGeometry = new THREE.SphereGeometry(0.075, 12, 8);
  const point = (position, color, phase = 'geometry') => {
    const marker = new THREE.Mesh(markerGeometry, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, depthTest: false }));
    marker.position.copy(position);
    marker.renderOrder = RENDER_ORDER.markers;
    marker.userData.phase = phase;
    marker.userData.baseOpacity = 1;
    rays.add(marker);
    return marker;
  };
  const directedLine = (start, end, color, dashed, phase, focus) => {
    const length = start.distanceTo(end);
    if (length < 1e-6) return;
    const options = { color, transparent: true, depthWrite: false, depthTest: false };
    const material = dashed
      ? new THREE.LineDashedMaterial({ ...options, dashSize: 0.14, gapSize: 0.09 })
      : new THREE.LineBasicMaterial(options);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([start, end]), material);
    line.computeLineDistances();
    line.renderOrder = RENDER_ORDER.links;
    line.userData.phase = phase;
    line.userData.baseOpacity = focus ? 1 : 0.55;
    rays.add(line);
    if (focus) {
      line.visible = false;
      const direction = end.clone().sub(start).normalize();
      const shaftMaterial = new THREE.MeshBasicMaterial({ ...options });
      const stride = dashed ? 0.23 : length;
      for (let offset = 0; offset < length; offset += stride) {
        const size = Math.min(dashed ? 0.14 : length, length - offset);
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, size, 8), shaftMaterial);
        shaft.position.copy(start).addScaledVector(direction, offset + size / 2);
        shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
        shaft.renderOrder = RENDER_ORDER.links;
        shaft.userData.phase = phase;
        shaft.userData.baseOpacity = 1;
        rays.add(shaft);
      }
    }
    const arrow = new THREE.ArrowHelper(end.clone().sub(start).normalize(), start, length, color, Math.min(0.28, length * 0.25), Math.min(0.13, length * 0.12));
    arrow.line.visible = false;
    arrow.cone.renderOrder = RENDER_ORDER.markers;
    arrow.cone.material.transparent = true;
    arrow.cone.material.depthTest = arrow.cone.material.depthWrite = false;
    arrow.cone.userData.phase = phase;
    arrow.cone.userData.baseOpacity = focus ? 1 : 0.7;
    rays.add(arrow);
  };
  projectionLinks(model, R_EARTH).forEach((link) => {
    const source = new THREE.Vector3(...link.source);
    const target = new THREE.Vector3(...link.target);
    const origin = new THREE.Vector3(...link.origin);
    const geometric = link.geometric ? new THREE.Vector3(...link.geometric) : null;
    const landing = geometric || target;
    const end = source.distanceTo(origin) > landing.distanceTo(origin) ? source : landing;
    directedLine(origin, end, link.kind === 'mapping' ? amber : grey, link.kind === 'mapping', 'geometry', link.focus);
    if (geometric) directedLine(geometric, target, amber, true, 'mathematics', link.focus);
    const sourceMarker = point(source, blue);
    const mappedMarker = point(target, link.focus ? red : green, geometric ? 'mathematics' : 'geometry');
    const samples = [{ text: 'P', position: source, owner: sourceMarker, color: '#416f8b' }];
    if (geometric) {
      if (source.distanceTo(geometric) < 1e-6) samples[0].text = 'P=G';
      else samples.push({ text: 'G', position: geometric, owner: point(geometric, amber), color: '#94671f' });
    }
    const coincident = samples.find(sample => sample.position.distanceTo(target) < 1e-6);
    if (coincident) coincident.text += '=M';
    else samples.push({ text: 'M', position: target, owner: mappedMarker, color: '#b42318' });
    if (link.focus) {
      world.userData.annotations.push(...samples);
      const distance = Math.acos(Math.cos(link.local[0] * DEG2RAD) * Math.cos(link.local[1] * DEG2RAD)) / DEG2RAD;
      world.userData.probeCaption = model.family === 'planar'
        ? `示例 P：c = ${distance.toFixed(1)}°`
        : `示例 P：${model.transverse ? '轴向 ' : ''}φ = ${link.local[1]}°`;
      const tracer = point(origin, grey);
      world.userData.pulses.push({ tracer, origin, end, geometric, target });
    }
  });
  world.add(rays);
  if (model.family === 'cylinder' || (model.family === 'planar' && model.mode === 'conformal')) {
    sourceMarker = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), new THREE.MeshBasicMaterial({ color: 0x303a37, depthTest: false, depthWrite: false }));
    sourceMarker.position.set(0, 0, model.family === 'cylinder' ? 0 : -R_EARTH);
    sourceMarker.renderOrder = RENDER_ORDER.markers;
    world.add(sourceMarker);
    world.userData.annotations.push({ text: 'O', position: sourceMarker.position.clone(), owner: sourceMarker, color: '#303a37' });
  }
};

const addIndicatrices = () => {
  if (!model.params.showIndicatrix) return;
  const glyphs = getIndicatrices(model);
  const mappedFaces = [], mappedEdges = [], sourceFaces = [];
  for (const glyph of glyphs) {
    for (let i = 1; i < glyph.outline.length; i++) {
      mappedFaces.push(glyph.center, glyph.outline[i - 1], glyph.outline[i]);
      mappedEdges.push(glyph.outline[i - 1], glyph.outline[i]);
    }
    const center = localWorldPoint(glyph.geographic, R_EARTH * 1.004);
    for (let i = 1; i < glyph.sourceCircle.length; i++) {
      sourceFaces.push(...center, ...localWorldPoint(glyph.sourceCircle[i - 1], R_EARTH * 1.004), ...localWorldPoint(glyph.sourceCircle[i], R_EARTH * 1.004));
    }
  }
  const sourceGeometry = new THREE.BufferGeometry();
  sourceGeometry.setAttribute('position', new THREE.Float32BufferAttribute(sourceFaces, 3));
  const sourceDisks = new THREE.Mesh(sourceGeometry, earthLineMaterial(0xb88636, 0.3));
  sourceDisks.renderOrder = RENDER_ORDER.globeLines + 0.1;
  earth.add(sourceDisks);
  earthLines({ type: 'MultiLineString', coordinates: glyphs.map(g => g.sourceCircle) }, 0x886024, 0.8);
  for (const [points, opacity, color, Type] of [[mappedFaces, 0.3, 0xb88636, THREE.Mesh], [mappedEdges, 0.9, 0x886024, THREE.LineSegments]]) {
    const material = makeMorphMaterial(color, opacity);
    material.userData.projectedOnly = true;
    const shape = new Type(makeMorphGeometry(points), material);
    shape.frustumCulled = false;
    shape.renderOrder = RENDER_ORDER.map + 0.1;
    world.add(shape);
  }
};

// Point labels follow the camera, but never escape the canvas or overlap.
const updateAnnotations = () => {
  if (!world || !camera || !containerEl) return;
  const labels = [], boxes = [];
  const width = containerEl.clientWidth, height = containerEl.clientHeight;
  if (rays?.visible && world.userData.probeCaption) {
    labels.push({ text: world.userData.probeCaption, x: 8, y: 8, color: '#555' });
    boxes.push({ x: 8, y: 8, w: Math.min(210, width - 16), h: 20 });
  }
  for (const item of world.userData.annotations || []) {
    let visible = true;
    for (let parent = item.owner; parent; parent = parent.parent) if (!parent.visible) visible = false;
    if (!visible || item.owner.material.opacity < 0.12) continue;
    const point = item.position.clone().project(camera);
    if (Math.abs(point.x) > 1 || Math.abs(point.y) > 1 || Math.abs(point.z) > 1) continue;
    const x = (point.x + 1) * width / 2, y = (1 - point.y) * height / 2;
    const w = item.text.length * 8 + 8, h = 20;
    for (const [dx, dy] of [[8, -24], [8, 6], [-w - 8, -24], [-w - 8, 6]]) {
      const left = Math.max(3, Math.min(width - w - 3, x + dx));
      const top = Math.max(3, Math.min(height - h - 3, y + dy));
      if (boxes.some(b => left < b.x + b.w + 3 && left + w + 3 > b.x && top < b.y + b.h + 3 && top + h + 3 > b.y)) continue;
      boxes.push({ x: left, y: top, w, h });
      labels.push({ text: item.text, color: item.color, x: Math.round(left), y: Math.round(top) });
      break;
    }
  }
  const key = JSON.stringify(labels);
  if (key !== lastAnnotationKey) { lastAnnotationKey = key; callbacks.onAnnotations?.(labels); }
};
const disposeGroup = (group) => {
  const geometries = new Set(), materials = new Set();
  group?.traverse((child) => {
    if (child.geometry) geometries.add(child.geometry);
    const list = Array.isArray(child.material) ? child.material : [child.material];
    list.filter(Boolean).forEach((m) => materials.add(m));
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
};

const disposeWorld = () => {
  if (!world) return;
  disposeGroup(world);
  scene?.remove(world);
  animatedMaterials.length = 0;
  world = null;
  sourceMarker = null;
  earth = rays = null;
};

const syncAnimation = () => {
  const phases = mappingPhases(model?.family, progress.mapping);
  for (const material of animatedMaterials) {
    material.uniforms.uMapping.value = material.userData.surface || material.userData.projectedOnly || model.family === 'cylinder' ? 1 : progress.mapping;
    material.uniforms.uUnfold.value = progress.unfold;
    material.uniforms.uOpacity.value = material.userData.opacity * (material.userData.surface ? 1 : phases.mathematics);
  }
  earth?.traverse((object) => {
    if (object.material) {
      const material = object.material;
      const fade = material.userData.globeFill ? 0.55 : 0.20;
      const opacity = material.userData.baseOpacity * (1 - progress.unfold) * (1 - progress.mapping * fade);
      if (material.uniforms?.uOpacity) material.uniforms.uOpacity.value = opacity;
      else material.opacity = opacity;
    }
  });
  if (earth) earth.visible = progress.unfold < 0.99;
  if (rays) rays.visible = model.params.showRays && progress.mapping > 0.01 && progress.unfold < 0.01;
  rays?.traverse((object) => {
    if (object.material) object.material.opacity = (object.userData.baseOpacity ?? 0.8) * phases[object.userData.phase || 'geometry'];
  });
  for (const pulse of world?.userData.pulses || []) {
    pulse.tracer.visible = progress.mapping > 0 && progress.mapping < 1;
    if (model.family === 'cylinder' && progress.mapping >= 0.5) {
      pulse.tracer.position.lerpVectors(pulse.geometric, pulse.target, phases.mathematics);
      pulse.tracer.material.color.setHex(DIAGRAM_COLORS.correction);
    } else {
      pulse.tracer.position.lerpVectors(pulse.origin, pulse.end, phases.geometry);
      pulse.tracer.material.color.setHex(DIAGRAM_COLORS.source);
    }
  }
  if (sourceMarker) sourceMarker.visible = model.params.showLightSource && progress.unfold < 0.01;
  const phase = model.family === 'cylinder' && step === 1 ? (progress.mapping < 0.5 ? 'geometry' : 'mathematics') : '';
  if (phase !== lastConstructionPhase) { lastConstructionPhase = phase; callbacks.onConstructionPhase?.(phase); }
};

const frameScene = (flat = false, animate = false) => {
  if (!camera || !model) return;
  const target = flat ? new THREE.Vector3(model.center[0] * R_EARTH, model.center[1] * R_EARTH, 0) : new THREE.Vector3();
  const direction = flat ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0.42, 0.22, 1).normalize();
  const position = target.clone().addScaledVector(direction, 60);
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize();
  const up = new THREE.Vector3().crossVectors(direction, right).normalize();
  let halfW = R_EARTH * (flat ? 0 : 1.1), halfH = halfW;
  for (const xy of projectedLines(model, SPHERE).flat()) {
    const p = new THREE.Vector3(...surfacePoint(model, xy, flat ? 1 : 0)).sub(target);
    halfW = Math.max(halfW, Math.abs(p.dot(right)));
    halfH = Math.max(halfH, Math.abs(p.dot(up)));
  }
  const aspect = Math.max(0.1, containerEl.clientWidth / containerEl.clientHeight);
  const size = Math.max(halfH, halfW / aspect) * 1.16;
  camera.zoom = 1;
  camera.left = -aspect * size; camera.right = aspect * size;
  camera.top = size; camera.bottom = -size;
  camera.updateProjectionMatrix();
  if (animate) {
    gsap.to(camera.position, { x: position.x, y: position.y, z: position.z, duration: 1.2 });
    gsap.to(controls.target, { x: target.x, y: target.y, z: target.z, duration: 1.2 });
  } else {
    camera.position.copy(position); controls.target.copy(target); camera.lookAt(target);
  }
};

export function fitProjectionView() {
  if (!world) return;
  gsap.killTweensOf(camera.position);
  gsap.killTweensOf(controls.target);
  frameScene(step === 2, false);
}

export function goToProjectionStep(index, animate = true) {
  if (!world) return;
  timeline?.kill();
  gsap.killTweensOf(progress);
  gsap.killTweensOf(camera.position);
  gsap.killTweensOf(controls.target);
  step = Math.max(0, Math.min(2, index));
  callbacks.onDemoState?.({ step, playing: animate });
  frameScene(step === 2, animate);
  gsap.to(progress, { mapping: step === 0 ? 0 : 1, unfold: step === 2 ? 1 : 0, duration: animate ? 1.4 : 0, onUpdate: syncAnimation, onComplete: () => callbacks.onDemoState?.({ step, playing: false }) });
}

export function replayProjectionDemo() {
  if (!world) return;
  goToProjectionStep(0, false);
  callbacks.onDemoState?.({ step: 0, playing: true });
  const mappingDuration = model.family === 'cylinder' ? 4.4 : 2;
  const unfoldAt = mappingDuration + 2;
  timeline = gsap.timeline({ onUpdate: syncAnimation, onComplete: () => callbacks.onDemoState?.({ step: 2, playing: false }) });
  timeline.call(() => { step = 1; callbacks.onDemoState?.({ step: 1, playing: true }); }, [], 0.8)
    .to(progress, { mapping: 1, duration: mappingDuration, ease: 'none' }, 0.8)
    .call(() => { step = 2; callbacks.onDemoState?.({ step: 2, playing: true }); frameScene(true, true); }, [], unfoldAt)
    .to(progress, { unfold: 1, duration: 2.8, ease: 'power2.inOut' }, unfoldAt);
}

export function updateProjectionScene(family, mode, params = {}) {
  const nextKey = JSON.stringify([family, mode, Object.fromEntries(Object.entries(params).filter(([key]) => key !== 'viewScale'))]);
  if (nextKey === sceneKey && world) return;
  const nextModel = createProjectionModel(family, mode, params);
  if (!scene || !land) { model = nextModel; return; }
  timeline?.kill();
  gsap.killTweensOf(progress);
  gsap.killTweensOf(camera.position);
  gsap.killTweensOf(controls.target);
  Object.assign(progress, stepProgress(step));
  const previous = { model, world, earth, rays, sourceMarker, materials: [...animatedMaterials] };
  model = nextModel;
  world = new THREE.Group();
  sourceMarker = null;
  animatedMaterials.length = 0;
  try {
    addEarth(); addSurface(); addRays();
    const landLines = addMappedLines(land, 0x2f514b, 0.95);
    landLines.visible = model.params.showProjectedImage;
    if (model.params.showGraticule) addMappedLines(GRATICULE, 0x81928f, 0.55);
    if (model.params.showStandardLine) addMappedLines(model.standardGeometry, DIAGRAM_COLORS.standard, 1);
    addIndicatrices();
  } catch (error) {
    disposeGroup(world);
    ({ model, world, earth, rays, sourceMarker } = previous);
    animatedMaterials.splice(0, animatedMaterials.length, ...previous.materials);
    syncAnimation();
    callbacks.onDemoState?.({ step, playing: false });
    callbacks.onError?.(`投影更新失败：${error.message}`);
    return;
  }
  // Swap complete groups atomically; parameter edits never reposition the camera.
  scene.add(world);
  if (previous.world) { scene.remove(previous.world); disposeGroup(previous.world); }
  else frameScene(step === 2, false);
  sceneKey = nextKey;
  syncAnimation();
  callbacks.onDemoState?.({ step, playing: false });
  callbacks.onReady?.();
}

export function initScene(container, options = {}) {
  destroyScene();
  callbacks = options;
  containerEl = container;
  const token = ++generation;
  scene = new THREE.Scene(); scene.background = new THREE.Color(0xf7f9f8);
  camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 1000);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(Math.max(1, container.clientWidth), Math.max(1, container.clientHeight));
  renderer.domElement.setAttribute('aria-label', '三维地图投影动画');
  container.appendChild(renderer.domElement);
  controls = new OrbitControls(camera, renderer.domElement);
  renderer.domElement.style.touchAction = 'pan-y';
  controls.enableDamping = true; controls.enablePan = false; controls.minZoom = 0.5; controls.maxZoom = 3;
  controls.addEventListener('start', () => {
    gsap.killTweensOf(camera.position);
    gsap.killTweensOf(controls.target);
  });
  scene.add(new THREE.AmbientLight(0xffffff, 2));
  const light = new THREE.DirectionalLight(0xffffff, 2); light.position.set(8, 12, 20); scene.add(light);
  resizeObserver = new ResizeObserver(() => {
    if (!renderer || !container.clientWidth || !container.clientHeight) return;
    renderer.setSize(container.clientWidth, container.clientHeight);
    resizeView(camera, container.clientWidth, container.clientHeight);
  });
  resizeObserver.observe(container);
  loadWorldData().then((data) => {
    if (token !== generation || !scene) return;
    land = data;
    const active = model || createProjectionModel('cylinder', 'conformal');
    updateProjectionScene(active.family, active.mode, active.params);
  }).catch((error) => { if (token === generation) callbacks.onError?.(error.message); });
  const animate = () => {
    animationFrameId = requestAnimationFrame(animate);
    controls.update(); renderer.render(scene, camera); updateAnnotations();
  };
  animate();
}

export function destroyScene() {
  generation++;
  cancelAnimationFrame(animationFrameId);
  timeline?.kill(); gsap.killTweensOf(progress);
  if (camera) gsap.killTweensOf(camera.position);
  if (controls) gsap.killTweensOf(controls.target);
  resizeObserver?.disconnect(); controls?.dispose(); disposeWorld();
  renderer?.dispose(); renderer?.domElement.remove();
  scene?.clear();
  scene = camera = renderer = controls = containerEl = land = model = null;
  sceneKey = ''; step = 0; progress.mapping = 0; progress.unfold = 0;
  lastAnnotationKey = ''; lastConstructionPhase = '';
  callbacks.onAnnotations?.([]);
}
