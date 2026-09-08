<template>
  <Teleport to="body">
    <dialog ref="dialogRef" class="intro-dialog" aria-modal="true" aria-labelledby="intro-title" aria-describedby="intro-description" @cancel.prevent="close" @keydown="onKeydown">
      <template v-if="opened">
        <div v-for="(tile, i) in layout.tiles" :key="`tile-${i}`" class="intro-mask" :style="rectStyle(tile)" aria-hidden="true"></div>
        <div v-for="(hole, i) in layout.holes" :key="`hole-${i}`" class="intro-spotlight" :style="rectStyle(hole)" aria-hidden="true"></div>
        <section class="intro-board" :style="rectStyle(layout.panel)">
          <header class="intro-head">
            <div><span class="intro-eyebrow">入门导览 · {{ step.kicker }}</span><h2 id="intro-title" ref="headingRef" tabindex="-1">{{ step.title }}</h2></div>
            <button class="intro-icon" aria-label="关闭导览" title="关闭导览" @click="close"><X :size="18" /></button>
          </header>
          <div ref="bodyRef" id="intro-description" class="intro-body" :key="index">
            <template v-if="step.kind === 'overview'">
              <div class="intro-pair" aria-hidden="true"><Globe2 :size="42" :stroke-width="1.2" /><ArrowRight :size="24" /><Map :size="42" :stroke-width="1.2" /></div>
              <p>地球表面是曲面，地图是平面。把同一地点从球面换算到平面，距离、角度或面积通常会发生变化。</p>
              <p>透明的圆柱、平面或圆锥帮助表达坐标关系，不代表每种投影都能由光线直接得到。<strong>平等地球是数学定义的伪圆柱投影</strong>，不靠物理圆柱展开。</p>
              <p class="intro-note">三维与二维表达同一组地理位置；三维视角造成的压缩，不等于地图本身的变形。</p>
            </template>
            <template v-else-if="step.kind === 'lines'">
              <div class="intro-line-label"><i class="intro-blue"></i><strong>蓝线：球面上的位置</strong></div>
              <p>圆柱、圆锥和平等地球中表示球面标准线；方位投影中表示辅助平面与球面的交圈或中心。</p>
              <div class="intro-line-label"><i class="intro-red"></i><strong>红线：对应的投影位置</strong></div>
              <p>同一条球面线按投影公式映射后，得到辅助面与二维地图上的红线。蓝红线对应同一组地点，<strong>不一定在三维空间重合</strong>。</p>
              <p class="intro-note">标准线表示沿该线长度比例为 1，不表示所有方向都无变形。方位投影的交圈也不一定是真比例线。</p>
            </template>
            <template v-else-if="step.kind === 'mapping'">
              <div class="intro-letter-diagram" aria-label="圆柱几何参考 O、P、G，以及数学修正 G 到 M">
                <span>O<small>球心</small></span><i></i><span>P<small>球面点</small></span><i></i><span>G<small>几何交点</small></span><ArrowRight class="correction-arrow" :size="22" /><span>M<small>实际投影</small></span>
              </div>
              <p>圆柱演示中，O、P、G 共线，只是几何参考；再按等角、等面积或等距条件由 G 修正到 M。<strong>橙色虚线是数学修正，不是弯曲的光线。</strong></p>
              <p class="intro-note">相割时 G 可能在 O 与 P 之间，上图只列符号关系，不表示固定的空间先后。</p>
              <p>本网站的球极平面投影使用单点透视，O 此时是对跖点视点；正射投影使用平行射线。其他数学投影的连线表示位置对应，不能一概当作光线。</p>
            </template>
            <template v-else-if="step.kind === 'distortion'">
              <div class="intro-ellipse-diagram" aria-hidden="true"><span class="reference-circle"></span><ArrowRight :size="24" /><span class="sample-ellipse"></span></div>
              <p>球面上相同大小的微小参考圆，映射到地图后得到<strong>一阶变形椭圆</strong>。它描述该点附近不同方向的伸缩。</p>
              <dl class="intro-definitions"><div><dt>等角</dt><dd>微小圆仍为圆，大小可以变化。</dd></div><div><dt>等面积</dt><dd>面积比例保持一致，形状可以变扁。</dd></div></dl>
              <p class="intro-note">三维中的斜视还会使圆看起来变扁；应与展开正视的二维结果区分。这里的动画仅示意面积不变的伸缩。</p>
            </template>
            <template v-else>
              <dl class="intro-definitions"><div><dt>中心、轴向与原点</dt><dd>中心与轴向决定投影的地理朝向，不是相机视角；圆锥的原点纬度只平移纵坐标。</dd></div><div><dt>标准纬线</dt><dd>指定沿哪些纬线长度比例为 1；改变它通常会改变地图尺度或形状。</dd></div><div><dt>方位投影的交圈</dt><dd>改变辅助平面位置：球极平面投影整体缩放；等面积方位与正射投影的二维坐标不变。</dd></div><div><dt>R 与角度</dt><dd>R 是球面半径。参数框以度为单位；公式中的三角函数使用相应弧度。</dd></div></dl>
              <p class="intro-note">同一种投影不能同时保持全球所有距离、角度和面积。图例、公式与标准线一起说明它保留了什么。</p>
            </template>
          </div>
          <footer class="intro-footer">
            <label class="intro-preference"><input v-model="dismissed" type="checkbox" @change="persistPreference" />我已了解，以后不再提示</label>
            <div class="intro-navigation">
              <button class="intro-icon" aria-label="上一项" title="上一项" :disabled="index === 0" @click="move(-1)"><ChevronLeft :size="18" /></button>
              <span class="intro-progress" aria-live="polite">{{ index + 1 }} / {{ TOUR_STEPS.length }}</span>
              <button class="intro-next" @click="index === TOUR_STEPS.length - 1 ? close() : move(1)">{{ index === TOUR_STEPS.length - 1 ? '开始查看' : '下一项' }}<Check v-if="index === TOUR_STEPS.length - 1" :size="17" /><ChevronRight v-else :size="17" /></button>
            </div>
          </footer>
        </section>
      </template>
    </dialog>
    <p v-if="storageWarning" class="intro-storage-warning" role="status">浏览器未允许保存偏好，下次可能再次提示。</p>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { ArrowRight, Check, ChevronLeft, ChevronRight, Globe2, Map, X } from 'lucide-vue-next';
