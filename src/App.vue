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
          :aria-pressed="projectionFamily === family.key"
          @click="setFamily(family.key)"
        >
          <span>{{ family.label }}</span>
          <small>{{ family.labelEn }}</small>
        </button>
      </nav>
      <button class="icon-button intro-trigger" aria-label="入门导览" title="入门导览" @click="tourRef?.open()"><CircleHelp :size="19" /></button>
    </header>

    <main class="main-content">
      <section class="workspace-grid">
        <article class="view-panel scene-panel">
          <div class="panel-head">
            <div>
              <span class="eyebrow">三维投影 · 球面模型</span>
              <h2>辅助投影面与展开</h2>
              <p>{{ details.title }}</p>
              <p v-if="projectionFamily === 'cylinder' && demoState.step === 1" class="phase-caption">{{ constructionPhase === 'geometry' ? 'O、P、G：几何参考，不是实际投影' : 'G → M：数学修正，不是弯曲光线' }}</p>
            </div>
            <div class="scene-tools">
              <button class="icon-button" @click="sceneRef?.fitView()" title="适应视图" aria-label="适应视图" :disabled="demoState.playing">
                <Maximize2 :size="16" />
              </button>
              <button class="icon-button" @click="replayDemo" title="重新演示" aria-label="重新演示">
                <RotateCcw :size="16" />
              </button>
            </div>
          </div>
          <div class="scene-stage" :data-projection="`${projectionFamily}/${projectionMode}`" :data-step="demoState.step" :data-playing="demoState.playing">
            <Scene3D
              ref="sceneRef"
              data-tour="scene"
              :projection-family="projectionFamily"
              :projection-mode="projectionMode"
              :projection-params="projectionParams"
              :replay-key="replayKey"
              @demo-state="demoState = $event"
              @construction-phase="constructionPhase = $event"
            />
            <div class="step-navigation" aria-label="投影动画阶段">
              <button class="step-arrow" :disabled="demoState.step === 0" @click="goToStep(demoState.step - 1)" title="上一阶段" aria-label="上一阶段"><ChevronLeft :size="17" /></button>
              <button v-for="(label, i) in steps" :key="label" :class="{ active: demoState.step === i }" :aria-pressed="demoState.step === i" @click="goToStep(i)"><span>{{ i + 1 }}</span>{{ label }}</button>
              <button class="step-arrow" :disabled="demoState.step === 2" @click="goToStep(demoState.step + 1)" title="下一阶段" aria-label="下一阶段"><ChevronRight :size="17" /></button>
            </div>
          </div>
          <div v-if="projectionParams.showStandardLine || projectionParams.showIndicatrix || (projectionParams.showRays && demoState.step === 1)" class="geometry-key" data-tour="legend" aria-label="几何图例">
            <span v-if="projectionParams.showStandardLine && demoState.step < 2"><i class="key-source"></i>球面{{ projectionFamily === 'planar' ? '交圈 / 中心' : '标准线' }}</span>
            <span v-if="projectionParams.showStandardLine"><i class="key-map"></i>{{ projectionFamily === 'planar' ? '对应投影' : '投影标准线' }}</span>
            <span v-if="projectionParams.showRays && demoState.step === 1 && projectionFamily === 'cylinder'"><i class="key-correction"></i>G → M 数学修正</span>
            <span v-if="projectionParams.showIndicatrix"><i class="key-indicatrix"></i>等大小参考圆 / 一阶变形椭圆</span>
          </div>

          <div class="surface-summary">
            <span>{{ surfaceMetrics.contact }}</span>
            <span>{{ surfaceMetrics.primary }}</span>
            <span v-if="surfaceMetrics.aspectLabel">{{ surfaceMetrics.aspectLabel }}</span>
          </div>
        </article>

        <aside class="shared-parameter-panel" aria-label="共享投影参数">
          <div class="section-title">
            <div>
              <span class="eyebrow">共享参数</span>
              <h2>{{ currentFamily.label }} · {{ currentMode.label }}</h2>
            </div>
            <p>球面半径 R；角度单位为度。</p>
          </div>

          <div class="parameter-column" data-tour="parameters">
            <section class="param-group">
              <div class="group-head">
                <Globe2 :size="18" />
                <div>
                  <h3>投影中心与轴向</h3>
                </div>
              </div>

              <template v-if="projectionFamily === 'planar'">
                <label class="param-row">
                  <span>
                    投影中心经度
                    <small>Longitude of Projection Center</small>
                  </span>
                  <input type="number" :value="projectionParams.projectionCenterLon" @input="setNumber('projectionCenterLon', $event)" @change="setNumber('projectionCenterLon', $event)" @blur="setNumber('projectionCenterLon', $event)" @keydown.enter="$event.target.blur()" />
                </label>
                <input class="range" aria-label="投影中心经度滑块" type="range" min="-180" max="180" :value="projectionParams.projectionCenterLon" @input="setNumber('projectionCenterLon', $event)" />

                <label class="param-row">
                  <span>
                    投影中心纬度
                    <small>Latitude of Projection Center</small>
                  </span>
                  <input type="number" :value="projectionParams.projectionCenterLat" @input="setNumber('projectionCenterLat', $event)" @change="setNumber('projectionCenterLat', $event)" @blur="setNumber('projectionCenterLat', $event)" @keydown.enter="$event.target.blur()" />
                </label>
                <input class="range" aria-label="投影中心纬度滑块" type="range" min="-90" max="90" :value="projectionParams.projectionCenterLat" @input="setNumber('projectionCenterLat', $event)" />
              </template>

              <template v-else>
                <label class="param-row">
                  <span>
                    中央经线
                    <small>Central Meridian</small>
                  </span>
                  <input type="number" :value="projectionParams.centralMeridian" @input="setNumber('centralMeridian', $event)" @change="setNumber('centralMeridian', $event)" @blur="setNumber('centralMeridian', $event)" @keydown.enter="$event.target.blur()" />
                </label>
                <input class="range" aria-label="中央经线滑块" type="range" min="-180" max="180" :value="projectionParams.centralMeridian" @input="setNumber('centralMeridian', $event)" />

                <label v-if="projectionFamily === 'conic'" class="param-row">
                  <span>
                    投影原点纬度
                    <small>Latitude of Projection Origin</small>
                  </span>
                  <input type="number" :value="projectionParams.latitudeOfOrigin" @input="setNumber('latitudeOfOrigin', $event)" @change="setNumber('latitudeOfOrigin', $event)" @blur="setNumber('latitudeOfOrigin', $event)" @keydown.enter="$event.target.blur()" />
                </label>
                <input v-if="projectionFamily === 'conic'" class="range" aria-label="投影原点纬度滑块" type="range" min="-80" max="80" :value="projectionParams.latitudeOfOrigin" @input="setNumber('latitudeOfOrigin', $event)" />

                <div v-if="projectionFamily === 'cylinder'" class="segmented-field">
                  <span>
                    投影轴向
                    <small>Projection Aspect</small>
                  </span>
                  <div class="segmented-control">
                    <button :class="{ active: projectionParams.aspect === 'normal' }" :aria-pressed="projectionParams.aspect === 'normal'" @click="setParam('aspect', 'normal')">正轴</button>
                    <button :class="{ active: projectionParams.aspect === 'transverse' }" :aria-pressed="projectionParams.aspect === 'transverse'" @click="setParam('aspect', 'transverse')">横轴</button>
                  </div>
                </div>
              </template>
            </section>

            <section class="param-group">
              <div class="group-head">
                <Cone :size="18" />
                <div>
                  <h3>辅助投影面参数</h3>
                </div>
              </div>

              <template v-if="projectionFamily === 'cylinder'">
                <label class="param-row">
                  <span>
                    {{ projectionParams.aspect === 'transverse' ? '轴向标准线角距' : '割线纬度（标准纬线）' }}
                    <small>Latitude of True Scale</small>
                  </span>
                  <input type="number" :value="projectionParams.standardParallel" @input="setNumber('standardParallel', $event)" @change="setNumber('standardParallel', $event)" @blur="setNumber('standardParallel', $event)" @keydown.enter="$event.target.blur()" />
                </label>
                <input class="range" aria-label="圆柱割线纬度滑块" type="range" min="0" max="75" :value="projectionParams.standardParallel" @input="setNumber('standardParallel', $event)" />
                <p class="metric-note">{{ standardFeatures.label }}</p>
              </template>

              <template v-else-if="projectionFamily === 'planar'">
                <label class="param-row">
                  <span>
                    辅助平面交圈角距
                    <small>Auxiliary Plane Intersection</small>
                  </span>
                  <input type="number" :value="projectionParams.standardCircleDistance" @input="setNumber('standardCircleDistance', $event)" @change="setNumber('standardCircleDistance', $event)" @blur="setNumber('standardCircleDistance', $event)" @keydown.enter="$event.target.blur()" />
                </label>
                <input class="range" aria-label="辅助平面交圈角距滑块" type="range" min="0" max="75" :value="projectionParams.standardCircleDistance" @input="setNumber('standardCircleDistance', $event)" />
                <p class="metric-note">{{ standardFeatures.label }}</p>
              </template>

              <template v-else>
                <label class="param-row">
                  <span>
                    第一割线纬度
                    <small>First Standard Parallel</small>
                  </span>
                  <input type="number" :value="projectionParams.standardParallel1" @input="setNumber('standardParallel1', $event)" @change="setNumber('standardParallel1', $event)" @blur="setNumber('standardParallel1', $event)" @keydown.enter="$event.target.blur()" />
                </label>
                <input class="range" aria-label="第一割线纬度滑块" type="range" min="-80" max="80" :value="projectionParams.standardParallel1" @input="setNumber('standardParallel1', $event)" />

                <label class="param-row">
                  <span>
                    第二割线纬度
                    <small>Second Standard Parallel</small>
                  </span>
                  <input type="number" :value="projectionParams.standardParallel2" @input="setNumber('standardParallel2', $event)" @change="setNumber('standardParallel2', $event)" @blur="setNumber('standardParallel2', $event)" @keydown.enter="$event.target.blur()" />
                </label>
                <input class="range" aria-label="第二割线纬度滑块" type="range" min="-80" max="80" :value="projectionParams.standardParallel2" @input="setNumber('standardParallel2', $event)" />
                <p class="metric-note">{{ standardFeatures.label }}</p>
              </template>
            </section>
          </div>
          <div class="display-controls" data-tour="layers">
            <section class="param-group display-group scene-display-group">
              <div class="group-head">
                <Layers :size="18" />
                <div>
                  <h3>三维教学辅助显示</h3>
                </div>
              </div>
              <div class="check-list">
                <label class="check-row">
                  <input type="checkbox" :checked="projectionParams.showSurface" @change="setBoolean('showSurface', $event)" />
                  <span>辅助投影面 <small>Auxiliary Surface</small></span>
                </label>
                <label v-if="teaching.source" class="check-row">
                  <input type="checkbox" :checked="projectionParams.showLightSource" @change="setBoolean('showLightSource', $event)" />
                  <span>{{ teaching.sourceLabel }} <small>{{ teaching.sourceEnglish }}</small></span>
                </label>
                <label class="check-row">
                  <input type="checkbox" :checked="projectionParams.showRays" @change="setBoolean('showRays', $event)" />
                  <span>{{ teaching.rays }} <small>{{ teaching.rayEnglish || (teaching.source || (projectionFamily === 'planar' && projectionMode === 'compromise') ? 'Projection Rays' : 'Coordinate Mapping') }}</small></span>
                </label>
                <label class="check-row">
                  <input type="checkbox" :checked="projectionParams.showProjectedImage" @change="setBoolean('showProjectedImage', $event)" />
                  <span>投影地图 <small>Projected Map</small></span>
                </label>
                <label class="check-row" data-tour="indicatrices">
                  <input type="checkbox" :checked="projectionParams.showIndicatrix" @change="setBoolean('showIndicatrix', $event)" />
                  <span>参考圆 / 变形椭圆 <small>Linked Indicatrices</small></span>
                </label>
              </div>
            </section>
    
            <section class="param-group display-group map-display-group">
              <div class="group-head">
                <Map :size="18" />
                <div>
                  <h3>地图图层</h3>
                </div>
              </div>
              <div class="check-list">
                <label class="check-row">
                  <input type="checkbox" :checked="projectionParams.showGraticule" @change="setBoolean('showGraticule', $event)" />
                  <span>显示经纬网 <small>Graticule</small></span>
                </label>
                <label class="check-row">
                  <input type="checkbox" :checked="projectionParams.showStandardLine" @change="setBoolean('showStandardLine', $event)" />
                  <span>{{ projectionFamily === 'planar' ? '交圈 / 中心点' : '标准线（真比例）' }} <small>Reference Geometry</small></span>
                </label>
                <label class="check-row">
                  <input type="checkbox" :checked="projectionParams.showIndicatrix" @change="setBoolean('showIndicatrix', $event)" />
                  <span>变形椭圆（双视图） <small>Tissot Indicatrix</small></span>
                </label>
              </div>
            </section>
          </div>
        </aside>

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
      <section class="projection-principle" data-tour="principle">
        <h3>投影原理 · {{ steps[demoState.step] }} <small>{{ demoState.playing ? '演示中' : `${demoState.step + 1} / 3` }}</small></h3>
        <div class="principle-columns">
          <div>
            <template v-if="projectionFamily === 'cylinder'">
              <h4 :class="{ 'active-explanation': constructionPhase === 'geometry' }">几何参考：O、P、G（不是实际投影）</h4>
              <p>{{ teaching.geometry }}</p>
            </template>
            <p v-else>{{ demoState.step === 0 ? teaching.mapping : teaching.surface }}</p>
            <p v-if="teaching.standardNote" class="standard-comparison">{{ teaching.standardNote }}</p>
          </div>
          <div>
            <template v-if="projectionFamily === 'cylinder'">
              <h4 :class="{ 'active-explanation': constructionPhase === 'mathematics' }">G → M：按{{ currentMode.label === '常用投影' ? '等距条件' : currentMode.label + '条件' }}确定实际投影</h4>
            </template>
            <p>{{ projectionFamily === 'cylinder' ? teaching.mapping : demoState.step === 0 ? teaching.surface : demoState.step === 1 ? teaching.mapping : '展开后的坐标服从同一投影公式。球面到辅助面的映射一般发生变形；辅助圆柱或圆锥的展开不再改变面内长度。' }}</p>
            <p v-if="projectionFamily === 'cylinder' && demoState.step === 2">圆柱展开只改变空间姿态，不再改变面内长度；最终坐标与右侧相同。</p>
            <p v-if="projectionParams.showIndicatrix" class="indicatrix-explanation">{{ indicatrixExplanation }} 三维斜视产生的额外视觉压缩，不属于地图投影变形。</p>
          </div>
        </div>
        <div class="formula-band">
          <p class="formula">{{ teaching.formula }}</p>
          <p class="notation">{{ teaching.notation }}</p>
        </div>
      </section>
    </main>
    <OnboardingTour ref="tourRef" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { RotateCcw, Maximize2, ChevronLeft, ChevronRight, Globe2, Cone, Map, Layers, CircleHelp } from 'lucide-vue-next';
