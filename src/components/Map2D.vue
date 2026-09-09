<template>
  <div class="map2d-view">
    <div class="map-header">
      <div>
        <span class="panel-kicker">二维投影 · 球面模型</span>
        <h3>{{ details.title }}</h3>
        <p>{{ details.titleEn }} · {{ details.property }}</p>
      </div>
      <div class="map-actions">
        <span v-if="props.projectionFamily === 'equalEarth'" class="projection-property" tabindex="0" :data-help="help.surface">等面积伪圆柱投影</span>
        <div v-else class="mode-tabs" aria-label="二维投影性质">
          <button
            v-for="mode in modeOptions"
            :key="mode.key"
            :class="{ active: props.projectionMode === mode.key }"
            :aria-pressed="props.projectionMode === mode.key"
            :data-help="help[mode.key]"
            @click="emit('update:projectionMode', mode.key)"
          >
            {{ mode.label }}
          </button>
        </div>
      </div>
    </div>

    <div class="map-canvas" data-tour="map" ref="wrapperRef" @wheel.prevent="handleWheelScale">
      <div class="scale-overlay" :data-help="help.viewScale">
        <div class="scale-head">
          <span>显示缩放 / %</span>
          <input aria-label="二维显示缩放" type="number" min="60" max="180" :value="params.viewScale" @input="handleScaleInput" @change="handleScaleInput" @blur="handleScaleInput" @keydown.enter="$event.target.blur()" />
        </div>
        <input
          type="range"
          aria-label="二维显示缩放滑块"
          min="60"
          max="180"
          :value="params.viewScale"
          @input="handleScaleInput"
        />
      </div>
      <svg ref="svgRef" role="img" :aria-label="`${details.title} 二维地图`"></svg>
      <div v-if="statusText" class="map-status">{{ statusText }}</div>
      <div class="domain-caption">{{ model.domainLabel }}</div>
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
import { PROJECTION_MODES, getProjectionDetails, normalizeProjectionParams } from '../core/mapMath.js';
import { createProjectionModel, fitProjection, SPHERE, GRATICULE } from '../core/projectionModel.js';
import { getIndicatrices, INDICATRIX_RADIUS } from '../core/indicatrix.js';
import { loadWorldData } from '../core/worldData.js';
import { projectionHelp, annotationHelp } from '../ui/projectionHelp.js';

const props = defineProps({
  projectionFamily: { type: String, default: 'cylinder' },
  projectionMode: { type: String, default: 'conformal' },
  projectionParams: { type: Object, default: () => ({}) }
});
const emit = defineEmits(['update:projectionMode', 'update:viewScale']);
const svgRef = ref(null);
const wrapperRef = ref(null);
const statusText = ref('正在加载地图');
let geoData, resizeObserver;
let disposed = false;
const params = computed(() => normalizeProjectionParams(props.projectionFamily, props.projectionMode, props.projectionParams));
const model = computed(() => createProjectionModel(props.projectionFamily, props.projectionMode, params.value));
const details = computed(() => getProjectionDetails(props.projectionFamily, props.projectionMode, params.value));
const help = computed(() => projectionHelp(props.projectionFamily, props.projectionMode, params.value));
const modeOptions = Object.values(PROJECTION_MODES);

const indicatrices = (projection) => {
  const scale = projection.scale(), [tx, ty] = projection.translate();
  return getIndicatrices(model.value).map(({ center, east, north, geographic }) => ({
    geographic,
    transform: `matrix(${east[0] * scale} ${-east[1] * scale} ${north[0] * scale} ${-north[1] * scale} ${center[0] * scale + tx} ${-center[1] * scale + ty})`
  }));
};

const handleScaleInput = (event) => {
  const value = event.target.value.trim() === '' ? params.value.viewScale : Number(event.target.value);
  if (!Number.isFinite(value)) return;
  if (event.type === 'input' && (value < 60 || value > 180)) return;
  const normalized = Math.max(60, Math.min(180, value));
  emit('update:viewScale', normalized);
  if (event.type !== 'input') event.target.value = normalized;
};
const handleWheelScale = (event) => emit('update:viewScale', params.value.viewScale + (event.deltaY > 0 ? -6 : 6));

