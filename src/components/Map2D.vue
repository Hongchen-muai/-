<template>
  <div class="map2d-view">
    <div class="map-header">
      <div>
        <span class="panel-kicker">精确二维投影</span>
        <h3>{{ details.title }} <span class="title-note">精确计算</span></h3>
        <p>{{ details.titleEn }} · {{ details.property }}</p>
      </div>
      <div class="map-actions">
        <div class="mode-tabs" aria-label="二维投影性质">
          <button
            v-for="mode in modeOptions"
            :key="mode.key"
            :class="{ active: props.projectionMode === mode.key }"
            @click="emit('update:projectionMode', mode.key)"
          >
            {{ mode.label }}
          </button>
        </div>
      </div>
    </div>

    <div class="map-canvas" ref="wrapperRef" @wheel.prevent="handleWheelScale">
      <div class="scale-overlay">
        <div class="scale-head">
          <span>地图显示比例尺</span>
          <input type="number" :value="params.viewScale" @change="handleScaleInput" />
        </div>
        <input
          type="range"
          min="60"
          max="180"
          :value="params.viewScale"
          @input="handleScaleInput"
        />
      </div>
      <svg ref="svgRef" role="img" :aria-label="`${details.title} 二维地图`"></svg>
      <div v-if="statusText" class="map-status">{{ statusText }}</div>
    </div>

    <div class="projection-notes">
      <section>
        <h4>历史来源</h4>
        <p>{{ details.history }}</p>
      </section>
      <section>
        <h4>典型用途</h4>
        <p>{{ details.usage }}</p>
      </section>
      <section>
        <h4>变形特征</h4>
        <p>{{ details.distortion }}</p>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import {
  DEG2RAD,
  PROJECTION_MODES,
  getProjectionDetails,
  normalizeProjectionParams,
  mercatorRaw,
  cylindricalEqualAreaRaw,
  equidistantCylindricalRaw,
  conicRaw,
  getStandardFeatures
} from '../core/mapMath.js';

const props = defineProps({
  projectionFamily: {
    type: String,
    default: 'cylinder'
  },
  projectionMode: {
    type: String,
    default: 'conformal'
  },
  projectionParams: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(['update:projectionMode', 'update:viewScale']);

const svgRef = ref(null);
const wrapperRef = ref(null);
const statusText = ref('');
let geoData = null;
let resizeObserver = null;

const params = computed(() =>
  normalizeProjectionParams(props.projectionFamily, props.projectionMode, props.projectionParams)
);

const details = computed(() => getProjectionDetails(props.projectionFamily, props.projectionMode));
const modeOptions = Object.values(PROJECTION_MODES);

const loadData = async () => {
  const response = await fetch(`${import.meta.env.BASE_URL}world-110m.json`);
  if (!response.ok) throw new Error(`Failed to load world data: ${response.status}`);
  const topology = await response.json();
  const landObject = topology.objects.land || topology.objects.countries;
  geoData = topojson.feature(topology, landObject);
  renderMap();
};

const configureProjection = (projection) => {
  const p = params.value;

  if (props.projectionFamily === 'planar') {
    projection
      .rotate([-p.projectionCenterLon, -p.projectionCenterLat, 0])
      .clipAngle(90);
    return projection;
  }

  if (props.projectionFamily === 'conic') {
    projection
      .rotate([-p.centralMeridian, -p.latitudeOfOrigin, 0])
      .center([0, 0]);
    return projection;
  }

  projection
    .rotate([-p.centralMeridian, -p.latitudeOfOrigin, p.aspect === 'transverse' ? 90 : 0])
    .center([0, 0]);

  return projection;
};

const createProjection = () => {
  const p = params.value;

  if (props.projectionFamily === 'cylinder') {
    if (props.projectionMode === 'conformal') {
      return configureProjection(d3.geoProjection(mercatorRaw(p.standardParallel)));
    }
    if (props.projectionMode === 'equalArea') {
      return configureProjection(d3.geoProjection(cylindricalEqualAreaRaw(p.standardParallel)));
    }
    return configureProjection(d3.geoProjection(equidistantCylindricalRaw(p.standardParallel)));
  }

  if (props.projectionFamily === 'planar') {
    if (props.projectionMode === 'conformal') return configureProjection(d3.geoStereographic());
    if (props.projectionMode === 'equalArea') return configureProjection(d3.geoAzimuthalEqualArea());
    return configureProjection(d3.geoOrthographic());
  }

  return configureProjection(d3.geoProjection(conicRaw(
    props.projectionMode,
    p.standardParallel1,
    p.standardParallel2,
    p.latitudeOfOrigin
  )));
};

const fitProjection = (projection, width, height) => {
  const fitObject = props.projectionFamily === 'planar' ? { type: 'Sphere' } : geoData;
  projection.fitExtent([[24, 24], [width - 24, height - 24]], fitObject);
  projection.scale(projection.scale() * (params.value.viewScale / 100));
  projection.translate([width / 2, height / 2]);
  return projection;
};

const standardLatitudeFeature = (lat) => ({
  type: 'Feature',
  geometry: {
    type: 'LineString',
    coordinates: d3.range(-180, 181, 2).map((lon) => [lon, lat])
  }
});

const standardCircleFeature = (centerLon, centerLat, radiusDeg) => {
  const lambda0 = centerLon * DEG2RAD;
  const phi0 = centerLat * DEG2RAD;
  const radius = Math.max(0.01, radiusDeg) * DEG2RAD;

  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: d3.range(0, 361, 2).map((angleDeg) => {
        const theta = angleDeg * DEG2RAD;
        const sinPhi = Math.sin(phi0) * Math.cos(radius) +
          Math.cos(phi0) * Math.sin(radius) * Math.cos(theta);
        const phi = Math.asin(Math.max(-1, Math.min(1, sinPhi)));
        const y = Math.sin(theta) * Math.sin(radius) * Math.cos(phi0);
        const x = Math.cos(radius) - Math.sin(phi0) * Math.sin(phi);
        const lambda = lambda0 + Math.atan2(y, x);
        return [
          ((((lambda * 180 / Math.PI) + 540) % 360) - 180),
          phi * 180 / Math.PI
        ];
      })
    }
  };
};

