import { geoConicConformalRaw, geoConicEqualAreaRaw, geoConicEquidistantRaw } from 'd3';

export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

export const PROJECTION_FAMILIES = {
  cylinder: {
    key: 'cylinder',
    label: '圆柱投影',
    labelEn: 'Cylindrical',
    description: '以圆柱作为辅助投影面，经纬网按投影公式映射后展开。'
  },
  planar: {
    key: 'planar',
    label: '方位投影',
    labelEn: 'Azimuthal',
    description: '以平面作为辅助投影面，方位角与距中心的径向函数共同确定坐标。'
  },
  conic: {
    key: 'conic',
    label: '圆锥投影',
    labelEn: 'Conic',
    description: '以圆锥作为辅助投影面，标准纬线决定圆锥常数与径向函数。'
  }
};

export const PROJECTION_MODES = {
  conformal: { key: 'conformal', label: '等角', labelEn: 'Conformal' },
  equalArea: { key: 'equalArea', label: '等面积', labelEn: 'Equal-Area' },
  compromise: { key: 'compromise', label: '常用投影', labelEn: 'Common Projection' }
};

export const PROJECTION_CONFIG = {
  cylinder: {
    conformal: {
      title: '墨卡托投影',
      titleEn: 'Mercator',
      property: '等角圆柱投影',
      d3Name: 'geoProjection',
      history: '1569 年，Gerardus Mercator 为航海制图提出该投影。它使恒向线呈直线，便于用固定罗盘方位航行。',
      usage: '适合航海方向判读、Web 地图局部浏览和低中纬区域导航，不适合全球面积比较。',
      distortion: '保持局部角度与形状，高纬地区面积和距离被快速放大。'
    },
    equalArea: {
      title: '兰伯特等面积圆柱投影',
      titleEn: 'Lambert Cylindrical Equal-Area',
      property: '等面积圆柱投影',
      d3Name: 'geoProjection',
      history: 'Johann Heinrich Lambert 在 18 世纪系统讨论了等面积投影，该投影是圆柱等面积投影的经典形式。',
      usage: '适合全球专题统计、面积对比和人口、资源等分布图。',
      distortion: '保持面积比例，但高纬形状被压缩，标准纬线附近形状变形较小。'
    },
    compromise: {
      title: '等距圆柱投影',
      titleEn: 'Equidistant Cylindrical',
      property: '等距圆柱投影',
      d3Name: 'geoProjection',
      history: '经纬网投影是最直观的经纬度到平面直角坐标映射，古典制图和栅格数据展示中长期使用。',
      usage: '适合教学、经纬度栅格数据快速查看和全球数据索引，不适合作为精确量测地图。',
      distortion: '沿经线的长度比例为 1，标准纬线上的长度比例为 1；不保持任意两点间距离，也不保持面积或角度。'
    }
  },
  planar: {
    conformal: {
      title: '球面立体投影',
      titleEn: 'Stereographic',
      property: '等角方位投影',
      d3Name: 'geoStereographic',
      history: '立体投影在古典天文学、星图和极区制图中使用很早，也与复变函数几何有密切关系。',
      usage: '适合极区、半球附近和需要保持局部角度关系的地图。',
      distortion: '保持局部角度，离投影中心越远面积和距离放大越明显，对跖点附近趋向无穷。'
    },
    equalArea: {
      title: '兰伯特等面积方位投影',
      titleEn: 'Lambert Azimuthal Equal-Area',
      property: '等面积方位投影',
      d3Name: 'geoAzimuthalEqualArea',
      history: 'Lambert 方位等面积投影是经典方位等面积投影，常用于半球、大洲和极区面积表达。',
      usage: '适合洲际范围、半球范围和强调面积真实的专题图。',
      distortion: '保持面积比例，离中心越远形状和角度变形越明显。'
    },
    compromise: {
      title: '正射投影',
      titleEn: 'Orthographic',
      property: '平行透视方位投影',
      d3Name: 'geoOrthographic',
      history: '正射投影模拟从无限远处观察地球的平行投影，是天文学和地球外观表达中的经典方法。',
      usage: '适合展示半球外观、空间视角和直观的地球表面位置关系。',
      distortion: '只显示一个半球，边缘区域距离、面积和形状压缩明显，不保持等角或等面积。'
    }
  },
  conic: {
    conformal: {
      title: '兰伯特等角圆锥投影',
      titleEn: 'Lambert Conformal Conic',
      property: '等角圆锥投影',
      d3Name: 'geoConicConformal',
      history: 'Lambert 在 18 世纪提出该投影。它长期用于航空图、气象图和中纬度国家基础制图。',
      usage: '适合中国、美国等中纬度东西向延伸区域，常用于航空、气象和行政区地图。',
      distortion: '保持局部角度，两条标准纬线附近变形最小，远离标准纬线后比例变形增大。'
    },
    equalArea: {
      title: '阿尔伯斯等面积圆锥投影',
      titleEn: 'Albers Equal-Area Conic',
      property: '等面积圆锥投影',
      d3Name: 'geoConicEqualArea',
      history: 'Heinrich Christian Albers 于 1805 年提出该投影，是双标准纬线等面积圆锥投影的代表。',
      usage: '适合中纬度东西向区域的面积统计和专题制图，例如国家、省域或大陆尺度面积比较。',
      distortion: '保持面积比例，标准纬线附近形状较稳定，南北远离后形状变形增加。'
    },
    compromise: {
      title: '等距圆锥投影',
      titleEn: 'Equidistant Conic',
      property: '等距圆锥投影',
      d3Name: 'geoConicEquidistant',
      history: '等距圆锥投影是经典圆锥投影之一，因公式直接、距离特性清晰，常用于教学和区域制图。',
      usage: '适合需要表达沿经线方向距离关系的中纬度区域地图。',
      distortion: '沿经线及标准纬线的长度比例为 1；不保持任意两点间距离，也不保持面积或角度。'
    }
  }
};

