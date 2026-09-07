import {
  geoProjection, geoRotation, geoClipCircle, geoClipAntimeridian, geoTransform,
  geoStream, geoPath, geoCircle, geoGraticule,
  geoStereographicRaw, geoAzimuthalEqualAreaRaw, geoOrthographicRaw
} from 'd3';
import {
  DEG2RAD, RAD2DEG, normalizeProjectionParams, mercatorRaw,
  cylindricalEqualAreaRaw, equidistantCylindricalRaw, conicRaw,
  conicForward, getConicConstants, getStandardFeatures, clamp
} from './mapMath.js';

export const SPHERE = { type: 'Sphere' };
export const GRATICULE = geoGraticule().step([30, 15]).precision(2)();

const rotateStream = (rotation, sink) => geoTransform({
  point(lambda, phi) {
    const p = rotation([lambda * RAD2DEG, phi * RAD2DEG]);
    this.stream.point(p[0] * DEG2RAD, p[1] * DEG2RAD);
  }
}).stream(sink);

// Clip in spherical space before resampling. Both renderers consume this stream,
// including the same antimeridian cuts and cap-boundary intersections.
const clipCap = (latitude, angle, sink) => {
  const rotation = geoRotation([0, latitude]);
  return rotateStream(rotation, geoClipCircle(angle * DEG2RAD)(rotateStream(rotation.invert, sink)));
};

const latitudeClip = (min, max) => (sink) => {
  let stream = geoClipAntimeridian(sink);
  if (max < 90) stream = clipCap(90, 90 + max, stream);
  if (min > -90) stream = clipCap(-90, 90 - min, stream);
  return stream;
};

export const lonLatToVector = ([lon, lat], radius = 1) => {
  const lambda = lon * DEG2RAD;
  const phi = lat * DEG2RAD;
  return [radius * Math.cos(phi) * Math.sin(lambda), radius * Math.sin(phi), radius * Math.cos(phi) * Math.cos(lambda)];
};

export const createProjectionModel = (family, mode, input = {}) => {
  const params = normalizeProjectionParams(family, mode, input);
  const transverse = family === 'cylinder' && params.aspect === 'transverse';
  const angles = family === 'planar'
    ? [-params.projectionCenterLon, -params.projectionCenterLat, 0]
    : [-params.centralMeridian, 0, transverse ? 90 : 0];
  const rotation = geoRotation(angles);
  const constants = family === 'conic'
    ? getConicConstants(mode, params.standardParallel1, params.standardParallel2) : null;
  let raw;
  if (family === 'cylinder') {
    raw = (mode === 'conformal' ? mercatorRaw : mode === 'equalArea' ? cylindricalEqualAreaRaw : equidistantCylindricalRaw)(params.standardParallel);
  } else if (family === 'conic') {
    raw = conicRaw(mode, params.standardParallel1, params.standardParallel2, params.latitudeOfOrigin);
  } else {
    const base = mode === 'conformal' ? geoStereographicRaw : mode === 'equalArea' ? geoAzimuthalEqualAreaRaw : geoOrthographicRaw;
    // D3 stereographicRaw has half the true-scale tangent-plane radius.
    const factor = mode === 'conformal' ? 1 + Math.cos(params.standardCircleDistance * DEG2RAD) : 1;
    raw = (lambda, phi) => base(lambda, phi).map((v) => v * factor);
    raw.invert = (x, y) => base.invert(x / factor, y / factor);
  }
  const output = (point) => transverse ? [point[1], -point[0]] : point;
  const undoOutput = (point) => transverse ? [-point[1], point[0]] : point;
  const displayRaw = (lambda, phi) => output(raw(lambda, phi));
  displayRaw.invert = (x, y) => raw.invert(...undoOutput([x, y]));

  let latitudeRange = [-90, 90];
  if (family === 'cylinder' && mode === 'conformal') latitudeRange = [-85, 85];
  if (family === 'conic') {
    latitudeRange = constants.n > 0 ? [-20, 85] : constants.n < 0 ? [-85, 20] : [-85, 85];
    // Keep standard parallels off the clip boundary: short geodesic chords
    // between latitude samples bow slightly poleward and would be cut to dots.
    latitudeRange[0] = Math.min(latitudeRange[0], params.standardParallel1 - 2, params.standardParallel2 - 2);
    latitudeRange[1] = Math.max(latitudeRange[1], params.standardParallel1 + 2, params.standardParallel2 + 2);
    latitudeRange = latitudeRange.map((lat) => clamp(lat, -85, 85));
  }
  const createProjection = () => {
    const projection = geoProjection(displayRaw).rotate(angles).scale(1).translate([0, 0]).precision(0.002);
    // Preserve the latitude-of-origin offset: D3 otherwise recenters raw(0, 0).
    projection.center(family === 'conic' ? [0, params.latitudeOfOrigin] : [0, 0]);
    if (family === 'planar') projection.clipAngle(90);
    else projection.preclip(latitudeClip(...latitudeRange));
    return projection;
  };
  const projection = createProjection();
  const bounds = geoPath(projection).bounds(SPHERE);
  const center = [(bounds[0][0] + bounds[1][0]) / 2, -(bounds[0][1] + bounds[1][1]) / 2];
  const contains = (coord, margin = 0) => {
    const local = rotation(coord);
    if (family === 'planar') return Math.cos(local[0] * DEG2RAD) * Math.cos(local[1] * DEG2RAD) >= Math.sin(margin * DEG2RAD) - 1e-9;
    return local[1] >= latitudeRange[0] + margin && local[1] <= latitudeRange[1] - margin;
  };
  const standard = getStandardFeatures(family, params, mode);
  let standardGeometry;
  if (family === 'planar') {
    standardGeometry = params.standardCircleDistance === 0
      ? { type: 'Point', coordinates: [params.projectionCenterLon, params.projectionCenterLat] }
      : { type: 'LineString', coordinates: geoCircle().center([params.projectionCenterLon, params.projectionCenterLat]).radius(params.standardCircleDistance).precision(2)().coordinates[0] };
  } else {
    standardGeometry = { type: 'MultiLineString', coordinates: standard.values.map((lat) =>
      Array.from({ length: 361 }, (_, i) => rotation.invert([-180 + i, lat]))) };
  }
  const origin = family === 'planar' ? [params.projectionCenterLon, params.projectionCenterLat]
    : [params.centralMeridian, family === 'conic' ? params.latitudeOfOrigin : 0];
  const domainLabel = family === 'planar' ? '展示范围：以投影中心为准的半球（角距 ≤ 90°）'
    : family === 'conic' ? `展示纬度：${latitudeRange[0]}° 至 ${latitudeRange[1]}°（区域投影）`
      : mode === 'conformal' ? `展示范围：${transverse ? '轴向' : ''}纬度 ±85°，极点不在定义域内` : '展示范围：全球（沿背面经线分割）';
  const surface = { rho0: 0, anchor: 0, originOffset: 0 };
  if (family === 'conic' && constants.n !== 0) {
    const refLat = (params.standardParallel1 + params.standardParallel2) / 2;
    const rhoAt = (lat) => Math.abs(conicForward(0, lat * DEG2RAD, mode, params.standardParallel1, params.standardParallel2).rho);
    surface.rho0 = rhoAt(params.latitudeOfOrigin);
    surface.anchor = Math.sin(refLat * DEG2RAD) + Math.sign(constants.n) * Math.sqrt(1 - constants.n ** 2) * (rhoAt(refLat) - surface.rho0);
  } else if (family === 'conic') surface.originOffset = -raw(0, 0)[1];
  return { family, mode, params, transverse, constants, raw, rotation, output, undoOutput, projection, createProjection, bounds, center, contains, standardGeometry, origin, latitudeRange, domainLabel, surface };
};