import Scene3D from './components/Scene3D.vue';
import OnboardingTour from './components/OnboardingTour.vue';
import Map2D from './components/Map2D.vue';
import {
  PROJECTION_FAMILIES,
  PROJECTION_MODES,
  normalizeProjectionParams,
  getSurfaceMetrics,
  getStandardFeatures,
  getProjectionDetails
} from './core/mapMath.js';
import { getProjectionTeaching } from './core/projectionTeaching.js';

const familyOptions = Object.values(PROJECTION_FAMILIES);

const projectionFamily = ref('cylinder');
const projectionMode = ref('conformal');
const projectionParams = ref(normalizeProjectionParams('cylinder', 'conformal'));
const familyParams = {
  cylinder: normalizeProjectionParams('cylinder', 'conformal'),
  planar: normalizeProjectionParams('planar', 'conformal'),
  conic: normalizeProjectionParams('conic', 'conformal', { latitudeOfOrigin: 35 })
};
const replayKey = ref(0);
const tourRef = ref(null);
const sceneRef = ref(null);
const demoState = ref({ step: 0, playing: false });
const constructionPhase = ref('');
const steps = ['辅助面', '投影映射', '平面结果'];
const details = computed(() => getProjectionDetails(projectionFamily.value, projectionMode.value, projectionParams.value));
const teaching = computed(() => getProjectionTeaching(projectionFamily.value, projectionMode.value, projectionParams.value));
const indicatrixExplanation = computed(() => projectionMode.value === 'conformal'
  ? '等角：展开正视时，微小圆仍为圆，大小可以不同。'
  : projectionMode.value === 'equalArea' ? '等面积：对应椭圆的面积相同，但形状可以不同。'
    : projectionFamily.value === 'planar' ? '正射：越靠近半球边缘，径向压缩越明显。'
      : '等距：沿经线的局部长度比例为 1，不代表椭圆所有方向都不变。');
