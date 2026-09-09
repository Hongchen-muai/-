<template>
  <nav class="projection-navigation" aria-label="投影类型栏">
    <button v-for="family in primaryOptions" :key="family.key" class="projection-family" :class="{ active: selected === family.key }" :aria-pressed="selected === family.key" @click="select(family.key, false)">
      <span>{{ family.label }}<small>{{ family.labelEn }}</small></span>
    </button>
    <div ref="container" class="projection-selector" @pointerenter="enter" @pointerleave="leave" @focusout="focusOut" @keydown="keydown">
    <button ref="trigger" class="projection-trigger" :class="{ active: isOtherSelected }" aria-label="其他投影" aria-haspopup="menu" :aria-expanded="opened" aria-controls="projection-drawer" @click="toggle">
      <span>其他投影<small>Other</small></span>
      <ChevronDown :size="18" :class="{ expanded: opened }" aria-hidden="true" />
    </button>
    <div v-if="opened" id="projection-drawer" class="projection-drawer" :style="{ maxHeight: `${maxHeight}px` }">
      <div class="drawer-heading">其他投影</div>
      <div class="projection-options" role="menu" aria-label="其他投影选项">
        <button v-for="(family, index) in otherOptions" :key="family.key" role="menuitemradio" :aria-checked="selected === family.key" :class="{ active: selected === family.key }" :style="itemStyle(index)" @click="select(family.key)">
          <span class="option-index" aria-hidden="true">{{ String(index + 1).padStart(2, '0') }}</span>
          <span class="option-name">{{ family.key === 'equalEarth' ? '平等地球' : family.label }}<small>{{ family.labelEn }}</small></span>
          <ChevronRight :size="14" class="option-arrow" aria-hidden="true" />
        </button>
        <button class="option-upcoming" role="menuitemradio" aria-checked="false" disabled>
          <span class="option-index" aria-hidden="true">02</span>
          <span class="option-name">其他待完善<small>Coming Later</small></span>
          <Ellipsis :size="14" aria-hidden="true" />
        </button>
      </div>
    </div>
  </div>
  </nav>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { ChevronDown, ChevronRight, Ellipsis } from 'lucide-vue-next';