import { TOUR_STEPS, isTourDismissed, saveTourPreference, tourLayout } from '../onboarding/tour.js';

const dialogRef = ref(null);
const headingRef = ref(null);
const bodyRef = ref(null);
const opened = ref(false);
const index = ref(0);
const dismissed = ref(false);
const storageWarning = ref(false);
const step = computed(() => TOUR_STEPS[index.value]);
const layout = ref({ holes: [], tiles: [], panel: {} });
let originalScroll, originalFocus, originalOverflow;
let frame = 0, repositionFrame = 0, openTimer = 0, warningTimer = 0;
let observer;

const storage = () => { try { return window.localStorage; } catch { return null; } };
const rectStyle = r => ({ left: `${r.x}px`, top: `${r.y}px`, width: `${r.width}px`, height: `${r.height}px` });
function targets() {
  const elements = step.value.targets.map(name => document.querySelector(`[data-tour="${name}"]`)).filter(Boolean);
  return (step.value.kind === 'overview' || step.value.kind === 'lines') && window.innerWidth > 1180 ? elements : elements.slice(0, 1);
}
function measure() {
  if (!opened.value) return;
  layout.value = tourLayout(window.innerWidth, window.innerHeight, targets().map(el => el.getBoundingClientRect()));
}
function scheduleMeasure() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(measure);
}
function onResize() {
  cancelAnimationFrame(repositionFrame);
  repositionFrame = requestAnimationFrame(() => { if (opened.value) focusStep(); });
}
async function focusStep() {
  await nextTick();
  if (!opened.value) return;
  const elements = targets();
  const first = elements[0];
  if (first) {
    const bounds = first.getBoundingClientRect();
    const header = document.querySelector('.top-bar');
    const headerBottom = header && getComputedStyle(header).position === 'sticky' ? header.getBoundingClientRect().bottom + 8 : 16;
    let top = Math.max(headerBottom, window.innerWidth <= 1180 ? 16 : Math.min(120, (window.innerHeight - bounds.height) / 2));
    if (window.innerWidth <= 600 && first.dataset.tour === 'scene') {
      const available = window.innerHeight - Math.min(460, window.innerHeight * 0.54) - 24;
      if (bounds.height > available) top = (available - bounds.height) / 2;
    }
    window.scrollTo({ top: window.scrollY + bounds.top - top, behavior: 'instant' });
  }
  observer?.disconnect();
  elements.forEach(el => observer?.observe(el));
  measure();
  headingRef.value?.focus({ preventScroll: true });
  if (bodyRef.value) bodyRef.value.scrollTop = 0;
}
async function open() {
  clearTimeout(openTimer);
  if (opened.value) return;
  originalFocus = document.activeElement;
  originalScroll = { x: window.scrollX, y: window.scrollY };
  originalOverflow = document.body.style.overflow;
  dismissed.value = isTourDismissed(storage());
  index.value = 0;
  opened.value = true;
  document.body.style.overflow = 'hidden';
  await nextTick();
  dialogRef.value.showModal();
  await focusStep();
}
function restorePage() {
  document.body.style.overflow = originalOverflow ?? '';
  if (originalScroll) window.scrollTo({ left: originalScroll.x, top: originalScroll.y, behavior: 'instant' });
  const focusTarget = originalFocus?.isConnected && originalFocus !== document.body
    ? originalFocus : document.querySelector('.intro-trigger');
  focusTarget?.focus({ preventScroll: true });
  observer?.disconnect();
  cancelAnimationFrame(frame);
  cancelAnimationFrame(repositionFrame);
}
function persistPreference() {
  storageWarning.value = !saveTourPreference(storage(), dismissed.value);
  clearTimeout(warningTimer);
  if (storageWarning.value) {
    warningTimer = window.setTimeout(() => { storageWarning.value = false; }, 6000);
  }
}
function close() {
  if (!opened.value) return;
  persistPreference();
  opened.value = false;
  dialogRef.value.close();
  restorePage();
}
function move(delta) {
  index.value = Math.max(0, Math.min(TOUR_STEPS.length - 1, index.value + delta));
  focusStep();
}
function onKeydown(event) {
  if (event.key === 'Escape') { event.preventDefault(); close(); return; }
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault();
    move(event.key === 'ArrowRight' ? 1 : -1);
  }
  if (event.key === 'Tab') {
    const items = [...dialogRef.value.querySelectorAll('button:not(:disabled), input')];
    const at = items.indexOf(document.activeElement);
    if (event.shiftKey && at <= 0) { event.preventDefault(); items.at(-1)?.focus(); }
    else if (!event.shiftKey && (at === -1 || at === items.length - 1)) { event.preventDefault(); items[0]?.focus(); }
  }
}
onMounted(() => {
  observer = new ResizeObserver(scheduleMeasure);
  window.addEventListener('resize', onResize);
  window.addEventListener('scroll', scheduleMeasure, { passive: true });
  if (!isTourDismissed(storage())) openTimer = window.setTimeout(open, 350);
});
onBeforeUnmount(() => {
  clearTimeout(openTimer);
  clearTimeout(warningTimer);
  cancelAnimationFrame(frame);
  cancelAnimationFrame(repositionFrame);
  observer?.disconnect();
  window.removeEventListener('resize', onResize);
  window.removeEventListener('scroll', scheduleMeasure);
  if (opened.value) { dialogRef.value?.close(); restorePage(); }
});
defineExpose({ open });
</script>

