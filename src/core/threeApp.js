import * as THREE from 'three';
import gsap from 'gsap';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as topojson from 'topojson-client';
import {
  DEG2RAD,
  normalizeProjectionParams,
  getStandardFeatures,
  getAzimuthalPlaneDistance,
  getConicConstants
} from './mapMath.js';

const R_EARTH = 5;
const SURFACE_OPACITY = 0.18;

let scene;
let camera;
let renderer;
let controls;
let resizeObserver;
let animationFrameId;
let containerEl;
let cachedLandData = null;

let earthGroup = new THREE.Group();
let surfaceGroup = new THREE.Group();
let projectedGroup = new THREE.Group();
let rayGroup = new THREE.Group();
let helperGroup = new THREE.Group();

let currentFamily = 'cylinder';
let currentMode = 'conformal';
let currentParams = normalizeProjectionParams('cylinder', 'conformal');
let currentRotation = new THREE.Quaternion();

const reusableVector = new THREE.Vector3();

const disposeObject = (object) => {
  object.traverse((child) => {
    child.geometry?.dispose?.();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.filter(Boolean).forEach((material) => material.dispose?.());
  });
};

const clearGroup = (group) => {
  while (group.children.length) {
    const child = group.children.pop();
    disposeObject(child);
  }
};

const createLine = (points, color = 0x263846, opacity = 1, dashed = false) => {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = dashed
    ? new THREE.LineDashedMaterial({
      color,
      transparent: true,
      opacity,
      dashSize: 0.2,
      gapSize: 0.16,
      depthWrite: false
    })
    : new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false
    });
  const line = new THREE.Line(geometry, material);
  if (dashed) line.computeLineDistances();
  line.frustumCulled = false;
  return line;
};

const lonLatToUnitVector = (lon, lat) => {
  const lambda = lon * DEG2RAD;
  const phi = lat * DEG2RAD;
  return new THREE.Vector3(
    Math.cos(phi) * Math.sin(lambda),
    Math.sin(phi),
    Math.cos(phi) * Math.cos(lambda)
  );
};

const getProjectionCenter = () => {
  if (currentFamily === 'planar') {
    return {
      lon: currentParams.projectionCenterLon,
      lat: currentParams.projectionCenterLat
    };
  }
  return {
    lon: currentParams.centralMeridian,
    lat: currentParams.latitudeOfOrigin
  };
};

const updateRotation = () => {
  const center = getProjectionCenter();
  currentRotation.setFromEuler(
    new THREE.Euler(-center.lat * DEG2RAD, -center.lon * DEG2RAD, 0, 'YXZ')
  );
};

const geoToLocalUnit = (lon, lat) => lonLatToUnitVector(lon, lat).applyQuaternion(currentRotation).normalize();

const getCylinderRadius = () => {
  const radius = R_EARTH * Math.cos(currentParams.standardParallel * DEG2RAD);
  return Math.max(1.2, radius);
};

const getConicMetrics = () => {
  const constants = getConicConstants(currentMode, currentParams.standardParallel1, currentParams.standardParallel2);
  const sinAlpha = Math.min(0.96, Math.max(0.08, Math.abs(constants.n)));
  const cosAlpha = Math.sqrt(Math.max(0.0001, 1 - sinAlpha * sinAlpha));
  const tanBeta = sinAlpha / cosAlpha;
  const axisSign = constants.n >= 0 ? 1 : -1;
  const apexDistance = R_EARTH / sinAlpha;
  return { ...constants, sinAlpha, cosAlpha, tanBeta, axisSign, apexDistance };
};

const projectUnitToCylinder = (unit) => {
  const radius = getCylinderRadius();
  const transverse = currentParams.aspect === 'transverse';
  const denominator = transverse
    ? Math.hypot(unit.y, unit.z)
    : Math.hypot(unit.x, unit.z);
  if (denominator < 0.08) return null;
  return unit.clone().multiplyScalar(radius / denominator);
};

const projectUnitToPlane = (unit) => {
  if (unit.z <= 0.04) return null;
  const distance = Math.max(0.6, getAzimuthalPlaneDistance(R_EARTH, currentParams.standardCircleDistance));
  return unit.clone().multiplyScalar(distance / unit.z);
};

const projectUnitToCone = (unit) => {
  const metrics = getConicMetrics();
  const radial = Math.hypot(unit.x, unit.z);
  const denominator = radial + metrics.tanBeta * metrics.axisSign * unit.y;
  if (denominator <= 0.04) return null;
  const t = metrics.tanBeta * metrics.apexDistance / denominator;
  if (!Number.isFinite(t) || t <= 0) return null;
  return unit.clone().multiplyScalar(t);
};