const renderMap = () => {
  if (!svgRef.value || !wrapperRef.value || !geoData || disposed) return;
  const width = Math.max(1, wrapperRef.value.clientWidth);
  const height = Math.max(1, wrapperRef.value.clientHeight);
  const svg = d3.select(svgRef.value);
  svg.selectAll('*').remove();
  svg.attr('viewBox', `0 0 ${width} ${height}`);
  const projection = fitProjection(model.value, width, height, params.value.viewScale);
  const path = d3.geoPath(projection).pointRadius(3);
  const clipId = 'map-domain-clip';
  svg.append('defs').append('clipPath').attr('id', clipId)
    .append('path').datum(SPHERE).attr('d', path);
  svg.append('path').datum(SPHERE).attr('class', 'sphere-outline').attr('d', path)
    .attr('fill', '#edf2f0').attr('stroke', '#95aaa3').attr('stroke-width', 1);
  svg.append('g').attr('class', 'land').selectAll('path').data(geoData.features).join('path')
    .attr('d', path).attr('fill', '#ffffff').attr('stroke', '#3a4a44').attr('stroke-width', 0.8);
  if (params.value.showGraticule) svg.append('path').datum(GRATICULE)
    .attr('class', 'graticule').attr('d', path).attr('fill', 'none').attr('stroke', '#aabbb4').attr('stroke-width', 0.65);
  if (params.value.showStandardLine) svg.append('path').datum(model.value.standardGeometry)
    .attr('class', 'standard-line').attr('d', path)
    .attr('fill', model.value.standardGeometry.type === 'Point' ? '#d92d20' : 'none')
    .attr('stroke', '#d92d20').attr('stroke-width', 1.8).attr('stroke-linecap', 'round');
  if (params.value.showIndicatrix) svg.append('g').attr('class', 'indicatrix-layer').attr('clip-path', `url(#${clipId})`)
    .selectAll('circle').data(indicatrices(projection)).join('circle')
    .attr('r', INDICATRIX_RADIUS).attr('transform', d => d.transform)
    .attr('fill', '#b88636').attr('fill-opacity', 0.3).attr('stroke', '#886024')
    .attr('stroke-width', 0.75).attr('vector-effect', 'non-scaling-stroke')
    .append('title').text(d => `参考圆中心：${d.geographic[0]}°，${d.geographic[1]}°`);
  if (props.projectionFamily === 'conic' && model.value.contains(model.value.origin)) {
    const [x, y] = projection(model.value.origin);
    svg.append('path').attr('d', `M${x - 4},${y}h8M${x},${y - 4}v8`)
      .attr('class', 'projection-origin').attr('stroke', '#333').attr('stroke-width', 1.2)
      .append('title').text('坐标原点 (0, 0)');
  }
  if (model.value.oblique && params.value.showStandardLine) {
    const [x, y] = projection(model.value.origin);
    const center = svg.append('g').attr('class', 'oblique-center').attr('data-help', annotationHelp('C', 'cylinder')).attr('tabindex', 0).attr('aria-label', '斜轴中心点 C');
    center.append('circle').attr('cx', x).attr('cy', y).attr('r', 3.5).attr('fill', '#416f8b').attr('stroke', '#fff').attr('stroke-width', 1);
    center.append('text').attr('x', x + 6).attr('y', y - 6).attr('fill', '#416f8b').attr('font-size', 12).attr('font-weight', 700).text('C');
  }
  statusText.value = '';
};
watch(() => [props.projectionFamily, props.projectionMode, props.projectionParams], () => nextTick(renderMap), { deep: true });
onMounted(() => {
  loadWorldData().then(data => { if (!disposed) { geoData = data; renderMap(); } })
    .catch(error => { if (!disposed) statusText.value = error.message; });
  resizeObserver = new ResizeObserver(renderMap);
  resizeObserver.observe(wrapperRef.value);
});
onBeforeUnmount(() => { disposed = true; resizeObserver?.disconnect(); });
</script>