const goToStep = (index) => sceneRef.value?.goToStep(index);

const currentFamily = computed(() => PROJECTION_FAMILIES[projectionFamily.value]);
const currentMode = computed(() => PROJECTION_MODES[projectionMode.value]);
const surfaceMetrics = computed(() =>
  getSurfaceMetrics(projectionFamily.value, projectionMode.value, projectionParams.value)
);
const standardFeatures = computed(() =>
  getStandardFeatures(projectionFamily.value, projectionParams.value, projectionMode.value)
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
  familyParams[projectionFamily.value] = { ...current };
  const longitude = projectionFamily.value === 'planar' ? current.projectionCenterLon : current.centralMeridian;
  const display = Object.fromEntries(Object.entries(current).filter(([key]) => key.startsWith('show') || key === 'viewScale'));
  const carry = { ...familyParams[family], ...display, centralMeridian: longitude, projectionCenterLon: longitude };
  projectionFamily.value = family;
  projectionParams.value = normalizeProjectionParams(family, projectionMode.value, carry);
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
  const number = Number(event.target.value);
  const valid = event.target.value.trim() !== '' && Number.isFinite(number);
  if (event.type === 'input') {
    if (valid) {
      const next = normalizeProjectionParams(projectionFamily.value, projectionMode.value, { ...projectionParams.value, [key]: number });
      if (next[key] === number) projectionParams.value = next;
    }
    return;
  }
  if (valid) setParam(key, number);
  event.target.value = projectionParams.value[key];
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
  background: #f5f6f5;
  color: #333333;
  font-family: "Microsoft YaHei", "PingFang SC", "Segoe UI", Arial, sans-serif;
  font-size: 15px;
  line-height: 1.5;
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
  background: #f5f6f5;
}

