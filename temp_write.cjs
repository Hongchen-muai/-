const fs = require('fs');

const appContent = `<template>
  <div class="app-container" :class="{ scrolling: isUnfolded || currentTab !== 'show' }">
    <header class="top-nav">
      <div class="brand">地球投影可视化展示平台</div>
      <nav class="tabs">
        <button :class="{ active: currentTab === 'show' }" @click="currentTab = 'show'">展示</button>
        <button :class="{ active: currentTab === 'resources' }" @click="currentTab = 'resources'">资源</button>
        <button :class="{ active: currentTab === 'support' }" @click="currentTab = 'support'">支持我们</button>
      </nav>
    </header>

    <div v-show="currentTab === 'show'" class="tab-content show-tab">
      <div class="sidebar">
        <h2>投影过程控制</h2>
        <p>教学平台 (支持鼠标左键旋转/中键拖拽/滚轮缩放)</p>

        <div class="menu">
          <div class="menu-group">
            <button class="menu-btn active">① 圆柱投影：墨卡托</button>
            <div class="sub-menu">
              <button @click="triggerStep(1)">1. 套上投影圆柱</button>
              <button @click="triggerStep(2)">2. 射线投影与畸变生成</button>
              <button @click="triggerStep(3)">3. 展开为平面地图</button>
            </div>
          </div>

          <button class="menu-btn disabled">② 圆锥投影 (待开发)</button>
          <button class="menu-btn disabled">③ 方位投影 (待开发)</button>
        </div>
      </div>

      <div class="main-content" :class="{ 'is-unfolded': isUnfolded }">
        <div class="content-wrapper">
          
          <div class="intro-text">
            <h2>墨卡托投影 (Mercator Projection)</h2>
            <p>墨卡托投影是一种等角正圆柱投影，由荷兰地图学家墨卡托于1569年创立。它的设计初衷是为了航海：在这类地图上，任何两点间的直线（等角航线）都能与所有的经线保持相同的交角，极大地方便了中世纪航海海图的使用。</p>
            <p>本展示平台通过三维交互引擎，实时复现了地球投影至相切圆柱体，再平铺为二维地图的完整数学几何转换过程。展开后，您可以拖拽上方地球模型，下方二维图会实时响应二维自转极联级的变化。</p>
          </div>

          <div class="top-scene">
            <div class="window-frame">
              <Scene3D ref="scene3d" />
            </div>
          </div>

          <div class="bottom-map" v-if="isUnfolded">
            <div class="window-frame map2d-frame">
              <Map2D :globeRotation="globeRotation" />
            </div>
          </div>

        </div>
      </div>
    </div>

    <!-- 资源与支持页 (简单占位) -->
    <div v-if="currentTab === 'resources'" class="tab-content other-tab">
      <div class="placeholder-box">
        <h2>资源与课程资料</h2>
        <p>相关教案与资料正在整理，敬请期待...</p>
      </div>
    </div>

    <div v-if="currentTab === 'support'" class="tab-content other-tab">
      <div class="support-box">
        <h2>支持本项目的开发</h2>
        <p>如果您觉得这个可视化平台对您的学习或教学有所启发，欢迎打赏支持我们的服务器与后续维护费用。感谢您的肯定！</p>
        <div class="qrcode-wrapper">
          <img src="/assets/收款.png" alt="微信收款码" />
        </div>
      </div>
    </div>

    <footer class="app-footer" v-if="currentTab !== 'show' || isUnfolded">
      <div class="footer-content">
        <span>创作者：张云山</span>
        <span class="divider">|</span>
        <span>邮箱：1022364689@qq.com</span>
        <span class="divider">|</span>
        <span>机构：湖南师范大学地理科学学院</span>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import Scene3D from './components/Scene3D.vue';
import Map2D from './components/Map2D.vue';
import { setRotationCallback } from './core/threeApp.js';

const scene3d = ref(null);
const isUnfolded = ref(false);
const currentTab = ref('show');
const globeRotation = ref({ lon: 0, lat: 0 }); // 传入对象

onMounted(() => {
  setRotationCallback((rot) => {
    globeRotation.value = rot;
  });
});

const triggerStep = (step) => {
  if (scene3d.value) {
    scene3d.value.runStep(step);
  }
  if (step === 3) {
    setTimeout(() => {
      isUnfolded.value = true;
    }, 3200);
  }
};
</script>

<style>
/* 强制覆盖全局默认样式 */
body, html {
  margin: 0 !important; padding: 0 !important;
  width: 100%; height: 100%;
  background-color: #f9f6f0 !important; color: #333333;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.app-container {
  width: 100vw; height: 100vh;
  display: flex; flex-direction: column;
  overflow: hidden;
}

.app-container.scrolling {
  overflow: auto;
}

/* 顶部导航栏 */
.top-nav {
  height: 60px;
  background-color: #1f2937;
  color: white;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 40px;
  z-index: 1000;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  flex-shrink: 0;
  position: sticky;
  top: 0;
}

.top-nav .brand {
  font-size: 1.4rem; font-weight: bold; letter-spacing: 1px;
}

.tabs {
  display: flex; gap: 20px;
}
.tabs button {
  background: transparent; border: none; color: #cbd5e1;
  font-size: 1.1rem; font-weight: 500; cursor: pointer;
  padding: 8px 16px; border-radius: 6px; transition: all 0.2s;
}
.tabs button.active, .tabs button:hover {
  color: white; background: #334155;
}

/* 页面内容 */
.tab-content {
  flex: 1; position: relative; display: flex;
}

/* 非展示页的主容器样式 */
.other-tab {
  justify-content: center; align-items: flex-start;
  padding-top: 80px;
  background: #f9f6f0;
  min-height: calc(100vh - 60px - 80px); /* 减去顶部nav和footer高度 */
}

.placeholder-box, .support-box {
  background: white; padding: 40px 60px; border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.05); text-align: center;
  max-width: 600px;
}
.support-box h2 { margin-top: 0; }
.support-box p { color: #64748b; line-height: 1.6; margin-bottom: 30px; }
.qrcode-wrapper img {
  width: 250px; height: auto; border-radius: 8px;
  border: 4px solid #f1f5f9;
}


/* 左侧边栏 - 仅展示页生效 */
.sidebar {
  width: 380px; background-color: #ffffff; border-right: 1px solid #e0dfdc;     
  padding: 30px; display: flex; flex-direction: column; z-index: 10;       
  height: calc(100vh - 60px);
  position: sticky;
  top: 60px;
}

.sidebar h2 {
  font-size: 1.6rem;
  margin-top: 0;
  margin-bottom: 0.5rem;
}

.sidebar p {
  font-size: 1.0rem;
  color: #666666;
  margin-bottom: 2rem;
}

.menu-btn {
  width: 100%;
  padding: 15px;
  background-color: #f5f5f5;
  border: 1px solid #dcdcdc;
  border-radius: 8px;
  margin-bottom: 12px;
  font-size: 1.1rem;
  font-weight: bold;
  color: #333;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  text-align: left;
}

.menu-btn:hover:not(.disabled) {
  background-color: #fff;
  border-color: #a0a0a0;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  transform: translateY(-2px);
}

.menu-btn.active {
  background-color: #e9ecef;
  border-left: 5px solid #3b82f6;
}

.sub-menu button {
  display: block; width: 90%; margin: 8px auto; padding: 10px;
  background: white; border: 1px solid #ddd; border-radius: 6px;
  cursor: pointer; font-size: 0.95rem; text-align: left; transition: all 0.2s;
}

.sub-menu button:hover {
  background: #f8f9fa; border-color: #ccc;
}


/* 右侧主要地图区域 */
.main-content {
  flex: 1; display: flex; justify-content: center;
  padding: 40px 20px;
}

.content-wrapper {
  width: 100%; max-width: 1000px;
  display: flex; flex-direction: column;
  gap: 40px;
}

.intro-text {
  background: #ffffff; padding: 25px 40px;
  border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  border-left: 6px solid #3b82f6;
}

.intro-text h2 {
  margin-top: 0; font-size: 1.8rem; color: #1e293b;
}

.intro-text p {
  font-size: 1.05rem; line-height: 1.8; color: #475569;
  margin-bottom: 10px;
}

/* 3D视图窗口 */
.top-scene {
  width: 100%; height: 60vh; min-height: 500px;
  transition: all 1s ease;
}

.main-content.is-unfolded .top-scene {
  height: 50vh; min-height: 400px;
}

/* 统一加上黄边框并强化阴影 */
.window-frame {
  width: 100%; height: 100%;
  border: 3px solid #fde047;
  box-shadow: 0 8px 25px rgba(0,0,0,0.1);
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
  display: flex; align-items: stretch; justify-content: stretch;
}

/* 2D视图窗口 */
.bottom-map {
  width: 100%;
  animation: fadeIn 1s ease forwards;
}

.map2d-frame {
  height: auto;
  min-height: 600px;
  background: #ffffff;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 页脚 */
.app-footer {
  background: #1e293b; color: #94a3b8;
  padding: 25px 0; text-align: center;
  font-size: 0.95rem; margin-top: auto;
}

.app-footer .divider {
  margin: 0 15px; color: #475569;
}
</style>
`;