export const DEFAULT_PARAMS = {
  centralMeridian: 0,
  latitudeOfOrigin: 0,
  projectionCenterLon: 0,
  projectionCenterLat: 0,
  standardParallel: 0,
  standardParallel1: 25,
  standardParallel2: 47,
  standardCircleDistance: 0,
  aspect: 'normal',
  viewScale: 100,
  showGraticule: true,
  showStandardLine: true,
  showIndicatrix: false,
  showSurface: true,
  showRays: true,
  showProjectedImage: true,
  showLightSource: true
};

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const finiteNumber = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export const getProjectionDetails = (family, mode, params = {}) => {
  const details = { ...(PROJECTION_CONFIG[family]?.[mode] || PROJECTION_CONFIG.cylinder.conformal) };
  if (family === 'cylinder') {
    const p = normalizeProjectionParams(family, mode, params);
    if (mode === 'equalArea' && p.standardParallel !== 0) {
      details.title = '圆柱等面积投影';
      details.titleEn = 'Cylindrical Equal-Area';
    }
    if (mode === 'compromise' && p.standardParallel === 0) {
      details.title = '等距圆柱投影（方格网）';
      details.titleEn = 'Plate Carrée';
    }
    if (p.aspect === 'transverse') {
      details.title = mode === 'conformal' ? '横轴墨卡托投影（球面）' : `横轴${mode === 'equalArea' ? '圆柱等面积' : '等距圆柱'}投影`;
      details.titleEn = `Transverse ${mode === 'conformal' ? 'Mercator' : mode === 'equalArea' ? 'Cylindrical Equal-Area' : 'Equidistant Cylindrical'}`;
      details.history = '由相应正轴圆柱投影作球面轴向变换得到，以重新选定的球面极轴建立坐标；并非直接旋转一幅已经绘制的平面地图。';
      details.usage = '球面横轴模型，适合中央经线附近的南北向区域；不是采用参考椭球与分带参数的 UTM 坐标系。';
      details.distortion = mode === 'conformal' ? '保持局部角度；远离中央经线变形增大，距轴向赤道 90° 处出现奇点。' : '性质作用于旋转后的球面坐标；红线为轴向标准线，不是地理纬线。';
    }
  }
  return details;
};

