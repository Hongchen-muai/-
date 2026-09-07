import { geoCircle } from 'd3';
import { DEG2RAD } from './mapMath.js';

export const INDICATRIX_RADIUS = 2.5 * DEG2RAD;

// One Jacobian and one sample set serve both renderers. These are first-order
// Tissot ellipses, not claims about the exact image of a finite spherical disk.
export const getIndicatrices = (model) => {
  const glyphs = [];
  const delta = 0.0001;
  const project = (coordinate) => {
    const p = model.projection(coordinate);
    return [p[0], -p[1]];
  };
  for (let lat = -60; lat <= 60; lat += 20) for (let lon = -150; lon <= 180; lon += 30) {
    const geographic = [lon, lat];
    if (!model.contains(geographic, 3)) continue;
    const sourceCircle = geoCircle().center(geographic).radius(2.5).precision(5)().coordinates[0];
    if (sourceCircle.some(p => !model.contains(p, 0.05))) continue;
    const longitudes = sourceCircle.map(p => model.rotation(p)[0]);
    if (model.family !== 'planar' && Math.max(...longitudes) - Math.min(...longitudes) > 180) continue;
    const eastStep = delta / Math.cos(lat * DEG2RAD);
    const e0 = project([lon - eastStep, lat]), e1 = project([lon + eastStep, lat]);
    const n0 = project([lon, lat - delta]), n1 = project([lon, lat + delta]);
    const center = project(geographic);
    const factor = 1 / (2 * delta * DEG2RAD);
    const east = e1.map((v, i) => (v - e0[i]) * factor);
    const north = n1.map((v, i) => (v - n0[i]) * factor);
    if (![...center, ...east, ...north].every(Number.isFinite) || Math.max(Math.hypot(...east), Math.hypot(...north)) > 25) continue;
    const outline = Array.from({ length: 73 }, (_, i) => {
      const angle = i / 72 * Math.PI * 2;
      return center.map((v, j) => v + INDICATRIX_RADIUS * (east[j] * Math.cos(angle) + north[j] * Math.sin(angle)));
    });
    if (outline.some(p => {
      const geo = model.projection.invert([p[0], -p[1]]);
      return !geo?.every(Number.isFinite) || !model.contains(geo, 0.01);
    })) continue;
    glyphs.push({ geographic, center, east, north, outline, sourceCircle });
  }
  return glyphs;
};
