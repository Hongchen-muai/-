<template>
  <div class="app-shell">
    <header class="top-bar">
      <div class="brand-block">
        <span class="eyebrow">GIS Projection Teaching</span>
        <h1>地图投影过程可视化教学平台</h1>
      </div>

      <nav class="family-tabs" aria-label="投影类型栏">
        <button
          v-for="family in familyOptions"
          :key="family.key"
          :class="{ active: projectionFamily === family.key }"
          @click="setFamily(family.key)"
        >
          <span>{{ family.label }}</span>
          <small>{{ family.labelEn }}</small>
        </button>
      </nav>
    </header>

    <main class="main-content">
      <section class="comparison-grid">
        <article class="view-panel scene-panel">
          <div class="panel-head">
            <div>
              <span class="eyebrow">三维示意</span>
              <h2>承影面与投影射线</h2>
              <p>三维图像用于解释投影逻辑和参数作用，承影面上的地图为教学示意。</p>
            </div>
            <div class="scene-tools">
              <span class="view-chip"><Eye :size="15" /> 观察视角</span>
              <button class="icon-button" @click="replayDemo" title="重新播放投影示意">
                <RefreshCw :size="16" />
                <span>重新演示</span>
              </button>
            </div>
          </div>
          <div class="scene-stage">
            <Scene3D
              :projection-family="projectionFamily"
              projection-mode="compromise"
              :projection-params="projectionParams"
              :replay-key="replayKey"
            />
          </div>
          <div class="surface-summary">
            <span>{{ surfaceMetrics.contact }}</span>
            <span>{{ surfaceMetrics.primary }}</span>
            <span v-if="surfaceMetrics.aspectLabel">{{ surfaceMetrics.aspectLabel }}</span>
          </div>
        </article>

        <article class="view-panel map-panel">
          <Map2D
            :projection-family="projectionFamily"
            :projection-mode="projectionMode"
            :projection-params="projectionParams"
            @update:projection-mode="setMode"
            @update:view-scale="setViewScale"
          />
        </article>
      </section>

      <section class="parameter-panel">
        <div class="section-title">
          <div>
            <span class="eyebrow">参数调节区</span>
            <h2>{{ currentFamily.label }} · {{ currentMode.label }}</h2>
          </div>
          <p>{{ currentFamily.description }}</p>
        </div>

        <div class="parameter-grid">
          <section class="param-group">
            <div class="group-head">
              <Globe2 :size="18" />
              <div>
                <h3>球体与投影中心参数</h3>
                <p>控制地球姿态、中央经线或投影中心位置。</p>
              </div>
            </div>

            <template v-if="projectionFamily === 'planar'">
              <label class="param-row">
                <span>
                  投影中心经度
                  <small>Longitude of Projection Center</small>
                </span>
                <input type="number" :value="projectionParams.projectionCenterLon" @change="setNumber('projectionCenterLon', $event)" />
              </label>
              <input class="range" type="range" min="-180" max="180" :value="projectionParams.projectionCenterLon" @input="setNumber('projectionCenterLon', $event)" />

              <label class="param-row">
                <span>
                  投影中心纬度
                  <small>Latitude of Projection Center</small>
                </span>
                <input type="number" :value="projectionParams.projectionCenterLat" @change="setNumber('projectionCenterLat', $event)" />
              </label>
              <input class="range" type="range" min="-85" max="85" :value="projectionParams.projectionCenterLat" @input="setNumber('projectionCenterLat', $event)" />
            </template>

            <template v-else>
              <label class="param-row">
                <span>
                  中央经线
                  <small>Central Meridian</small>
                </span>
                <input type="number" :value="projectionParams.centralMeridian" @change="setNumber('centralMeridian', $event)" />
              </label>
              <input class="range" type="range" min="-180" max="180" :value="projectionParams.centralMeridian" @input="setNumber('centralMeridian', $event)" />

              <label class="param-row">
                <span>
                  投影原点纬度
                  <small>Latitude of Projection Origin</small>
                </span>
                <input type="number" :value="projectionParams.latitudeOfOrigin" @change="setNumber('latitudeOfOrigin', $event)" />
              </label>
              <input class="range" type="range" min="-80" max="80" :value="projectionParams.latitudeOfOrigin" @input="setNumber('latitudeOfOrigin', $event)" />

              <div v-if="projectionFamily === 'cylinder'" class="segmented-field">
                <span>
                  投影轴向
                  <small>Projection Aspect</small>
                </span>
                <div class="segmented-control">
                  <button :class="{ active: projectionParams.aspect === 'normal' }" @click="setParam('aspect', 'normal')">正轴</button>
                  <button :class="{ active: projectionParams.aspect === 'transverse' }" @click="setParam('aspect', 'transverse')">横轴</button>
                </div>
              </div>
            </template>
          </section>

          <section class="param-group">
            <div class="group-head">
              <Cone :size="18" />
              <div>
                <h3>承影面参数</h3>
                <p>控制圆柱、平面或圆锥与球体的相切/相割关系。</p>
              </div>
            </div>

            <template v-if="projectionFamily === 'cylinder'">
              <label class="param-row">
                <span>
                  标准纬线 / 真比例纬线
                  <small>Standard Parallel / Latitude of True Scale</small>
                </span>
                <input type="number" :value="projectionParams.standardParallel" @change="setNumber('standardParallel', $event)" />
              </label>
              <input class="range" type="range" min="0" max="75" :value="projectionParams.standardParallel" @input="setNumber('standardParallel', $event)" />
              <p class="metric-note">{{ standardFeatures.label }}</p>
            </template>

            <template v-else-if="projectionFamily === 'planar'">
              <label class="param-row">
                <span>
                  标准圈角距
                  <small>Standard Circle Angular Distance</small>
                </span>
                <input type="number" :value="projectionParams.standardCircleDistance" @change="setNumber('standardCircleDistance', $event)" />
              </label>
              <input class="range" type="range" min="0" max="75" :value="projectionParams.standardCircleDistance" @input="setNumber('standardCircleDistance', $event)" />
              <p class="metric-note">{{ standardFeatures.label }}</p>
            </template>

            <template v-else>
              <label class="param-row">
                <span>
                  第一标准纬线
                  <small>First Standard Parallel</small>
                </span>
                <input type="number" :value="projectionParams.standardParallel1" @change="setNumber('standardParallel1', $event)" />
              </label>
              <input class="range" type="range" min="-80" max="80" :value="projectionParams.standardParallel1" @input="setNumber('standardParallel1', $event)" />

              <label class="param-row">
                <span>
                  第二标准纬线
                  <small>Second Standard Parallel</small>
                </span>
                <input type="number" :value="projectionParams.standardParallel2" @change="setNumber('standardParallel2', $event)" />
              </label>
              <input class="range" type="range" min="-80" max="80" :value="projectionParams.standardParallel2" @input="setNumber('standardParallel2', $event)" />
              <p class="metric-note">{{ standardFeatures.label }}</p>
            </template>
          </section>

          <section class="param-group">
            <div class="group-head">
              <Map :size="18" />
              <div>
                <h3>二维地图显示参数</h3>
                <p>只影响二维图层显示，不改变投影数学定义。</p>
              </div>
            </div>

            <label class="check-row">
              <input type="checkbox" :checked="projectionParams.showGraticule" @change="setBoolean('showGraticule', $event)" />
              <span>显示经纬网 <small>Graticule</small></span>
            </label>
            <label class="check-row">
              <input type="checkbox" :checked="projectionParams.showStandardLine" @change="setBoolean('showStandardLine', $event)" />
              <span>显示标准线/标准圈 <small>Standard Line / Circle</small></span>
            </label>
            <label class="check-row">
              <input type="checkbox" :checked="projectionParams.showIndicatrix" @change="setBoolean('showIndicatrix', $event)" />
              <span>显示变形椭圆 <small>Tissot Indicatrix</small></span>
            </label>
          </section>

          <section class="param-group">
            <div class="group-head">
              <Layers :size="18" />
              <div>
                <h3>三维教学辅助显示</h3>
                <p>控制三维示意元素的可见性。</p>
              </div>
            </div>

            <label class="check-row">
              <input type="checkbox" :checked="projectionParams.showSurface" @change="setBoolean('showSurface', $event)" />
              <span>显示承影面 <small>Developable Surface</small></span>
            </label>
            <label class="check-row">
              <input type="checkbox" :checked="projectionParams.showLightSource" @change="setBoolean('showLightSource', $event)" />
              <span>显示点光源 <small>Point Light Source</small></span>
            </label>
            <label class="check-row">
              <input type="checkbox" :checked="projectionParams.showRays" @change="setBoolean('showRays', $event)" />
              <span>显示投影射线 <small>Projection Rays</small></span>
            </label>
            <label class="check-row">
              <input type="checkbox" :checked="projectionParams.showProjectedImage" @change="setBoolean('showProjectedImage', $event)" />
              <span>显示承影面示意图像 <small>Surface Image</small></span>
            </label>
          </section>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { Eye, RefreshCw, Globe2, Cone, Map, Layers } from 'lucide-vue-next';