const createStandardGeometry = () => {
  const features = getStandardFeatures(props.projectionFamily, params.value);
  if (props.projectionFamily === 'planar') {
    const radius = features.values[0];
    return standardCircleFeature(
      params.value.projectionCenterLon,
      params.value.projectionCenterLat,
      radius
    );
  }

  return {
    type: 'FeatureCollection',
    features: features.values.map((lat) => standardLatitudeFeature(lat))
  };
};

const getIndicatrixCenters = () => {
  const longitudes = d3.range(-150, 181, 30);
  const latitudes = props.projectionFamily === 'planar'
    ? d3.range(-60, 61, 20)
    : d3.range(-60, 61, 15);
  const centers = [];
  latitudes.forEach((lat) => {
    longitudes.forEach((lon) => centers.push({ lon, lat }));
  });
  return centers;
};

const isVisibleInPlanarHemisphere = (lon, lat) => {
  if (props.projectionFamily !== 'planar') return true;
  const lambda = lon * DEG2RAD;
  const phi = lat * DEG2RAD;
  const lambda0 = params.value.projectionCenterLon * DEG2RAD;
  const phi0 = params.value.projectionCenterLat * DEG2RAD;
  const cosDistance = Math.sin(phi0) * Math.sin(phi) +
    Math.cos(phi0) * Math.cos(phi) * Math.cos(lambda - lambda0);
  return cosDistance >= 0.0001;
};

const localDerivative = (projection, lon, lat, deltaDeg = 0.35) => {
  const cosLat = Math.max(0.18, Math.cos(lat * DEG2RAD));
  const lambdaStep = deltaDeg / cosLat;
  const northA = projection([lon, Math.min(89.5, lat + deltaDeg)]);
  const northB = projection([lon, Math.max(-89.5, lat - deltaDeg)]);
  const eastA = projection([lon + lambdaStep, lat]);
  const eastB = projection([lon - lambdaStep, lat]);
  const center = projection([lon, lat]);

  if (!center || !northA || !northB || !eastA || !eastB) return null;
  if (![center, northA, northB, eastA, eastB].flat().every(Number.isFinite)) return null;

  const dPhi = deltaDeg * DEG2RAD;
  const dLambda = lambdaStep * DEG2RAD * cosLat;
  return {
    center,
    east: [(eastA[0] - eastB[0]) / (2 * dLambda), (eastA[1] - eastB[1]) / (2 * dLambda)],
    north: [(northA[0] - northB[0]) / (2 * dPhi), (northA[1] - northB[1]) / (2 * dPhi)]
  };
};