.top-bar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: grid;
  grid-template-columns: minmax(280px, 0.55fr) minmax(440px, 1fr) 38px;
  gap: 16px;
  align-items: center;
  padding: 12px 22px;
  background: rgba(255, 255, 255, 0.96);
  border-bottom: 1px solid #e0e0e0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  backdrop-filter: blur(12px);
}

.brand-block h1 {
  margin: 4px 0 0;
  color: #333333;
  font-size: 1.16rem;
  line-height: 1.2;
}

.eyebrow {
  display: inline-block;
  color: #666666;
  font-family: "Segoe UI", Arial, sans-serif;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0;
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
  border: 1px solid #dedede;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  color: #444444;
  transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
}

.family-tabs button {
  flex: 1;
  min-width: 0;
  padding: 8px 14px;
  text-align: left;
}

.family-tabs button span,
.family-tabs button small {
  display: block;
}

.family-tabs button span {
  color: #333333;
  font-weight: 800;
  font-size: 0.96rem;
}

.family-tabs button small {
  margin-top: 2px;
  color: #777777;
  font-family: "Segoe UI", Arial, sans-serif;
  font-size: 0.74rem;
  text-transform: uppercase;
}

.mode-tabs {
  justify-content: flex-end;
}

.mode-tabs button,
.segmented-control button {
  padding: 9px 13px;
  font-weight: 800;
}