<style scoped>
.map2d-view {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 100%;
  background: #ffffff;
  color: #333333;
}

.map-header {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 12px;
  min-height: 160px;
  padding: 14px 16px;
  border-bottom: 1px solid #e0e0e0;
  background: #ffffff;
}

.panel-kicker {
  display: block;
  color: #666666;
  font-family: "Segoe UI", Arial, sans-serif;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0;
}

.map-header h3 {
  margin: 5px 0 3px;
  color: #333333;
  font-size: 1.1rem;
  line-height: 1.32;
}

.title-note {
  display: inline-flex;
  align-items: center;
  margin-left: 6px;
  padding: 2px 7px;
  border: 1px solid #e0e0e0;
  background: #f5f6f5;
  color: #666666;
  font-size: 0.78rem;
  font-weight: 700;
  vertical-align: 0.12em;
}

.map-header p {
  margin: 0;
  color: #777777;
  font-size: 12px;
}

.map-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  flex-shrink: 0;
}

.projection-property { border-left: 3px solid #3c5b4c; padding: 5px 10px; color: #3c5b4c; font-size: 13px; font-weight: 600; }

.mode-tabs {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.mode-tabs button {
  border: 1px solid #dedede;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  color: #444444;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 800;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.mode-tabs button:hover {
  transform: translateY(-1px);
  border-color: #9aaa9f;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.mode-tabs button.active {
  background: linear-gradient(135deg, #3c5b4c 0%, #333333 100%);
  border-color: #333333;
  color: #ffffff;
}

.map-canvas {
  position: relative;
  flex: none;
  height: 520px;
  min-height: 0;
  background:
    linear-gradient(90deg, rgba(199, 215, 227, 0.32) 1px, transparent 1px),
    linear-gradient(0deg, rgba(199, 215, 227, 0.32) 1px, transparent 1px),
    #f7f9f8;
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
  color: #333333;
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
  color: #333333;
  font-size: 0.78rem;
  font-weight: 800;
}

.scale-head input {
  width: 52px;
  border: 1px solid rgba(117, 143, 160, 0.48);
  background: rgba(247, 250, 252, 0.5);
  color: #333333;
  padding: 2px 4px;
  font-size: 0.78rem;
  text-align: center;
}

.scale-overlay input[type="range"] {
  width: 100%;
  accent-color: #3c5b4c;
  opacity: 0.82;
}

.map-canvas svg {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.domain-caption {
  position: absolute;
  bottom: 7px;
  left: 12px;
  right: 12px;
  color: #666;
  font-size: 12px;
  background: rgba(247, 249, 248, 0.9);
  pointer-events: none;
}

.map-status {
  position: absolute;
  left: 14px;
  bottom: 14px;
  padding: 8px 10px;
  border: 1px solid #e0e0e0;
  background: rgba(255, 255, 255, 0.92);
  color: #666666;
  font-size: 0.88rem;
}

.projection-notes {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
  border-top: 1px solid #e0e0e0;
  background: #fafbfa;
}

.projection-notes section {
  padding: 13px 15px;
  border-right: 1px solid #e0e0e0;
}

.projection-notes section:last-child {
  border-right: none;
}

.projection-notes h4 {
  margin: 0 0 5px;
  color: #333333;
  font-size: 0.94rem;
}

.projection-notes p {
  margin: 0;
  color: #666666;
  font-size: 0.84rem;
  line-height: 1.55;
}

@media (max-width: 1399px) and (min-width: 981px) {
  .projection-notes { grid-template-columns: 1fr; }
  .projection-notes section { border-right: none; border-bottom: 1px solid #e0e0e0; padding: 9px 13px; }
  .projection-notes h4 { font-size: 13px; }
  .projection-notes p { font-size: 12px; }
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
    border-bottom: 1px solid #e0e0e0;
  }
}
</style>