const projectUnitToSurface = (unit) => {
  if (currentFamily === 'cylinder') return projectUnitToCylinder(unit);
  if (currentFamily === 'planar') return projectUnitToPlane(unit);
  return projectUnitToCone(unit);
};

const getFeatureRings = () => {
  if (!cachedLandData) return [];
  const rings = [];
  cachedLandData.features.forEach((feature) => {
    const geometry = feature.geometry;
    if (!geometry) return;
    if (geometry.type === 'Polygon') {
      geometry.coordinates.forEach((ring) => rings.push(ring));
    }
    if (geometry.type === 'MultiPolygon') {
      geometry.coordinates.forEach((polygon) => {
        polygon.forEach((ring) => rings.push(ring));
      });
    }
  });
  return rings;
};

const addLineSegmentsFromRings = (group, transform, color, opacity, stride = 1) => {
  getFeatureRings().forEach((ring) => {
    let segment = [];
    let previous = null;

    const flush = () => {
      if (segment.length > 1) group.add(createLine(segment, color, opacity));
      segment = [];
      previous = null;
    };

    ring.forEach((coord, index) => {
      if (index % stride !== 0 && index !== ring.length - 1) return;
      const point = transform(coord[0], coord[1]);
      if (!point) {
        flush();
        return;
      }
      if (previous && previous.distanceTo(point) > 4.5) flush();
      segment.push(point);
      previous = point;
    });

    flush();
  });
};

const addProjectionRays = () => {
  if (!currentParams.showRays) return;
  const origin = new THREE.Vector3(0, 0, 0);
  let rayCount = 0;
  getFeatureRings().forEach((ring) => {
    ring.forEach((coord, index) => {
      if (index % 30 !== 0 || rayCount > 140) return;
      const unit = geoToLocalUnit(coord[0], coord[1]);
      const target = projectUnitToSurface(unit);
      if (!target) return;
      const ray = createLine([origin, target], 0x6e879d, 0.26, true);
      ray.userData.targetScale = 1;
      rayGroup.add(ray);
      rayCount += 1;
    });
  });
};

const addSphere = () => {
  const sphereGeometry = new THREE.SphereGeometry(R_EARTH, 80, 80);
  const sphereMaterial = new THREE.MeshPhongMaterial({
    color: 0xfafcff,
    transparent: true,
    opacity: 0.82,
    shininess: 18
  });
  earthGroup.add(new THREE.Mesh(sphereGeometry, sphereMaterial));

  for (let lat = -60; lat <= 60; lat += 30) {
    const points = [];
    for (let lon = -180; lon <= 180; lon += 4) {
      points.push(lonLatToUnitVector(lon, lat).multiplyScalar(R_EARTH * 1.003));
    }
    earthGroup.add(createLine(points, 0xb7c6d2, 0.45));
  }

  for (let lon = -150; lon <= 180; lon += 30) {
    const points = [];
    for (let lat = -80; lat <= 80; lat += 4) {
      points.push(lonLatToUnitVector(lon, lat).multiplyScalar(R_EARTH * 1.003));
    }
    earthGroup.add(createLine(points, 0xb7c6d2, 0.45));
  }

  addLineSegmentsFromRings(
    earthGroup,
    (lon, lat) => geoToLocalUnit(lon, lat).multiplyScalar(R_EARTH * 1.01),
    0x1f2937,
    0.8,
    2
  );
};