import Scene3D from './components/Scene3D.vue';
import Map2D from './components/Map2D.vue';
import {
  PROJECTION_FAMILIES,
  PROJECTION_MODES,
  normalizeProjectionParams,
  getSurfaceMetrics,
  getStandardFeatures
} from './core/mapMath.js';

const familyOptions = Object.values(PROJECTION_FAMILIES);

const projectionFamily = ref('cylinder');
const projectionMode = ref('conformal');
const projectionParams = ref(normalizeProjectionParams('cylinder', 'conformal'));
const replayKey = ref(0);

const currentFamily = computed(() => PROJECTION_FAMILIES[projectionFamily.value]);
const currentMode = computed(() => PROJECTION_MODES[projectionMode.value]);
const surfaceMetrics = computed(() =>
  getSurfaceMetrics(projectionFamily.value, 'compromise', projectionParams.value)
);
const standardFeatures = computed(() =>
  getStandardFeatures(projectionFamily.value, projectionParams.value)
);

const normalizeCurrentParams = (overrides = {}) => {
  projectionParams.value = normalizeProjectionParams(
    projectionFamily.value,
    projectionMode.value,
    { ...projectionParams.value, ...overrides }
  );
};

const setFamily = (family) => {
  if (projectionFamily.value === family) return;
  const current = projectionParams.value;
  const carry = { ...current };
  if (family === 'planar') {
    carry.projectionCenterLon = current.centralMeridian;
    carry.projectionCenterLat = current.latitudeOfOrigin;
  } else {
    carry.centralMeridian = current.projectionCenterLon;
    carry.latitudeOfOrigin = current.projectionCenterLat;
  }
  projectionFamily.value = family;
  projectionParams.value = normalizeProjectionParams(family, projectionMode.value, carry);
  replayDemo();
};