export const normalizeProjectionParams = (family = 'cylinder', mode = 'conformal', params = {}) => {
  const source = { ...DEFAULT_PARAMS, ...params };
  const normalized = {
    centralMeridian: clamp(finiteNumber(source.centralMeridian, 0), -180, 180),
    latitudeOfOrigin: clamp(finiteNumber(source.latitudeOfOrigin, 0), -80, 80),
    projectionCenterLon: clamp(finiteNumber(source.projectionCenterLon, source.centralMeridian ?? 0), -180, 180),
    projectionCenterLat: clamp(finiteNumber(source.projectionCenterLat, source.latitudeOfOrigin ?? 0), -90, 90),
    standardParallel: clamp(Math.abs(finiteNumber(source.standardParallel, 0)), 0, 75),
    standardParallel1: clamp(finiteNumber(source.standardParallel1, 25), -80, 80),
    standardParallel2: clamp(finiteNumber(source.standardParallel2, 47), -80, 80),
    standardCircleDistance: clamp(Math.abs(finiteNumber(source.standardCircleDistance, 0)), 0, 75),
    aspect: source.aspect === 'transverse' ? 'transverse' : 'normal',
    viewScale: clamp(finiteNumber(source.viewScale, 100), 60, 180),
    showGraticule: Boolean(source.showGraticule),
    showStandardLine: Boolean(source.showStandardLine),
    showIndicatrix: Boolean(source.showIndicatrix),
    showSurface: Boolean(source.showSurface),
    showRays: Boolean(source.showRays),
    showProjectedImage: Boolean(source.showProjectedImage),
    showLightSource: Boolean(source.showLightSource)
  };

  if (family === 'planar') {
    normalized.centralMeridian = normalized.projectionCenterLon;
    normalized.latitudeOfOrigin = normalized.projectionCenterLat;
  }

  if (family === 'conic') {
    let phi1 = normalized.standardParallel1;
    let phi2 = normalized.standardParallel2;

    normalized.standardParallel1 = phi1;
    normalized.standardParallel2 = phi2;
    normalized.standardParallel = Math.abs((phi1 + phi2) / 2);
    normalized.latitudeOfOrigin = clamp(
      finiteNumber(source.latitudeOfOrigin, (phi1 + phi2) / 2),
      -80,
      80
    );
  }

  if (family === 'cylinder') {
    normalized.standardParallel1 = normalized.standardParallel;
    normalized.standardParallel2 = -normalized.standardParallel;
  }

  return normalized;
};

export const mercatorRaw = (standardParallel = 0) => {
  const k0 = Math.max(0.05, Math.cos(standardParallel * DEG2RAD));
  const raw = (lambda, phi) => {
    return [
      k0 * lambda,
      k0 * Math.asinh(Math.tan(phi))
    ];
  };
  raw.invert = (x, y) => [x / k0, Math.atan(Math.sinh(y / k0))];
  return raw;
};

export const cylindricalEqualAreaRaw = (standardParallel = 0) => {
  const cosStandard = Math.max(0.05, Math.cos(standardParallel * DEG2RAD));
  const raw = (lambda, phi) => [
    lambda * cosStandard,
    Math.sin(phi) / cosStandard
  ];
  raw.invert = (x, y) => [x / cosStandard, Math.asin(clamp(y * cosStandard, -1, 1))];
  return raw;
};

export const equidistantCylindricalRaw = (standardParallel = 0) => {
  const cosStandard = Math.max(0.05, Math.cos(standardParallel * DEG2RAD));
  const raw = (lambda, phi) => [
    lambda * cosStandard,
    phi
  ];
  raw.invert = (x, y) => [x / cosStandard, y];
  return raw;
};