const createCylinderSurface = () => {
  const radius = getCylinderRadius() * 1.01;
  const geometry = new THREE.CylinderGeometry(radius, radius, 36, 96, 1, true);
  if (currentParams.aspect === 'transverse') geometry.rotateZ(Math.PI / 2);
  const material = new THREE.MeshPhongMaterial({
    color: 0x8aa9bf,
    transparent: true,
    opacity: SURFACE_OPACITY,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  surfaceGroup.add(new THREE.Mesh(geometry, material));
};

const createPlaneSurface = () => {
  const distance = Math.max(0.6, getAzimuthalPlaneDistance(R_EARTH, currentParams.standardCircleDistance));
  const size = 34;
  const geometry = new THREE.PlaneGeometry(size, size, 12, 12);
  geometry.translate(0, 0, distance);
  const material = new THREE.MeshPhongMaterial({
    color: 0x8aa9bf,
    transparent: true,
    opacity: SURFACE_OPACITY,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  surfaceGroup.add(new THREE.Mesh(geometry, material));
};

const createConicSurface = () => {
  const samples = [
    -75,
    -60,
    -30,
    0,
    30,
    60,
    75,
    currentParams.standardParallel1,
    currentParams.standardParallel2
  ];
  const profile = samples
    .map((lat) => projectUnitToCone(lonLatToUnitVector(0, lat)))
    .filter(Boolean)
    .map((point) => ({ y: point.y, radius: Math.hypot(point.x, point.z) }))
    .filter((point) => Number.isFinite(point.y) && Number.isFinite(point.radius));

  if (profile.length < 2) return;
  profile.sort((a, b) => a.y - b.y);
  const bottom = profile[0];
  const top = profile[profile.length - 1];
  const height = Math.max(2, Math.abs(top.y - bottom.y));
  const geometry = new THREE.CylinderGeometry(
    Math.max(0.1, top.radius),
    Math.max(0.1, bottom.radius),
    height,
    112,
    1,
    true
  );
  geometry.translate(0, (top.y + bottom.y) / 2, 0);
  const material = new THREE.MeshPhongMaterial({
    color: 0x8aa9bf,
    transparent: true,
    opacity: SURFACE_OPACITY,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  surfaceGroup.add(new THREE.Mesh(geometry, material));
};

const addSurface = () => {
  if (!currentParams.showSurface) return;
  if (currentFamily === 'cylinder') createCylinderSurface();
  else if (currentFamily === 'planar') createPlaneSurface();
  else createConicSurface();
};

const addProjectedImage = () => {
  if (!currentParams.showProjectedImage) return;
  addLineSegmentsFromRings(
    projectedGroup,
    (lon, lat) => {
      const unit = geoToLocalUnit(lon, lat);
      const target = projectUnitToSurface(unit);
      if (!target) return null;
      return target.multiplyScalar(1.002);
    },
    0x24475f,
    0.9,
    2
  );
};

const addStandardLatitudeOnSurface = (lat) => {
  const points = [];
  for (let lon = -180; lon <= 180; lon += 3) {
    const unit = lonLatToUnitVector(lon, lat);
    const target = projectUnitToSurface(unit);
    if (target) points.push(target.multiplyScalar(1.006));
  }
  if (points.length > 1) helperGroup.add(createLine(points, 0xd92d20, 0.95));
};

const addTransverseCylinderIntersection = (standardDistance) => {
  const sinDistance = Math.sin(Math.abs(standardDistance) * DEG2RAD);
  const cosDistance = Math.cos(Math.abs(standardDistance) * DEG2RAD);
  const offsets = Math.abs(standardDistance) < 0.001 ? [0] : [sinDistance, -sinDistance];

  offsets.forEach((xOffset) => {
    const points = [];
    for (let angle = 0; angle <= 360; angle += 3) {
      const theta = angle * DEG2RAD;
      const unit = new THREE.Vector3(
        xOffset,
        cosDistance * Math.cos(theta),
        cosDistance * Math.sin(theta)
      ).normalize();
      const target = projectUnitToCylinder(unit);
      if (target) points.push(target.multiplyScalar(1.008));
    }
    if (points.length > 1) helperGroup.add(createLine(points, 0xd92d20, 0.95));
  });
};

const addStandardCircleOnPlane = (radiusDeg) => {
  const points = [];
  const radius = Math.max(0.01, radiusDeg) * DEG2RAD;
  for (let angle = 0; angle <= 360; angle += 3) {
    const theta = angle * DEG2RAD;
    const unit = new THREE.Vector3(
      Math.sin(radius) * Math.cos(theta),
      Math.sin(radius) * Math.sin(theta),
      Math.cos(radius)
    );
    const target = projectUnitToPlane(unit);
    if (target) points.push(target.multiplyScalar(1.006));
  }
  if (points.length > 1) helperGroup.add(createLine(points, 0xd92d20, 0.95));
};

const addStandardFeatures = () => {
  if (!currentParams.showStandardLine) return;
  const features = getStandardFeatures(currentFamily, currentParams);
  if (features.type === 'circle') {
    addStandardCircleOnPlane(features.values[0]);
    return;
  }
  if (currentFamily === 'cylinder' && currentParams.aspect === 'transverse') {
    addTransverseCylinderIntersection(currentParams.standardParallel);
    return;
  }
  features.values.forEach((lat) => addStandardLatitudeOnSurface(lat));
};

const addLightSource = () => {
  if (!currentParams.showLightSource) return;
  const geometry = new THREE.SphereGeometry(0.16, 24, 24);
  const material = new THREE.MeshBasicMaterial({ color: 0x111827 });
  const lightMarker = new THREE.Mesh(geometry, material);
  helperGroup.add(lightMarker);

  const glowGeometry = new THREE.SphereGeometry(0.28, 24, 24);
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    transparent: true,
    opacity: 0.22
  });
  helperGroup.add(new THREE.Mesh(glowGeometry, glowMaterial));
};

const redrawScene = () => {
  if (!scene) return;
  gsap.killTweensOf('*');
  clearGroup(earthGroup);
  clearGroup(surfaceGroup);
  clearGroup(projectedGroup);
  clearGroup(rayGroup);
  clearGroup(helperGroup);
  updateRotation();

  addSphere();
  addSurface();
  addProjectedImage();
  addProjectionRays();
  addStandardFeatures();
  addLightSource();
};

const loadGeoJSON = async () => {
  const response = await fetch(`${import.meta.env.BASE_URL}world-110m.json`);
  if (!response.ok) throw new Error(`Failed to load world data: ${response.status}`);
  const topology = await response.json();
  const landObject = topology.objects.land || topology.objects.countries;
  cachedLandData = topojson.feature(topology, landObject);
  redrawScene();
};

export function initScene(container) {
  destroyScene();
  containerEl = container;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf7fafc);

  camera = new THREE.PerspectiveCamera(42, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.set(12, 8, 20);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 10;
  controls.maxDistance = 42;

  scene.add(earthGroup);
  scene.add(surfaceGroup);
  scene.add(projectedGroup);
  scene.add(rayGroup);
  scene.add(helperGroup);

  const ambient = new THREE.AmbientLight(0xffffff, 0.72);
  const directional = new THREE.DirectionalLight(0xffffff, 0.9);
  directional.position.set(12, 18, 16);
  scene.add(ambient);
  scene.add(directional);

  resizeObserver = new ResizeObserver(() => {
    if (!containerEl || !camera || !renderer) return;
    camera.aspect = containerEl.clientWidth / containerEl.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(containerEl.clientWidth, containerEl.clientHeight);
  });
  resizeObserver.observe(container);

  loadGeoJSON().catch((error) => console.error(error));
  animate();
}

export function updateProjectionScene(family, mode, params = {}) {
  currentFamily = family;
  currentMode = mode;
  currentParams = normalizeProjectionParams(family, mode, params);
  redrawScene();
}

export function replayProjectionDemo() {
  if (!scene) return;
  gsap.killTweensOf('*');

  rayGroup.children.forEach((ray) => {
    ray.scale.set(0.03, 0.03, 0.03);
    ray.material.opacity = 0;
    gsap.to(ray.scale, { x: 1, y: 1, z: 1, duration: 2.4, ease: 'power2.out' });
    gsap.to(ray.material, { opacity: 0.28, duration: 1.4, ease: 'power2.out' });
  });

  projectedGroup.children.forEach((line) => {
    line.material.opacity = 0;
    gsap.to(line.material, { opacity: 0.9, delay: 1.3, duration: 1.4, ease: 'power2.out' });
  });

  surfaceGroup.children.forEach((surface) => {
    surface.material.opacity = 0;
    gsap.to(surface.material, { opacity: SURFACE_OPACITY, duration: 1.0, ease: 'power2.out' });
  });
}

function animate() {
  animationFrameId = requestAnimationFrame(animate);
  controls?.update();
  renderer?.render(scene, camera);
}

export function destroyScene() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  animationFrameId = null;
  resizeObserver?.disconnect();
  resizeObserver = null;
  gsap.killTweensOf('*');

  [earthGroup, surfaceGroup, projectedGroup, rayGroup, helperGroup].forEach(clearGroup);

  if (scene) {
    scene.traverse((object) => {
      if (![earthGroup, surfaceGroup, projectedGroup, rayGroup, helperGroup].includes(object)) {
        object.geometry?.dispose?.();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.filter(Boolean).forEach((material) => material.dispose?.());
      }
    });
    scene.clear();
  }

  controls?.dispose();
  if (renderer) {
    renderer.dispose();
    renderer.forceContextLoss?.();
    if (renderer.domElement?.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
  }

  scene = null;
  camera = null;
  renderer = null;
  controls = null;
  containerEl = null;
  cachedLandData = null;
  earthGroup = new THREE.Group();
  surfaceGroup = new THREE.Group();
  projectedGroup = new THREE.Group();
  rayGroup = new THREE.Group();
  helperGroup = new THREE.Group();
}