const setMode = (mode) => {
  if (projectionMode.value === mode) return;
  projectionMode.value = mode;
  normalizeCurrentParams();
};

const setParam = (key, value) => {
  normalizeCurrentParams({ [key]: value });
};

const setNumber = (key, event) => {
  setParam(key, Number(event.target.value));
};

const setViewScale = (value) => {
  setParam('viewScale', value);
};

const setBoolean = (key, event) => {
  setParam(key, event.target.checked);
};

const replayDemo = () => {
  replayKey.value += 1;
};
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500;700&family=Inter:wght@400;500;600;700;800&display=swap');

* {
  box-sizing: border-box;
}

html,
body,
#app {
  margin: 0;
  width: 100%;
  min-height: 100%;
}

body {
  background: #edf4f8;
  color: #173047;
  font-family: "Noto Serif SC", "Inter", sans-serif;
  -webkit-font-smoothing: antialiased;
}

button,
input {
  font: inherit;
}

button {
  cursor: pointer;
}

.app-shell {
  min-height: 100vh;
  background: #edf4f8;
}

.top-bar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: grid;
  grid-template-columns: minmax(240px, 0.55fr) minmax(520px, 1.45fr);
  gap: 18px;
  align-items: center;
  padding: 14px 22px;
  background: rgba(255, 255, 255, 0.96);
  border-bottom: 1px solid #cbdbe6;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  backdrop-filter: blur(12px);
}

.brand-block h1 {
  margin: 4px 0 0;
  color: #12293d;
  font-size: 1.2rem;
  line-height: 1.2;
}

