<template>
  <Teleport to="body">
    <div v-if="content" id="projection-context-help" ref="popup" role="tooltip" class="context-help" :style="{ left: `${position.x}px`, top: `${position.y}px` }" @pointerenter="keepOpen" @pointerleave="scheduleClose">
      <p>{{ content }}</p>
    </div>
  </Teleport>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { placeHelp } from '../ui/projectionHelp.js';

const content = ref('');
const position = ref({ x: 12, y: 12 });
const popup = ref(null);
let anchor, described, showTimer, hideTimer, frame;
let keyboardMode = false;
const HOVER_DELAY = 800;
const tooltipId = 'projection-context-help';
const targetOf = node => node instanceof Element ? node.closest('[data-help]') : null;
function keepOpen() { clearTimeout(hideTimer); }
function close() {
  clearTimeout(showTimer); clearTimeout(hideTimer); cancelAnimationFrame(frame);
  if (described) {
    const ids = (described.getAttribute('aria-describedby') || '').split(' ').filter(id => id && id !== tooltipId);
    if (ids.length) described.setAttribute('aria-describedby', ids.join(' '));
    else described.removeAttribute('aria-describedby');
  }
  anchor = described = null;
  content.value = '';
}
function track() {
  if (!anchor?.isConnected || document.querySelector('dialog[open]')) { close(); return; }
  const rect = anchor.getBoundingClientRect();
  if (rect.bottom < 0 || rect.top > innerHeight || rect.width === 0) { close(); return; }
  content.value = anchor.getAttribute('data-help') || '';
  if (popup.value) {
    // Keep explanations away from adjacent P/G/M labels in the canvas.
    const placementAnchor = anchor.matches('.point-label') ? anchor.closest('.scene-container').getBoundingClientRect() : rect;
    const next = placeHelp(placementAnchor, popup.value.getBoundingClientRect(), { width: innerWidth, height: innerHeight });
    if (next.x !== position.value.x || next.y !== position.value.y) position.value = next;
  }
  frame = requestAnimationFrame(track);
}
async function show(target) {
  if (!target?.isConnected || document.querySelector('dialog[open]')) return;
  close();
  anchor = target;
  content.value = target.getAttribute('data-help') || '';
  described = target.contains(document.activeElement) ? document.activeElement : target;
  const ids = new Set((described.getAttribute('aria-describedby') || '').split(' ').filter(Boolean));
  ids.add(tooltipId);
  described.setAttribute('aria-describedby', [...ids].join(' '));
  await nextTick();
  if (anchor === target) track();
}
function scheduleClose() {
  clearTimeout(showTimer); clearTimeout(hideTimer);
  hideTimer = setTimeout(close, 160);
}
function pointerOver(event) {
  if (event.buttons) return;
  if (popup.value?.contains(event.target)) { keepOpen(); return; }
  const target = targetOf(event.target);
  if (!target) return;
  keepOpen();
  clearTimeout(showTimer);
  if (anchor === target) return;
  showTimer = setTimeout(() => show(target), HOVER_DELAY);
}
function pointerOut(event) {
  if (targetOf(event.target) === targetOf(event.relatedTarget) || popup.value?.contains(event.relatedTarget)) return;
  scheduleClose();
}
function focusIn(event) {
  if (!keyboardMode) return;
  const target = targetOf(event.target);
  if (target) show(target);
  else close();
}
function pointerDown(event) {
  keyboardMode = false;
  if (popup.value?.contains(event.target)) return;
  const target = targetOf(event.target);
  close();
  if (event.pointerType === 'touch' && target?.matches('.point-label, .geometry-key [data-help], .surface-summary [data-help], .formula')) show(target);
}
function keydown(event) {
  if (event.key === 'Tab') keyboardMode = true;
  if (event.key === 'Escape') close();
}
const listeners = { pointerover: pointerOver, pointerout: pointerOut, pointerdown: pointerDown, focusin: focusIn, focusout: scheduleClose, keydown };
onMounted(() => Object.entries(listeners).forEach(([name, handler]) => document.addEventListener(name, handler)));
onBeforeUnmount(() => {
  close();
  Object.entries(listeners).forEach(([name, handler]) => document.removeEventListener(name, handler));
});
</script>

<style>
.context-help { position: fixed; z-index: 80; width: 318px; max-width: calc(100vw - 24px); max-height: calc(100vh - 24px); overflow: auto; padding: 13px 15px; border: 1px solid #d5dfd9; border-top: 2px solid #477563; border-radius: 4px; background: #fff; color: #405248; box-shadow: 0 1px 3px rgba(0,0,0,.05); }
.context-help p { margin: 0; font-size: 13px; line-height: 1.75; white-space: pre-line; overflow-wrap: anywhere; }
[data-help]:not(input):not(button) { cursor: help; }
[data-help]:focus-visible { outline: 2px solid #477563; outline-offset: 3px; }
.geometry-key [data-help] { text-decoration: underline dotted #b4c1b9; text-underline-offset: 4px; }
</style>