.family-tabs button:hover,
.mode-tabs button:hover,
.segmented-control button:hover,
.icon-button:hover {
  transform: translateY(-1px);
  border-color: #9aaa9f;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.family-tabs button.active,
.mode-tabs button.active,
.segmented-control button.active {
  background: linear-gradient(135deg, #3c5b4c 0%, #333333 100%);
  border-color: #333333;
  color: #ffffff;
}

.family-tabs button.active span,
.family-tabs button.active small {
  color: #ffffff;
}

.main-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 22px 24px;
}

.workspace-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 310px minmax(0, 1fr);
  grid-template-areas: "scene shared map";
  gap: 14px;
  align-items: start;
}

.view-panel,
.shared-parameter-panel,
.param-group {
  background: #ffffff;
  border: 1px solid #e0e0e0;
  box-shadow: none;
}

.view-panel {
  min-width: 0;
  overflow: hidden;
}

.scene-panel {
  grid-area: scene;
}

.shared-parameter-panel {
  grid-area: shared;
  min-width: 0;
  padding: 14px;
}

.map-panel {
  grid-area: map;
  display: flex;
  min-height: 600px;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  min-height: 160px;
  padding: 14px 16px;
  border-bottom: 1px solid #e0e0e0;
  background: #ffffff;
}

.panel-head h2,
.section-title h2,
.param-group h3 {
  margin: 0;
  color: #333333;
}