const props = defineProps({ options: { type: Array, required: true }, selected: { type: String, required: true } });
const emit = defineEmits(['select']);
const container = ref(null), trigger = ref(null);
const opened = ref(false), maxHeight = ref(430);
const primaryKeys = ['cylinder', 'planar', 'conic'];
const primaryOptions = computed(() => props.options.filter(f => primaryKeys.includes(f.key)));
const otherOptions = computed(() => props.options.filter(f => !primaryKeys.includes(f.key)));
const selectedIndex = computed(() => otherOptions.value.findIndex(f => f.key === props.selected));
const isOtherSelected = computed(() => selectedIndex.value >= 0);
let hoverOpened = false, pinned = false, closeTimer, hoverTimer;
const itemStyle = index => {
  const distance = Math.abs(index - selectedIndex.value);
  return { '--item-opacity': [1, .88, .78, .7][distance], '--item-width': `${100 - distance * 4}%`, '--item-offset': `${distance * 3}px`, '--item-height': `${distance === 0 ? 72 : 56 - distance * 3}px` };
};
function measure() {
  if (trigger.value) maxHeight.value = Math.max(96, Math.min(430, innerHeight - trigger.value.getBoundingClientRect().bottom - 18));
}
function open() { clearTimeout(closeTimer); clearTimeout(hoverTimer); measure(); opened.value = true; }
function close(restoreFocus = false) {
  clearTimeout(closeTimer); clearTimeout(hoverTimer);
  opened.value = false; pinned = hoverOpened = false;
  if (restoreFocus) trigger.value?.focus({ preventScroll: true });
}
function enter(event) {
  if (event.pointerType !== 'mouse') return;
  clearTimeout(closeTimer);
  if (!opened.value) hoverTimer = setTimeout(() => { hoverOpened = true; open(); }, 300);
}
function leave() {
  clearTimeout(hoverTimer);
  if (!pinned) closeTimer = setTimeout(() => close(), 220);
}
function toggle() {
  if (opened.value && !hoverOpened) close();
  else { pinned = true; hoverOpened = false; open(); }
}
function select(key, restoreFocus = true) { emit('select', key); close(restoreFocus); }
function outside(event) { if (!container.value?.contains(event.target)) close(); }
function focusOut(event) { if (!container.value?.contains(event.relatedTarget)) close(); }
async function keydown(event) {
  if (event.key === 'Escape') { event.preventDefault(); close(true); return; }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  pinned = true; hoverOpened = false; open();
  await nextTick();
  const items = [...container.value.querySelectorAll('[role="menuitemradio"]:not(:disabled)')];
  const active = items.indexOf(document.activeElement);
  const index = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
    : active === -1 ? Math.max(0, selectedIndex.value) : (active + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
  items[index]?.focus();
}
onMounted(() => { document.addEventListener('pointerdown', outside); window.addEventListener('resize', measure); });
onBeforeUnmount(() => { clearTimeout(closeTimer); clearTimeout(hoverTimer); document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', measure); });
</script>

<style scoped>
.projection-selector { position: relative; min-width: 0; }
.projection-navigation { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; min-width: 0; }
.projection-trigger, .projection-family { display: flex; justify-content: space-between; align-items: center; gap: 8px; width: 100%; height: 58px; padding: 9px 12px; border: 1px solid #d7e0d9; border-radius: 3px; background: #eef2ef; color: #33463b; text-align: left; }
.projection-trigger.active, .projection-family.active { border-color: #3c5145; background: linear-gradient(135deg, #3c5b4c, #333); color: #fff; }
.projection-trigger:hover, .projection-family:hover { border-color: #769680; }
.projection-trigger > span, .projection-family > span { min-width: 0; font-size: 14px; font-weight: 700; }
.projection-trigger small, .projection-family small { display: block; margin-top: 2px; font: 9px/1.4 "Segoe UI", sans-serif; text-transform: uppercase; opacity: .8; }
.projection-trigger svg { flex-shrink: 0; transition: transform .18s; }
.projection-trigger svg.expanded { transform: rotate(180deg); }
.projection-drawer { position: absolute; z-index: 40; top: calc(100% + 8px); right: 0; width: 272px; max-width: calc(100vw - 24px); padding: 13px; overflow: auto; overscroll-behavior: contain; border: 1px solid #d8e0db; border-top: 2px solid #3c5b4c; border-radius: 4px; background: #f9fbfa; box-shadow: 0 1px 3px rgba(0,0,0,.05); }
.drawer-heading { display: flex; justify-content: space-between; padding: 0 2px 10px; color: #647267; font-size: 12px; }
.drawer-heading span { color: #86958c; font: 10px monospace; }
.projection-options { display: flex; flex-direction: column; gap: 6px; }
.projection-options button { display: grid; grid-template-columns: 18px minmax(0, 1fr) 14px; align-items: center; gap: 9px; width: var(--item-width); min-height: var(--item-height); margin-left: var(--item-offset); padding: 7px 11px; opacity: var(--item-opacity); border: 1px solid #d7e0d9; border-radius: 3px; background: #eaf0ec; color: #293e33; text-align: left; transition: opacity .18s, border-color .18s, background .18s; }
.option-index { font: 10px monospace; color: #6b7d70; }
.option-name { min-width: 0; font-size: 13px; font-weight: 700; line-height: 1.4; }
.option-name small { display: block; margin-top: 3px; font: 9px/1.4 "Segoe UI", sans-serif; text-transform: uppercase; color: #65766a; }
.option-arrow { opacity: 0; }
.projection-options button.active { border-left: 3px solid #8ab29b; background: linear-gradient(135deg, #3c5b4c, #333); color: #fff; }
.active .option-name { font-size: 15px; }
.active .option-index, .active small { color: #e2eae5; }
.active .option-arrow { opacity: 1; }
.projection-options button:not(:disabled):hover { opacity: 1; border-color: #769680; }
.projection-options .option-upcoming { width: calc(100% - 14px); min-height: 43px; margin: 3px 0 0 14px; opacity: .6; border-style: dashed; background: transparent; }
@media (max-width: 600px) { .projection-navigation { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px; } }
@media (prefers-reduced-motion: reduce) { .projection-trigger svg, .projection-options button { transition: none; } }
</style>
