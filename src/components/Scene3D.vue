<template>
  <div ref="container" class="scene-container">
    <div v-if="status" class="scene-status" role="status">{{ status }}</div>
    <span v-for="label in annotations" :key="label.text" class="point-label" :style="{ left: `${label.x}px`, top: `${label.y}px`, color: label.color }">{{ label.text }}</span>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { initScene, destroyScene, updateProjectionScene, replayProjectionDemo, goToProjectionStep, fitProjectionView } from '../core/threeApp.js';

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
  },
  replayKey: {
    type: Number,
    default: 0
  }
});

const container = ref(null);
const status = ref('正在加载三维场景');
const annotations = ref([]);
const emit = defineEmits(['demo-state', 'construction-phase']);
defineExpose({ goToStep: goToProjectionStep, fitView: fitProjectionView });

const syncScene = () => {
  updateProjectionScene(props.projectionFamily, props.projectionMode, props.projectionParams);
};

onMounted(() => {
  if (container.value) {
    try {
      initScene(container.value, {
        onReady: () => { status.value = ''; },
        onError: (message) => { status.value = message; },
        onDemoState: (state) => emit('demo-state', state),
        onAnnotations: (labels) => { annotations.value = labels; },
        onConstructionPhase: (phase) => emit('construction-phase', phase)
      });
      nextTick(syncScene);
    } catch (error) {
      status.value = '无法启动 WebGL 三维场景，请检查浏览器硬件加速。';
      console.error(error);
    }
  }
});

watch(
  () => [props.projectionFamily, props.projectionMode, props.projectionParams],
  syncScene,
  { deep: true }
);

watch(
  () => props.replayKey,
  () => replayProjectionDemo()
);

onBeforeUnmount(() => {
  destroyScene();
});
</script>

<style scoped>
.scene-container {
  position: relative;
  width: 100%;
  height: 100%;
}
.scene-status {
  position: absolute;
  top: 16px;
  left: 16px;
  right: 16px;
  z-index: 2;
  color: #666;
  font-size: 13px;
}
.point-label {
  position: absolute;
  z-index: 1;
  pointer-events: none;
  padding: 0 3px;
  height: 20px;
  font: 600 13px/20px monospace;
  white-space: nowrap;
  background: rgba(255, 255, 255, 0.85);
}
</style>