.panel-head h2 {
  margin-top: 5px;
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

.panel-head p,
.section-title p,
.group-head p,
.metric-note {
  margin: 5px 0 0;
  color: #666666;
  font-size: 0.9rem;
  line-height: 1.5;
}

.scene-tools {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

.status-chip,
.icon-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 8px 11px;
  font-size: 0.86rem;
  font-weight: 800;
}

.status-chip {
  border: 1px solid #e0e0e0;
  background: #f5f6f5;
  color: #666666;
}

.icon-button {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  color: #444444;
  flex: 0 0 36px;
  width: 36px;
  height: 36px;
  padding: 0;
  justify-content: center;
}

.scene-stage {
  position: relative;
  height: 520px;
  padding-bottom: 52px;
  background:
    linear-gradient(90deg, rgba(199, 215, 227, 0.32) 1px, transparent 1px),
    linear-gradient(0deg, rgba(199, 215, 227, 0.32) 1px, transparent 1px),
    #f7f9f8;
  background-size: 32px 32px;
}

.surface-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 9px 14px;
  border-top: 1px solid #e0e0e0;
  background: #fafbfa;
}

.surface-summary span {
  padding: 3px 7px;
  border-left: 3px solid #9aaa9f;
  background: #f5f6f5;
  color: #666666;
  font-size: 12px;
  font-weight: 700;
}

.section-title {
  display: block;
  margin-bottom: 10px;
}

.section-title h2 {
  margin-top: 5px;
  font-size: 1.04rem;
  line-height: 1.35;
}

.section-title p {
  max-width: none;
}

.parameter-column {
  display: grid;
  gap: 12px;
}

.display-controls { display: grid; gap: 14px; margin-top: 14px; }

.param-group {
  padding: 14px;
  min-width: 0;
}

.shared-parameter-panel .param-group {
  border: none;
  border-top: 1px solid #e0e0e0;
  padding: 11px 0 0;
  box-shadow: none;
}

.display-group {
  padding: 13px 14px;
}

.group-head {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  margin-bottom: 9px;
  color: #3c5b4c;
}

.group-head h3 {
  font-size: 14px;
  line-height: 1.35;
}

.param-row,
.segmented-field,
.check-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
}

.param-row span,
.segmented-field > span,
.check-row span {
  color: #333333;
  font-size: 13px;
  font-weight: 800;
}

.param-row small,
.segmented-field small,
.check-row small {
  display: block;
  margin-top: 2px;
  color: #777777;
  font-family: "Segoe UI", Arial, sans-serif;
  font-size: 0.73rem;
  font-weight: 600;
}

.param-row input[type="number"] {
  width: 62px;
  flex-shrink: 0;
  border: 1px solid #d7d7d7;
  background: #ffffff;
  color: #333333;
  padding: 6px 7px;
  text-align: center;
}

.range {
  width: 100%;
  margin: 8px 0 4px;
  accent-color: #3c5b4c;
}

.segmented-control button {
  min-width: 56px;
}

.check-row {
  justify-content: flex-start;
  align-items: flex-start;
  margin-top: 0;
}

.check-row input {
  margin-top: 4px;
  accent-color: #3c5b4c;
}

.check-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 8px;
}