export const getStandardFeatures = (family, params, mode = 'conformal') => {
  const normalized = normalizeProjectionParams(family, 'conformal', params);

  if (family === 'cylinder') {
    const lat = Math.abs(normalized.standardParallel);
    return {
      type: 'latitudes',
      values: lat === 0 ? [0] : [lat, -lat],
      label: normalized.aspect === 'transverse'
        ? `轴向标准线：旋转后纬度 ±${lat.toFixed(1)}°，不是地理纬线`
        : lat === 0 ? '标准纬线：赤道（纬度 0°）' : `割线纬度：±${lat.toFixed(1)}°，沿纬线长度比例为 1`
    };
  }

  if (family === 'conic') {
    const values = [normalized.standardParallel1, normalized.standardParallel2]
      .filter((lat) => Number.isFinite(lat))
      .map((lat) => Number(lat.toFixed(6)));
    return {
      type: 'latitudes',
      values: [...new Set(values)],
      label: new Set(values).size > 1 ? '双标准纬线：沿这两条纬线的长度比例为 1' : '单标准纬线：两参数相等，为相切形式'
    };
  }

  return {
    type: 'circle',
    values: [normalized.standardCircleDistance],
    label: normalized.standardCircleDistance === 0 ? '辅助平面在投影中心相切'
      : mode === 'conformal' ? `交圈角距 ${normalized.standardCircleDistance.toFixed(1)}°；该圈局部长度比例为 1`
        : `辅助平面交圈角距 ${normalized.standardCircleDistance.toFixed(1)}°；交圈不是无变形圈`
  };
};

export const getAzimuthalPlaneDistance = (radius, standardCircleDistance = 0) =>
  radius * Math.cos(clamp(Math.abs(standardCircleDistance), 0, 75) * DEG2RAD);

export const getConicConstants = (mode, standardParallel1, standardParallel2) => {
  const phi1 = clamp(standardParallel1, -80, 80) * DEG2RAD;
  const phi2 = clamp(standardParallel2, -80, 80) * DEG2RAD;
  const sameParallel = Math.abs(phi1 - phi2) < 1e-7;

  if (mode === 'conformal') {
    const t = (phi) => Math.tan(Math.PI / 4 + phi / 2);
    const n = sameParallel
      ? Math.sin(phi1)
      : Math.log(Math.cos(phi1) / Math.cos(phi2)) / Math.log(t(phi2) / t(phi1));
    if (Math.abs(n) < 1e-7) return { n: 0, k: Math.cos(phi1) };
    const safeN = n;
    const F = Math.cos(phi1) * Math.pow(t(phi1), safeN) / safeN;
    return { n: safeN, F, rho0: F };
  }

  if (mode === 'equalArea') {
    const n = sameParallel ? Math.sin(phi1) : 0.5 * (Math.sin(phi1) + Math.sin(phi2));
    if (Math.abs(n) < 1e-7) return { n: 0, k: Math.cos(phi1) };
    const safeN = n;
    const C = Math.cos(phi1) ** 2 + 2 * safeN * Math.sin(phi1);
    return { n: safeN, C, rho0: Math.sqrt(Math.max(0.0001, C)) / safeN };
  }

  const n = sameParallel ? Math.sin(phi1) : (Math.cos(phi1) - Math.cos(phi2)) / (phi2 - phi1);
  if (Math.abs(n) < 1e-7) return { n: 0, k: Math.cos(phi1) };
  const safeN = n;
  const G = Math.cos(phi1) / safeN + phi1;
  return { n: safeN, G, rho0: G };
};