export const projectedLines = (model, geometry) => {
  const lines = [];
  let line = null;
  let polygon = false;
  geoStream(geometry, model.projection.stream({
    point(x, y) {
      if (!Number.isFinite(x + y)) throw new Error('Non-finite projected coordinate');
      if (line) line.push([x, -y]);
      else lines.push([[x, -y]]);
    },
    lineStart() { line = []; },
    lineEnd() {
      if (polygon && line.length > 1) line.push([...line[0]]);
      if (line.length) lines.push(line);
      line = null;
    },
    polygonStart() { polygon = true; },
    polygonEnd() { polygon = false; },
    sphere() {}
  }));
  return lines;
};

export const fitProjection = (model, width, height, zoom = 100) => {
  const padding = 22;
  const availableHeight = Math.max(1, height - 80);
  const [[x0, y0], [x1, y1]] = model.bounds;
  const scale = Math.min((width - padding * 2) / (x1 - x0), (availableHeight - padding * 2) / (y1 - y0)) * zoom / 100;
  return model.createProjection().scale(scale).precision(0.002 * scale)
    .translate([width / 2 - scale * (x0 + x1) / 2, 64 + availableHeight / 2 - scale * (y0 + y1) / 2]);
};

export const surfacePoint = (model, point, unfold = 0, radius = 5) => {
  const u = clamp(unfold, 0, 1);
  const [x, y] = model.undoOutput(point);
  const { family, mode, params, constants } = model;
  if (u === 1) return [point[0] * radius, point[1] * radius, 0];
  if (family === 'planar') return [x * radius, y * radius, (1 - u) * radius * Math.cos(params.standardCircleDistance * DEG2RAD)];
  const local = model.raw.invert(x, y);
  const lambda = local[0];
  const phi = local[1];
  let position;
  if (family === 'cylinder' || constants?.n === 0) {
    const r = radius * Math.cos((family === 'cylinder' ? params.standardParallel : params.standardParallel1) * DEG2RAD);
    const bend = 1 - u;
    const angle = lambda * bend;
    position = [r / bend * Math.sin(angle), radius * (y + model.surface.originOffset * bend), r / bend * (-2 * Math.sin(angle / 2) ** 2) + r * bend];
  } else {
    // Open the cone isometrically: slant distance and arc length stay fixed.
    const n = constants.n;
    const sign = Math.sign(n);
    const opening = Math.abs(n) + (1 - Math.abs(n)) * u * (2 - u);
    const rho = Math.abs(conicForward(lambda, phi, mode, params.standardParallel1, params.standardParallel2).rho) * radius;
    const rho0 = model.surface.rho0 * radius;
    const angle = Math.abs(n) * lambda / opening;
    const deltaRho = rho - rho0;
    const vertical = -sign * Math.sqrt(1 - opening ** 2) * deltaRho;
    const depth = opening * (deltaRho * Math.cos(angle) - 2 * rho0 * Math.sin(angle / 2) ** 2);
    const tilt = sign * u * Math.PI / 2;
    const anchor = model.surface.anchor * radius;
    position = [rho * opening * Math.sin(angle), vertical * Math.cos(tilt) - depth * Math.sin(tilt) + anchor * (1 - u), vertical * Math.sin(tilt) + depth * Math.cos(tilt) + Math.abs(n) * rho0 * (1 - u)];
  }
  if (model.transverse) position = [position[1], -position[0], position[2]];
  return position;
};