.map-display-group .check-list {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.check-list .check-row:last-child { grid-column: 1 / -1; }

.step-navigation {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 52px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
  border-top: 1px solid #e0e0e0;
  background: rgba(255, 255, 255, 0.93);
  backdrop-filter: blur(8px);
}
.step-navigation button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 0;
  padding: 6px;
  min-height: 34px;
  background: transparent;
  color: #666;
  font-size: 12px;
  white-space: nowrap;
}
.step-navigation button.active { color: #333; background: #e9efec; }
.step-navigation button span { display: grid; place-items: center; width: 19px; height: 19px; background: #e7e7e7; font-size: 11px; }
.step-navigation button.active span { background: #354b43; color: white; }
.step-navigation .step-arrow { width: 28px; padding: 4px; }
button:disabled { cursor: default; opacity: 0.35; }
button:focus-visible, input:focus-visible { outline: 2px solid #477563; outline-offset: 2px; }
.projection-principle { padding: 18px 0 0; border-top: 1px solid #d7dcd9; }
.principle-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
.principle-columns > div { min-width: 0; }
.formula-band { display: flex; align-items: baseline; gap: 12px 28px; flex-wrap: wrap; border-top: 1px solid #e0e0e0; margin-top: 12px; padding-top: 8px; }
.panel-head .phase-caption { font-size: 12px; color: #886024; line-height: 1.5; }
.geometry-key { display: flex; flex-wrap: wrap; gap: 6px 16px; padding: 9px 14px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #555; }
.geometry-key span { display: inline-flex; gap: 6px; align-items: center; }
.geometry-key i { width: 18px; height: 0; border-top: 2px solid; }
.geometry-key .key-source { border-color: #416f8b; }
.geometry-key .key-map { border-color: #d92d20; }
.geometry-key .key-correction { border-color: #a7762d; border-top-style: dashed; }
.geometry-key .key-indicatrix { width: 15px; height: 10px; border: 1px solid #886024; border-radius: 50%; background: rgba(184, 134, 54, 0.3); }
.projection-principle h4 { margin: 10px 0 4px; font-size: 13px; line-height: 1.5; color: #666; border-left: 2px solid #ddd; padding-left: 8px; }
.projection-principle h4.active-explanation { color: #333; border-color: #a7762d; }
.projection-principle .standard-comparison { color: #444; border-top: 1px solid #e0e0e0; padding-top: 8px; }
.projection-principle h3 { margin: 0 0 6px; color: #333; font-size: 14px; }
.projection-principle h3 small { float: right; color: #777; font-size: 12px; font-weight: 400; }
.projection-principle p { margin: 6px 0; color: #666; font-size: 13px; line-height: 1.65; }
.projection-principle .formula { color: #354b43; font-family: Georgia, serif; font-size: 15px; overflow-wrap: anywhere; }
.projection-principle .notation { font-size: 12px; }
.param-row > span, .check-row > span { min-width: 0; overflow-wrap: anywhere; }
.param-row small, .check-row small { font-size: 11px; }

.metric-note {
  padding: 9px 10px;
  border: 1px solid #efc7c0;
  background: #fff8f6;
  color: #8a3328;
}

@media (max-width: 1500px) {
  .workspace-grid {
    grid-template-columns: minmax(0, 1fr) 290px minmax(0, 1fr);
  }
}

@media (max-width: 1100px) {
  .top-bar {
    grid-template-columns: 1fr 38px;
  }
  .family-tabs { grid-row: 2; grid-column: 1 / -1; }
  .intro-trigger { grid-column: 2; grid-row: 1; }
}

@media (max-width: 1180px) {
  .workspace-grid {
    grid-template-columns: 1fr 1fr;
    grid-template-areas:
      "scene map"
      "shared shared";
  }

  .shared-parameter-panel {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 24px;
  }
  .section-title { grid-column: 1 / -1; }
  .display-controls { margin-top: 0; align-content: start; }
}

@media (max-width: 980px) {
  .scene-stage,
  .map-panel {
    min-height: 0;
  }

  .family-tabs {
    overflow-x: auto;
  }

  .family-tabs button {
    min-width: 0;
  }

  .panel-head {
    flex-direction: row;
    min-height: 120px;
  }

  .workspace-grid {
    grid-template-columns: 1fr;
    grid-template-areas:
      "scene"
      "shared"
      "map";
  }

  .principle-columns { grid-template-columns: 1fr; gap: 8px; }
}

@media (max-width: 600px) {
  .top-bar { position: static; padding: 12px; gap: 12px; }
  .brand-block h1 { font-size: 18px; }
  .shared-parameter-panel { display: block; }
  .display-controls { margin-top: 14px; }
  .family-tabs { gap: 4px; }
  .family-tabs button { padding: 9px 7px; }
  .family-tabs button span { font-size: 13px; }
  .family-tabs button small { font-size: 10px; }
  .main-content { padding: 10px; }
  .workspace-grid { gap: 10px; }
  .scene-stage { height: 430px; }
  .scene-display-group .check-list, .map-display-group .check-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .surface-summary { padding: 8px 10px; }
  .surface-summary span { font-size: 12px; padding: 3px 6px; }
}

@media (max-width: 360px) {
  .step-navigation { gap: 2px; }
  .step-navigation button { font-size: 11px; padding: 4px; gap: 3px; }
  .step-navigation button span { width: 16px; height: 18px; font-size: 10px; }
  .step-navigation .step-arrow { flex: 0 0 24px; width: 24px; }
}
</style>