const singularValues = ({ east, north }) => {
  const a = east[0] * east[0] + east[1] * east[1];
  const b = east[0] * north[0] + east[1] * north[1];
  const c = north[0] * north[0] + north[1] * north[1];
  const trace = a + c;
  const determinant = Math.max(0, a * c - b * b);
  const root = Math.sqrt(Math.max(0, trace * trace / 4 - determinant));
  const lambda1 = Math.max(0.0001, trace / 2 + root);
  const lambda2 = Math.max(0.0001, trace / 2 - root);
  const angle = Math.abs(b) < 1e-9 && Math.abs(lambda1 - a) < 1e-9
    ? 0
    : Math.atan2(lambda1 - a, b || 1e-9);
  return {
    major: Math.sqrt(lambda1),
    minor: Math.sqrt(lambda2),
    angle: angle * 180 / Math.PI
  };
};

const createIndicatrixData = (projection) => {
  const raw = getIndicatrixCenters()
    .filter(({ lon, lat }) => isVisibleInPlanarHemisphere(lon, lat))
    .map(({ lon, lat }) => {
      const derivative = localDerivative(projection, lon, lat);
      if (!derivative) return null;
      const values = singularValues(derivative);
      return { ...derivative, ...values };
    })
    .filter(Boolean);

  if (!raw.length) return [];
  const medianScale = d3.median(raw, (d) => Math.sqrt(d.major * d.minor)) || 1;

  return raw.map((d) => ({
    cx: d.center[0],
    cy: d.center[1],
    rx: Math.max(2.5, Math.min(18, d.major / medianScale * 5)),
    ry: Math.max(2.5, Math.min(18, d.minor / medianScale * 5)),
    angle: d.angle,
    ratio: d.major / d.minor
  }));
};

const handleScaleInput = (event) => {
  emit('update:viewScale', Number(event.target.value));
};

const handleWheelScale = (event) => {
  const delta = event.deltaY > 0 ? -6 : 6;
  emit('update:viewScale', params.value.viewScale + delta);
};

const renderMap = () => {
  if (!svgRef.value || !wrapperRef.value || !geoData) return;

  const width = Math.max(360, wrapperRef.value.clientWidth);
  const height = Math.max(420, wrapperRef.value.clientHeight || 520);
  const svg = d3.select(svgRef.value);
  svg.selectAll('*').remove();
  svg.attr('viewBox', `0 0 ${width} ${height}`);
  statusText.value = '';

  const projection = fitProjection(createProjection(), width, height);
  const path = d3.geoPath(projection);

  svg.append('rect')
    .attr('width', width)
    .attr('height', height)
    .attr('fill', '#f7fafc');

  svg.append('path')
    .datum({ type: 'Sphere' })
    .attr('class', 'sphere-outline')
    .attr('d', path)
    .attr('fill', props.projectionFamily === 'planar' ? '#eef5f9' : 'none')
    .attr('stroke', '#9fb6c8')
    .attr('stroke-width', 1);

  if (params.value.showGraticule) {
    svg.append('path')
      .datum(d3.geoGraticule10())
      .attr('class', 'graticule')
      .attr('d', path)
      .attr('fill', 'none')
      .attr('stroke', '#c6d2dc')
      .attr('stroke-width', 0.7);
  }

  svg.append('g')
    .attr('class', 'land')
    .selectAll('path')
    .data(geoData.features)
    .enter()
    .append('path')
    .attr('d', path)
    .attr('fill', '#ffffff')
    .attr('stroke', '#263846')
    .attr('stroke-width', 0.8);

  if (params.value.showStandardLine) {
    svg.append('path')
      .datum(createStandardGeometry())
      .attr('class', 'standard-line')
      .attr('d', path)
      .attr('fill', 'none')
      .attr('stroke', '#d92d20')
      .attr('stroke-width', 2)
      .attr('stroke-linecap', 'round');
  }

  if (params.value.showIndicatrix) {
    const indicatrixData = createIndicatrixData(projection);
    if (indicatrixData.length) {
      svg.append('g')
        .attr('class', 'indicatrix-layer')
        .selectAll('ellipse')
        .data(indicatrixData)
        .enter()
        .append('ellipse')
        .attr('cx', (d) => d.cx)
        .attr('cy', (d) => d.cy)
        .attr('rx', (d) => d.rx)
        .attr('ry', (d) => d.ry)
        .attr('transform', (d) => `rotate(${d.angle}, ${d.cx}, ${d.cy})`)
        .attr('fill', '#f97316')
        .attr('fill-opacity', 0.38)
        .attr('stroke', '#c2410c')
        .attr('stroke-width', 0.8);
    } else {
      statusText.value = '当前参数下变形椭圆已隐藏';
    }
  }
};