<style scoped>
.intro-dialog { position: fixed; inset: 0; max-width: none; max-height: none; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; background: transparent; color: #333; overflow: hidden; }
.intro-dialog::backdrop { background: transparent; }
.intro-mask { position: absolute; background: rgba(249, 251, 250, 0.88); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
.intro-spotlight { position: absolute; border: 2px solid #477563; pointer-events: none; }
.intro-board { position: absolute; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; background: #fff; border-top: 3px solid #477563; padding: 18px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.intro-head { display: flex; align-items: flex-start; gap: 8px; padding-bottom: 12px; }
.intro-head > div { flex: 1; min-width: 0; }
.intro-eyebrow { font-size: 11px; color: #64756c; }
.intro-head h2 { margin: 5px 0 0; font-size: 19px; line-height: 1.45; outline: none; overflow-wrap: anywhere; }
.intro-body { overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; padding-right: 4px; font-size: 14px; line-height: 1.75; }
.intro-body::-webkit-scrollbar { width: 4px; }
.intro-body::-webkit-scrollbar-thumb { background: #bdc9c1; border-radius: 2px; }
.intro-body p { margin: 0 0 12px; }
.intro-body strong { color: #354b43; font-weight: 600; }
.intro-body .intro-note { padding-left: 10px; border-left: 2px solid #bdc9c1; color: #68706b; font-size: 12px; }
.intro-icon { width: 32px; height: 32px; padding: 0; flex: 0 0 32px; display: inline-grid; place-items: center; border: 1px solid #e0e0e0; background: #fff; color: #555; }
.intro-icon:hover { background: #f1f4f2; }
.intro-footer { border-top: 1px solid #e0e0e0; margin-top: 10px; padding-top: 12px; }
.intro-preference { display: flex; align-items: center; gap: 7px; font-size: 12px; cursor: pointer; }
.intro-preference input { accent-color: #3c5b4c; width: 15px; height: 15px; margin: 0; flex-shrink: 0; }
.intro-navigation { display: flex; align-items: center; gap: 10px; margin-top: 14px; }
.intro-progress { color: #777; font-size: 12px; font-variant-numeric: tabular-nums; }
.intro-next { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 6px 12px; background: #3c5b4c; border: 1px solid #3c5b4c; color: #fff; font-size: 13px; }
.intro-next:hover { background: #304c3e; }
.intro-pair, .intro-ellipse-diagram { display: flex; align-items: center; justify-content: center; gap: 28px; height: 84px; margin-bottom: 12px; color: #477563; background: #f5f8f6; }
.intro-line-label { display: flex; align-items: center; gap: 9px; margin-bottom: 5px; }
.intro-line-label i { width: 26px; flex: 0 0 26px; border-top: 3px solid; }
.intro-line-label .intro-blue { border-color: #416f8b; }
.intro-line-label .intro-red { border-color: #d92d20; }
.intro-letter-diagram { display: flex; align-items: flex-start; justify-content: space-between; padding: 12px 0; margin-bottom: 8px; gap: 3px; }
.intro-letter-diagram span { text-align: center; font: 19px Georgia, serif; color: #354b43; flex-shrink: 0; }
.intro-letter-diagram small { display: block; font: 10px/1.8 "PingFang SC", sans-serif; color: #777; }
.intro-letter-diagram i { flex: 1; border-top: 1px solid #7c8881; margin-top: 12px; min-width: 5px; }
.intro-letter-diagram .correction-arrow { color: #a7762d; flex-shrink: 0; }
.intro-definitions { margin: 0; }
.intro-definitions > div { margin-bottom: 12px; }
.intro-definitions dt { font-weight: 600; color: #354b43; }
.intro-definitions dd { margin: 2px 0 0; }
.reference-circle, .sample-ellipse { width: 40px; height: 40px; border: 1.5px solid #986c2f; border-radius: 50%; background: rgba(184, 134, 54, 0.24); }
@property --intro-stretch { syntax: '<number>'; initial-value: 1; inherits: false; }
.sample-ellipse { animation: ellipse-stretch 4s ease-in-out infinite; transform: scale(var(--intro-stretch), calc(1 / var(--intro-stretch))); }
@keyframes ellipse-stretch { 0%, 100% { --intro-stretch: 1; } 50% { --intro-stretch: 1.5; } }
.intro-storage-warning { position: fixed; bottom: 16px; left: 16px; right: 16px; z-index: 100; margin: 0; padding: 10px 14px; background: #fff; border: 1px solid #e0e0e0; font-size: 13px; }
@media (max-width: 600px) {
  .intro-board { padding: 12px 14px; }
  .intro-head { padding-bottom: 8px; }
  .intro-head h2 { font-size: 17px; }
  .intro-body { font-size: 13px; }
  .intro-pair, .intro-ellipse-diagram { height: 60px; gap: 24px; }
  .intro-footer { padding-top: 8px; margin-top: 6px; }
  .intro-navigation { margin-top: 9px; }
}
@media (prefers-reduced-motion: reduce) { .sample-ellipse { animation: none; transform: scale(1.5, 0.6666667); } }
</style>