fs.writeFileSync('src/App.vue', appContent, 'utf8');

const map2dContent = `<template>
  <div class="map2d-container">
    <div class="controls-panel">
      <div class="panel-header">
        <h3>2D 投影参数 (实时响应)</h3>
        <span class="badge">同步开启</span>
      </div>
      
      <div class="sliders-grid">
        <div class="param-item">
          <label>经度 (Center Meridian)</label>
          <input type="range" min="-180" max="180" v-model.number="centerMeridian" @input="updateMap" />
          <span class="value-readout">{{ centerMeridian }}°</span>
        </div>
        
        <div class="param-item">
          <label>纬度 (Reference Latitude)</label>
          <input type="range" min="-85" max="85" v-model.number="centerLatitude" @input="updateMap" />
          <span class="value-readout">{{ centerLatitude }}°</span>
        </div>

        <div class="param-item">
          <label>旋转角 (Roll/Rotation)</label>
          <input type="range" min="-180" max="180" v-model.number="roll" @input="updateMap" />
          <span class="value-readout">{{ roll }}°</span>
        </div>

        <div class="param-item">
          <label>全局缩放 (Scale)</label>
          <input type="range" min="50" max="800" v-model.number="scale" @input="updateMap" />
          <span class="value-readout">{{ scale }}</span>
        </div>
      </div>
    </div>
    
    <div class="svg-wrapper" ref="wrapperRef">
      <svg ref="svgRef" width="100%" height="550"></svg>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';

const props = defineProps({
  globeRotation: {
    type: Object, // { lon, lat }
    default: () => ({ lon: 0, lat: 0 })
  }
});

const centerMeridian = ref(0);
const centerLatitude = ref(0);
const roll = ref(0);
const scale = ref(150);

// 这里深度监听 3D 传来的两轴角度
watch(() => props.globeRotation, (newVal) => {
  centerMeridian.value = Math.round(newVal.lon);
  centerLatitude.value = Math.round(newVal.lat);
  updateMap();
}, { deep: true });

const svgRef = ref(null);
const wrapperRef = ref(null);
let geoData = null;

const loadData = async () => {
  const res = await fetch('https://unpkg.com/world-atlas@2.0.2/land-110m.json');
  const data = await res.json();
  geoData = topojson.feature(data, data.objects.land);
  updateMap();
};

const updateMap = () => {
  if (!geoData || !svgRef.value) return;
  
  const svg = d3.select(svgRef.value);
  const width = svg.node().clientWidth || 1000;
  const height = svg.node().clientHeight || 600;

  svg.selectAll('*').remove();

  // 背景海洋色（极浅的蓝色）
  svg.append('rect')
    .attr('width', width)
    .attr('height', height)
    .attr('fill', '#f4faff');

  // 构建投影仪，支持经度、纬度、自转(Z轴旋转)
  const projection = d3.geoMercator()
    .rotate([-centerMeridian.value, -centerLatitude.value, roll.value])
    .translate([width / 2, height / 2])
    .scale(scale.value);

  const pathGenerator = d3.geoPath().projection(projection);

  // 绘制陆地
  svg.append('g')
    .selectAll('path')
    .data(geoData.features)
    .join('path')
    .attr('d', pathGenerator)
    .attr('fill', '#fdfbf7') // 极浅的米色陆地
    .attr('stroke', '#000000') // 坚持用黑线，凸显几何感
    .attr('stroke-width', 0.8);

  // 绘制经纬网格
  const graticule = d3.geoGraticule();
  svg.append('path')
    .datum(graticule)
    .attr('class', 'graticule')
    .attr('d', pathGenerator)
    .attr('fill', 'none')
    .attr('stroke', '#cbd5e1')
    .attr('stroke-width', 0.5)
    .attr('stroke-dasharray', '3,3'); // 使用虚线
};

onMounted(() => {
  loadData();
  window.addEventListener('resize', updateMap);
});
</script>

<style scoped>
.map2d-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}

.controls-panel {
  background: #1e293b;
  color: white;
  padding: 20px 30px;
  border-bottom: 2px solid #e2e8f0;
}

.panel-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 20px;
}

.panel-header h3 {
  margin: 0; font-size: 1.2rem; font-weight: 600; color: #f8fafc;
}

.badge {
  background: #10b981; color: white;
  padding: 4px 10px; border-radius: 20px;
  font-size: 0.8rem; font-weight: bold;
  letter-spacing: 0.5px;
}

.sliders-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px 40px;
}

.param-item {
  display: flex;
  align-items: center;
  background: #334155;
  padding: 10px 15px;
  border-radius: 8px;
}

.param-item label {
  width: 180px;
  font-size: 0.95rem;
  color: #cbd5e1;
}

.param-item input[type="range"] {
  flex: 1;
  margin: 0 15px;
  accent-color: #3b82f6; 
}

.value-readout {
  width: 50px;
  text-align: right;
  font-family: monospace;
  font-weight: bold;
  color: #fca5a5;
  font-size: 1.1rem;
}

.svg-wrapper {
  background: #ffffff;
  flex: 1;
  display: flex;
  min-height: 550px;
}
</style>
`;
fs.writeFileSync('src/components/Map2D.vue', map2dContent, 'utf8');
console.log("Successfully wrote App.vue and Map2D.vue");