const getConicRho = (phi, mode, constants, scale = 1) => {
  if (mode === 'conformal') {
    const clampedPhi = clamp(phi, -Math.PI / 2 + 1e-9, Math.PI / 2 - 1e-9);
    return scale * constants.F / Math.pow(Math.tan(Math.PI / 4 + clampedPhi / 2), constants.n);
  }

  if (mode === 'equalArea') {
    return scale * Math.sqrt(Math.max(0, constants.C - 2 * constants.n * Math.sin(phi))) / constants.n;
  }

  return scale * (constants.G - phi);
};

export const conicForward = (
  lambda,
  phi,
  mode,
  standardParallel1,
  standardParallel2,
  scale = 1,
  latitudeOfOrigin = 0
) => {
  const constants = getConicConstants(mode, standardParallel1, standardParallel2);
  if (constants.n === 0) {
    const raw = mode === 'conformal' ? mercatorRaw(standardParallel1)
      : mode === 'equalArea' ? cylindricalEqualAreaRaw(standardParallel1) : equidistantCylindricalRaw(standardParallel1);
    const point = raw(lambda, phi);
    return { x: scale * point[0], y: scale * (point[1] - raw(0, latitudeOfOrigin * DEG2RAD)[1]), n: 0 };
  }
  const theta = constants.n * lambda;
  const rho = getConicRho(phi, mode, constants, scale);
  const rho0 = getConicRho(latitudeOfOrigin * DEG2RAD, mode, constants, scale);
  return {
    x: rho * Math.sin(theta),
    y: rho0 - rho * Math.cos(theta),
    rho,
    theta,
    n: constants.n
  };
};

export const conicRaw = (mode, standardParallel1, standardParallel2, latitudeOfOrigin = 0) => {
  const constants = getConicConstants(mode, standardParallel1, standardParallel2);
  let base;
  if (constants.n === 0) {
    base = mode === 'conformal' ? mercatorRaw(standardParallel1)
      : mode === 'equalArea' ? cylindricalEqualAreaRaw(standardParallel1) : equidistantCylindricalRaw(standardParallel1);
  } else {
    const factory = mode === 'conformal' ? geoConicConformalRaw
      : mode === 'equalArea' ? geoConicEqualAreaRaw : geoConicEquidistantRaw;
    base = factory(standardParallel1 * DEG2RAD, standardParallel2 * DEG2RAD);
  }
  const offset = base(0, latitudeOfOrigin * DEG2RAD)[1];
  const raw = (lambda, phi) => {
    const [x, y] = base(lambda, phi);
    return [x, y - offset];
  };
  raw.invert = (x, y) => base.invert(x, y + offset);
  return raw;
};

export const getSurfaceMetrics = (family, mode, params, radius = 5) => {
  const normalized = normalizeProjectionParams(family, mode, params);

  if (family === 'cylinder') {
    const cylinderRadius = radius * Math.cos(normalized.standardParallel * DEG2RAD);
    return {
      contact: normalized.standardParallel === 0 ? '相切圆柱 Tangent Cylinder' : '相割圆柱 Secant Cylinder',
      primary: `圆柱半径 ${(cylinderRadius / radius).toFixed(3)} R`,
      radius: cylinderRadius,
      aspectLabel: normalized.aspect === 'transverse' ? '横轴 Transverse' : '正轴 Normal'
    };
  }

  if (family === 'planar') {
    const planeDistance = getAzimuthalPlaneDistance(radius, normalized.standardCircleDistance);
    return {
      contact: normalized.standardCircleDistance === 0 ? '切平面 Tangent Plane' : '割平面 Secant Plane',
      primary: `平面距球心 ${(planeDistance / radius).toFixed(3)} R`,
      distance: planeDistance
    };
  }

  const constants = getConicConstants(mode, normalized.standardParallel1, normalized.standardParallel2);
  return {
    contact: constants.n === 0 ? '圆柱极限形式' : '数学辅助圆锥',
    primary: `圆锥常数 n=${constants.n !== 0 && Math.abs(constants.n) < 0.001 ? constants.n.toExponential(2) : constants.n.toFixed(3)}`,
    n: constants.n
  };
};
