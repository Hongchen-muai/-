export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

export const PROJECTION_FAMILIES = {
  cylinder: {
    key: 'cylinder',
    label: '圆柱投影',
    labelEn: 'Cylindrical',
    description: '以圆柱作为承影面，适合讲解经纬网展开、标准纬线与圆柱半径之间的关系。'
  },
  planar: {
    key: 'planar',
    label: '平面/方位投影',
    labelEn: 'Planar / Azimuthal',
    description: '以平面作为承影面，围绕投影中心展示切平面、割平面和半球裁切。'
  },
  conic: {
    key: 'conic',
    label: '圆锥投影',
    labelEn: 'Conic',
    description: '以圆锥作为承影面，适合中纬度东西向区域和双标准纬线教学。'
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
      title: '等距圆柱投影 / 经纬网投影',
      titleEn: 'Plate Carrée / Equidistant Cylindrical',
      property: '等距圆柱投影',
      d3Name: 'geoProjection',
      history: '经纬网投影是最直观的经纬度到平面直角坐标映射，古典制图和栅格数据展示中长期使用。',
      usage: '适合教学、经纬度栅格数据快速查看和全球数据索引，不适合作为精确量测地图。',
      distortion: '经纬线间隔规则，沿标准纬线方向比例较真实，远离标准纬线后面积和形状变形明显。'
    }
  },
  planar: {
    conformal: {
      title: '极射赤面投影',
      titleEn: 'Stereographic',
      property: '等角方位投影',
      d3Name: 'geoStereographic',
      history: '极射赤面投影在古典天文学、星图和极区制图中使用很早，也与复变函数几何有密切关系。',
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
      property: '透视外观方位投影',
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
      distortion: '沿经线方向距离保持较好，标准纬线处比例真实，但不保持整体面积或角度。'
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

export const getProjectionDetails = (family, mode) =>
  PROJECTION_CONFIG[family]?.[mode] || PROJECTION_CONFIG.cylinder.conformal;

export const normalizeProjectionParams = (family = 'cylinder', mode = 'conformal', params = {}) => {
  const source = { ...DEFAULT_PARAMS, ...params };
  const normalized = {
    centralMeridian: clamp(finiteNumber(source.centralMeridian, 0), -180, 180),
    latitudeOfOrigin: clamp(finiteNumber(source.latitudeOfOrigin, 0), -80, 80),
    projectionCenterLon: clamp(finiteNumber(source.projectionCenterLon, source.centralMeridian ?? 0), -180, 180),
    projectionCenterLat: clamp(finiteNumber(source.projectionCenterLat, source.latitudeOfOrigin ?? 0), -85, 85),
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
    const minAbsParallel = 1;
    let phi1 = normalized.standardParallel1;
    let phi2 = normalized.standardParallel2;

    if (Math.abs(phi1) < minAbsParallel) phi1 = phi1 < 0 ? -minAbsParallel : minAbsParallel;
    if (Math.abs(phi2) < minAbsParallel) phi2 = phi2 < 0 ? -minAbsParallel : minAbsParallel;

    if (phi1 * phi2 < 0) {
      phi2 = Math.sign(phi1 || 1) * Math.abs(phi2);
    }

    if (Math.abs(phi1 - phi2) < 0.5) {
      const direction = phi1 >= 0 ? 1 : -1;
      phi2 = clamp(phi1 + direction * 0.5, -80, 80);
      if (Math.abs(phi1 - phi2) < 0.5) {
        phi1 = clamp(phi2 - direction * 0.5, -80, 80);
      }
    }

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
  return (lambda, phi) => {
    const clampedPhi = clamp(phi, -85 * DEG2RAD, 85 * DEG2RAD);
    return [
      k0 * lambda,
      k0 * Math.log(Math.tan(Math.PI / 4 + clampedPhi / 2))
    ];
  };
};

export const cylindricalEqualAreaRaw = (standardParallel = 0) => {
  const cosStandard = Math.max(0.05, Math.cos(standardParallel * DEG2RAD));
  return (lambda, phi) => [
    lambda * cosStandard,
    Math.sin(phi) / cosStandard
  ];
};

export const equidistantCylindricalRaw = (standardParallel = 0) => {
  const cosStandard = Math.max(0.05, Math.cos(standardParallel * DEG2RAD));
  return (lambda, phi) => [
    lambda * cosStandard,
    phi
  ];
};

export const getStandardFeatures = (family, params) => {
  const normalized = normalizeProjectionParams(family, 'conformal', params);

  if (family === 'cylinder') {
    const lat = Math.abs(normalized.standardParallel);
    return {
      type: 'latitudes',
      values: lat === 0 ? [0] : [lat, -lat],
      label: lat === 0 ? '相切圆柱：赤道为标准纬线' : `相割圆柱：±${lat.toFixed(1)}° 为标准纬线`
    };
  }

  if (family === 'conic') {
    const values = [normalized.standardParallel1, normalized.standardParallel2]
      .filter((lat) => Number.isFinite(lat))
      .map((lat) => Number(lat.toFixed(6)));
    return {
      type: 'latitudes',
      values: [...new Set(values)],
      label: values.length > 1 ? '相割圆锥：双标准纬线' : '相切圆锥：单标准纬线'
    };
  }

  return {
    type: 'circle',
    values: [normalized.standardCircleDistance],
    label: normalized.standardCircleDistance === 0 ? '切平面：投影中心为标准点' : `割平面：${normalized.standardCircleDistance.toFixed(1)}° 标准圈`
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
    const safeN = Math.abs(n) < 1e-6 ? (n < 0 ? -1e-6 : 1e-6) : n;
    const F = Math.cos(phi1) * Math.pow(t(phi1), safeN) / safeN;
    return { n: safeN, F, rho0: F };
  }

  if (mode === 'equalArea') {
    const n = sameParallel ? Math.sin(phi1) : 0.5 * (Math.sin(phi1) + Math.sin(phi2));
    const safeN = Math.abs(n) < 1e-6 ? (n < 0 ? -1e-6 : 1e-6) : n;
    const C = Math.cos(phi1) ** 2 + 2 * safeN * Math.sin(phi1);
    return { n: safeN, C, rho0: Math.sqrt(Math.max(0.0001, C)) / safeN };
  }

  const n = sameParallel ? Math.sin(phi1) : (Math.cos(phi1) - Math.cos(phi2)) / (phi2 - phi1);
  const safeN = Math.abs(n) < 1e-6 ? (n < 0 ? -1e-6 : 1e-6) : n;
  const G = Math.cos(phi1) / safeN + phi1;
  return { n: safeN, G, rho0: G };
};

const getConicRho = (phi, mode, constants, scale = 1) => {
  if (mode === 'conformal') {
    const clampedPhi = clamp(phi, -85 * DEG2RAD, 85 * DEG2RAD);
    return scale * constants.F / Math.pow(Math.tan(Math.PI / 4 + clampedPhi / 2), constants.n);
  }

  if (mode === 'equalArea') {
    return scale * Math.sqrt(Math.max(0.0001, constants.C - 2 * constants.n * Math.sin(phi))) / constants.n;
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

export const conicRaw = (mode, standardParallel1, standardParallel2, latitudeOfOrigin = 0) => (
  lambda,
  phi
) => {
  const point = conicForward(
    lambda,
    phi,
    mode,
    standardParallel1,
    standardParallel2,
    1,
    latitudeOfOrigin
  );
  return [point.x, point.y];
};

export const getSurfaceMetrics = (family, mode, params, radius = 5) => {
  const normalized = normalizeProjectionParams(family, mode, params);

  if (family === 'cylinder') {
    const cylinderRadius = radius * Math.cos(normalized.standardParallel * DEG2RAD);
    return {
      contact: normalized.standardParallel === 0 ? '相切圆柱 Tangent Cylinder' : '相割圆柱 Secant Cylinder',
      primary: `圆柱半径 ${cylinderRadius.toFixed(2)}R`,
      radius: cylinderRadius,
      aspectLabel: normalized.aspect === 'transverse' ? '横轴 Transverse' : '正轴 Normal'
    };
  }

  if (family === 'planar') {
    const planeDistance = getAzimuthalPlaneDistance(radius, normalized.standardCircleDistance);
    return {
      contact: normalized.standardCircleDistance === 0 ? '切平面 Tangent Plane' : '割平面 Secant Plane',
      primary: `平面距球心 ${planeDistance.toFixed(2)}R`,
      distance: planeDistance
    };
  }

  const constants = getConicConstants(mode, normalized.standardParallel1, normalized.standardParallel2);
  return {
    contact: Math.abs(normalized.standardParallel1 - normalized.standardParallel2) <= 0.6
      ? '切圆锥 Tangent Cone'
      : '割圆锥 Secant Cone',
    primary: `圆锥常数 n=${constants.n.toFixed(3)}`,
    n: constants.n
  };
};