.eyebrow {
  display: inline-block;
  color: #607487;
  font-family: Inter, "Noto Serif SC", sans-serif;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.family-tabs,
.mode-tabs,
.segmented-control {
  display: flex;
  gap: 8px;
}

.family-tabs button,
.mode-tabs button,
.segmented-control button,
.icon-button {
  border: 1px solid #c6d5e0;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  color: #25465d;
  transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
}

.family-tabs button {
  flex: 1;
  min-width: 0;
  padding: 10px 12px;
  text-align: left;
}

.family-tabs button span,
.family-tabs button small {
  display: block;
}

.family-tabs button span {
  color: #173047;
  font-weight: 800;
}

.family-tabs button small {
  margin-top: 2px;
  color: #6f8292;
  font-family: Inter, sans-serif;
  font-size: 0.72rem;
  text-transform: uppercase;
}

.mode-tabs {
  justify-content: flex-end;
}

.mode-tabs button,
.segmented-control button {
  padding: 9px 12px;
  font-weight: 800;
}

.family-tabs button:hover,
.mode-tabs button:hover,
.segmented-control button:hover,
.icon-button:hover {
  transform: translateY(-1px);
  border-color: #8fb0c6;
}

.family-tabs button.active,
.mode-tabs button.active,
.segmented-control button.active {
  background: linear-gradient(135deg, #245a7d 0%, #173047 100%);
  border-color: #173047;
  color: #ffffff;
}

.family-tabs button.active span,
.family-tabs button.active small {
  color: #ffffff;
}

.main-content {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 18px 22px 28px;
}

.comparison-grid {
  display: grid;
  grid-template-columns: minmax(460px, 1fr) minmax(460px, 1fr);
  gap: 18px;
  align-items: stretch;
}

.view-panel,
.parameter-panel,
.param-group {
  background: #ffffff;
  border: 1px solid #cbdbe6;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.view-panel {
  min-width: 0;
  overflow: hidden;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px;
  border-bottom: 1px solid #dce5ec;
  background: #ffffff;
}

.panel-head h2,
.section-title h2,
.param-group h3 {
  margin: 0;
  color: #12293d;
}

.panel-head h2 {
  margin-top: 5px;
  font-size: 1.18rem;
}

.panel-head p,
.section-title p,
.group-head p,
.metric-note {
  margin: 5px 0 0;
  color: #607487;
  font-size: 0.84rem;
  line-height: 1.5;
}

.scene-tools {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

.view-chip,
.icon-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 8px 10px;
  border: 1px solid #cbdbe6;
  background: #f6fafc;
  color: #24475f;
  font-size: 0.82rem;
  font-weight: 800;
}

.icon-button {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
}

.scene-stage {
  height: 560px;
  background:
    linear-gradient(90deg, rgba(199, 215, 227, 0.32) 1px, transparent 1px),
    linear-gradient(0deg, rgba(199, 215, 227, 0.32) 1px, transparent 1px),
    #f7fafc;
  background-size: 32px 32px;
}

.surface-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 14px;
  border-top: 1px solid #dce5ec;
  background: #fbfdfe;
}

.surface-summary span {
  padding: 7px 9px;
  border: 1px solid #d8e5ee;
  background: #f6fafc;
  color: #405466;
  font-size: 0.8rem;
  font-weight: 700;
}

.map-panel {
  display: flex;
  min-height: 560px;
}

.parameter-panel {
  padding: 18px;
}

.section-title {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 18px;
  margin-bottom: 14px;
}

.section-title h2 {
  margin-top: 5px;
  font-size: 1.22rem;
}

.section-title p {
  max-width: 720px;
}

.parameter-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.param-group {
  padding: 14px;
  min-width: 0;
}

.group-head {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  margin-bottom: 12px;
  color: #245a7d;
}

.group-head h3 {
  font-size: 0.98rem;
}

.param-row,
.segmented-field,
.check-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
}

.param-row span,
.segmented-field > span,
.check-row span {
  color: #173047;
  font-size: 0.88rem;
  font-weight: 800;
}

.param-row small,
.segmented-field small,
.check-row small {
  display: block;
  margin-top: 2px;
  color: #7b8e9d;
  font-family: Inter, sans-serif;
  font-size: 0.7rem;
  font-weight: 600;
}

.param-row input[type="number"] {
  width: 70px;
  border: 1px solid #bfd1df;
  background: #ffffff;
  color: #173047;
  padding: 5px 6px;
  text-align: center;
}

.range {
  width: 100%;
  margin: 8px 0 4px;
  accent-color: #245a7d;
}

.segmented-control button {
  min-width: 54px;
}

.check-row {
  justify-content: flex-start;
  align-items: flex-start;
}

.check-row input {
  margin-top: 4px;
  accent-color: #245a7d;
}

.metric-note {
  padding: 9px 10px;
  border: 1px solid #efc7c0;
  background: #fff8f6;
  color: #8a3328;
}

@media (max-width: 1320px) {
  .top-bar {
    grid-template-columns: 1fr;
  }

  .parameter-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 980px) {
  .comparison-grid,
  .parameter-grid {
    grid-template-columns: 1fr;
  }

  .scene-stage,
  .map-panel {
    min-height: 500px;
  }

  .family-tabs {
    overflow-x: auto;
  }

  .family-tabs button {
    min-width: 150px;
  }

  .section-title,
  .panel-head {
    flex-direction: column;
  }
}
</style>
