<template>
  <div ref="container" class="scene-container"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { initScene, destroyScene, updateProjectionScene, replayProjectionDemo } from '../core/threeApp.js';

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

const syncScene = () => {
  updateProjectionScene(props.projectionFamily, props.projectionMode, props.projectionParams);
};

onMounted(() => {
  if (container.value) {
    initScene(container.value);
    nextTick(syncScene);
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
  width: 100%;
  height: 100%;
}
</style>