export const sourcePoint = (model, point, radius = 5) => {
  const local = model.raw.invert(...model.undoOutput(point)).map((v) => v * RAD2DEG);
  const v = lonLatToVector(local, radius);
  return model.transverse ? [v[1], -v[0], v[2]] : v;
};

export const projectionLinks = (model, radius = 5) => {
  const links = [];
  const cylindrical = model.family === 'cylinder';
  const longitudes = cylindrical ? [-120, 0, 120] : model.family === 'planar' ? [-60, -30, 0, 30, 60] : [-150, -90, -30, 30, 90, 150];
  const samples = (cylindrical ? [-40, -20, 20, 40] : [-40, 0, 40]).flatMap(lat => longitudes.map(lon => [lon, lat]));
  if (cylindrical && ![20, 40].includes(model.params.standardParallel)) {
    samples.push([0, model.params.standardParallel]);
    if (model.params.standardParallel) samples.push([0, -model.params.standardParallel]);
  }
  for (const [lon, lat] of samples) {
    const geographic = model.rotation.invert([lon, lat]);
    if (!model.contains(geographic, 3)) continue;
    const flat = model.output(model.raw(lon * DEG2RAD, lat * DEG2RAD));
    const source = sourcePoint(model, flat, radius);
    const target = surfacePoint(model, flat, 0, radius);
    if (!cylindrical && Math.hypot(...target.map((v, i) => v - source[i])) < radius * 0.015) continue;
    const kind = cylindrical ? 'construction' : model.family !== 'planar' || model.mode === 'equalArea' ? 'mapping'
      : model.mode === 'conformal' ? 'perspective' : 'parallel';
    const origin = cylindrical ? [0, 0, 0] : kind === 'perspective' ? [0, 0, -radius]
      : kind === 'parallel' ? [source[0], source[1], radius * 1.3] : source;
    let geometric = null;
    if (cylindrical) {
      const r = radius * Math.cos(model.params.standardParallel * DEG2RAD);
      const radial = Math.hypot(source[model.transverse ? 1 : 0], source[2]);
      geometric = source.map(v => v * r / radial);
      const low = radius * model.raw(0, model.latitudeRange[0] * DEG2RAD)[1];
      const high = radius * model.raw(0, model.latitudeRange[1] * DEG2RAD)[1];
      const axial = geometric[model.transverse ? 0 : 1];
      // Do not display a geometric landing point beyond the drawn auxiliary face.
      if (axial < low - 1e-7 || axial > high + 1e-7) continue;
    }
    links.push({ geographic, flat, source, target, origin, kind, geometric, local: [lon, lat] });
  }
  const focus = links.find(link => link.local[0] === 0 && link.local[1] === model.params.standardParallel && Math.hypot(...link.target.map((v, i) => v - link.source[i])) > 1e-6)
    || links.find(link => link.local[0] === 0 && link.local[1] === 40)
    || links.find(link => link.local[0] === 0 && link.local[1] > 0) || links[0];
  if (focus) focus.focus = true;
  return links;
};

export const cylindricalStandardComparison = (mode, params) => {
  const p = normalizeProjectionParams('cylinder', mode, params);
  const raw = (mode === 'conformal' ? mercatorRaw : mode === 'equalArea' ? cylindricalEqualAreaRaw : equidistantCylindricalRaw)(p.standardParallel);
  const phi = p.standardParallel * DEG2RAD;
  return { latitude: p.standardParallel, radius: Math.cos(phi), sphere: Math.sin(phi), mapped: raw(0, phi)[1] };
};
