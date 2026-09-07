import * as THREE from 'three';
import { geoDistance, geoInterpolate, geoStream } from 'd3';
import { DEG2RAD } from './mapMath.js';

export const RENDER_ORDER = { globe: 0, surface: 1, globeLines: 2, map: 3, links: 4, markers: 5 };
export const DIAGRAM_COLORS = { source: 0x416f8b, geometry: 0x637d87, correction: 0xa7762d, target: 0x2f6b50, standard: 0xd92d20 };

export const mappingPhases = (family, mapping) => ({
  geometry: family === 'cylinder' ? Math.min(1, mapping * 2) : mapping,
  mathematics: family === 'cylinder' ? Math.max(0, mapping * 2 - 1) : mapping
});

export const stepProgress = (step) => ({ mapping: step === 0 ? 0 : 1, unfold: step === 2 ? 1 : 0 });

export const resizeView = (camera, width, height) => {
  const halfHeight = (camera.top - camera.bottom) / 2;
  const centerX = (camera.left + camera.right) / 2;
  const halfWidth = halfHeight * width / Math.max(1, height);
  camera.left = centerX - halfWidth;
  camera.right = centerX + halfWidth;
  camera.updateProjectionMatrix();
};

// Short great-circle chords stay above the sphere instead of disappearing
// inside it at long coastline edges. Longitude seams require no special case.
export const sphereLinePositions = (data, transform, maxAngle = 2 * DEG2RAD) => {
  const positions = [];
  let previous, first, polygon = false;
  const edge = (a, b) => {
    const count = Math.max(1, Math.ceil(geoDistance(a, b) / maxAngle));
    const interpolate = geoInterpolate(a, b);
    let start = transform(a);
    for (let i = 1; i <= count; i++) {
      const end = transform(interpolate(i / count));
      positions.push(...start, ...end);
      start = end;
    }
  };
  geoStream(data, {
    point(lon, lat) {
      const p = [lon, lat];
      if (previous) edge(previous, p);
      else first = p;
      previous = p;
    },
    lineStart() { previous = null; },
    lineEnd() { if (polygon && previous && first) edge(previous, first); },
    polygonStart() { polygon = true; }, polygonEnd() { polygon = false; }, sphere() {}
  });
  return positions;
};

export const earthLineMaterial = (color, opacity) => {
  const material = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity } },
    vertexShader: `varying float vFacing;
      void main() {
        vec3 radial = normalize((modelMatrix * vec4(position, 1.0)).xyz);
        vFacing = (viewMatrix * vec4(radial, 0.0)).z;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying float vFacing;
      void main() {
        if (vFacing < 0.0) discard;
        gl_FragColor = vec4(uColor, uOpacity);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide
  });
  material.userData.baseOpacity = opacity;
  return material;
};

export const coastlineTriangles = (positions, halfWidth = 0.020) => {
  const result = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), radial = new THREE.Vector3(), offset = new THREE.Vector3();
  for (let i = 0; i < positions.length; i += 6) {
    a.fromArray(positions, i); b.fromArray(positions, i + 3);
    radial.copy(a).add(b).normalize();
    offset.copy(b).sub(a).cross(radial);
    if (offset.lengthSq() < 1e-16) continue;
    offset.normalize().multiplyScalar(halfWidth);
    const q = [a.clone().add(offset), a.clone().sub(offset), b.clone().add(offset), b.clone().sub(offset)];
    for (const index of [0, 1, 2, 2, 1, 3]) result.push(...q[index].toArray());
  }
  return result;
};