watch(
  () => [props.projectionFamily, props.projectionMode, props.projectionParams],
  () => nextTick(renderMap),
  { deep: true }
);

onMounted(() => {
  loadData().catch((error) => {
    statusText.value = '世界地图数据加载失败';
    console.error(error);
  });
  resizeObserver = new ResizeObserver(() => renderMap());
  if (wrapperRef.value) resizeObserver.observe(wrapperRef.value);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
});
</script>

<style scoped>
.map2d-view {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 100%;
  background: #ffffff;
  color: #1f3346;
}

.map-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  min-height: 126px;
  padding: 17px 18px;
  border-bottom: 1px solid #dce5ec;
  background: #ffffff;
}

.panel-kicker {
  display: block;
  color: #607487;
  font-family: "Segoe UI", Arial, sans-serif;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.1em;
}

.map-header h3 {
  margin: 5px 0 3px;
  color: #12293d;
  font-size: 1.24rem;
  line-height: 1.32;
}

.title-note {
  display: inline-flex;
  align-items: center;
  margin-left: 6px;
  padding: 2px 7px;
  border: 1px solid #d8e2ea;
  background: #f4f8fb;
  color: #536b7c;
  font-size: 0.78rem;
  font-weight: 700;
  vertical-align: 0.12em;
}

.map-header p {
  margin: 0;
  color: #66798a;
  font-size: 0.9rem;
}

.map-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  flex-shrink: 0;
}

.mode-tabs {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.mode-tabs button {
  border: 1px solid #c6d5e0;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  color: #24475f;
  padding: 9px 13px;
  font-size: 0.86rem;
  font-weight: 800;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.mode-tabs button:hover {
  transform: translateY(-1px);
  border-color: #8fb0c6;
  box-shadow: 0 1px 3px rgba(31, 51, 70, 0.08);
}

.mode-tabs button.active {
  background: linear-gradient(135deg, #245a7d 0%, #173047 100%);
  border-color: #173047;
  color: #ffffff;
}

.map-canvas {
  position: relative;
  flex: 1;
  min-height: 520px;
  background:
    linear-gradient(90deg, rgba(199, 215, 227, 0.32) 1px, transparent 1px),
    linear-gradient(0deg, rgba(199, 215, 227, 0.32) 1px, transparent 1px),
    #f7fafc;
  background-size: 32px 32px;
  overflow: hidden;
}

.scale-overlay {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 4;
  width: min(210px, calc(100% - 24px));
  padding: 0;
  color: #173047;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.95);
}

.scale-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 5px;
}

.scale-head span {
  color: #173047;
  font-size: 0.78rem;
  font-weight: 800;
}

.scale-head input {
  width: 52px;
  border: 1px solid rgba(117, 143, 160, 0.48);
  background: rgba(247, 250, 252, 0.5);
  color: #173047;
  padding: 2px 4px;
  font-size: 0.78rem;
  text-align: center;
}

.scale-overlay input[type="range"] {
  width: 100%;
  accent-color: #245a7d;
  opacity: 0.82;
}

.map-canvas svg {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 520px;
}

.map-status {
  position: absolute;
  left: 14px;
  bottom: 14px;
  padding: 8px 10px;
  border: 1px solid #d5e2eb;
  background: rgba(255, 255, 255, 0.92);
  color: #405466;
  font-size: 0.88rem;
}

.projection-notes {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
  border-top: 1px solid #dce5ec;
  background: #fbfdfe;
}

.projection-notes section {
  padding: 13px 15px;
  border-right: 1px solid #e1e9ef;
}

.projection-notes section:last-child {
  border-right: none;
}

.projection-notes h4 {
  margin: 0 0 5px;
  color: #173047;
  font-size: 0.94rem;
}

.projection-notes p {
  margin: 0;
  color: #607487;
  font-size: 0.84rem;
  line-height: 1.55;
}

@media (max-width: 900px) {
  .map-header {
    flex-direction: column;
    min-height: auto;
  }

  .map-actions {
    align-items: flex-start;
  }

  .projection-notes {
    display: block;
  }

  .projection-notes section {
    border-right: none;
    border-bottom: 1px solid #e1e9ef;
  }
}
</style>
