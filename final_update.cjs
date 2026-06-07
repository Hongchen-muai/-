const fs = require('fs');
const path = require('path');

const threeAppContent = `import * as THREE from 'three';
import gsap from 'gsap';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as topojson from 'topojson-client';

let scene, camera, renderer, controls;
let animationFrameId;

let earthGroup = new THREE.Group();     
let cylinderGroup = new THREE.Group();  
let glassCylinder;                      
let raysGroup = new THREE.Group();      

const R_EARTH = 5;      
const R_CYLINDER = 5.0; 

const createUnfoldMaterial = (colorHex) => {
  return new THREE.ShaderMaterial({
    uniforms: {
      uProject: { value: 0.0 },                     
      uUnfold: { value: 0.0 },                      
      uColor: { value: new THREE.Color(colorHex) }, 
      uOpacity: { value: 0.0 }                      
    },
    vertexShader: \`
      uniform float uProject;
      uniform float uUnfold;
      attribute vec3 spherePos;
      
      void main() {
        vec3 cylPos = position;
        
        float angle = atan(cylPos.x, cylPos.z);
        float flatX = angle * \${R_CYLINDER.toFixed(1)};
        vec3 flatPos = vec3(flatX, cylPos.y, 0.0);
        
        vec3 stage1Pos = mix(spherePos, cylPos, uProject);
        vec3 finalPos = mix(stage1Pos, flatPos, uUnfold);
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPos, 1.0);
      }
    \`,
    fragmentShader: \`
      uniform vec3 uColor;
      uniform float uOpacity;
      void main() {
        gl_FragColor = vec4(uColor, uOpacity);
      }
    \`,
    transparent: true,
    depthWrite: false
  });
};

export function initScene(container) {
  scene = new THREE.Scene();
  
  camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.set(0, 5, 25);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  scene.add(earthGroup);
  scene.add(cylinderGroup);
  scene.add(raysGroup);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(10, 20, 15);
  scene.add(dirLight);

  const sphereGeo = new THREE.SphereGeometry(R_EARTH * 0.98, 64, 64);
  const sphereMat = new THREE.MeshPhongMaterial({ 
    color: 0xfdfbf7, 
    transparent: true, 
    opacity: 0.9,
    shininess: 30
  });
  earthGroup.add(new THREE.Mesh(sphereGeo, sphereMat));

  loadGeoJSON();

  const resizeObserver = new ResizeObserver(() => onWindowResize(container));
  resizeObserver.observe(container);
  animate();
}

function lonLatToSphere(lon, lat, R) {
  const phi = lat * (Math.PI / 180);
  const lambda = lon * (Math.PI / 180);
  return new THREE.Vector3(
    R * Math.cos(phi) * Math.sin(lambda),
    R * Math.sin(phi),
    R * Math.cos(phi) * Math.cos(lambda)
  );
}

function lonLatToMercatorCylinder(lon, lat, R) {
  const lambda = lon * (Math.PI / 180);
  const clampedLat = Math.max(-85, Math.min(85, lat));
  const phi = clampedLat * (Math.PI / 180);
  const y = R * Math.log(Math.tan(Math.PI / 4 + phi / 2));
  return new THREE.Vector3(R * Math.sin(lambda), y, R * Math.cos(lambda));
}

function loadGeoJSON() {
  fetch('https://unpkg.com/world-atlas@2.0.2/land-110m.json')
    .then(res => res.json())
    .then(data => {
      const land = topojson.feature(data, data.objects.land);
      land.features.forEach(feature => {
        if (feature.geometry.type === 'Polygon') {
          drawRegion(feature.geometry.coordinates);
        } else if (feature.geometry.type === 'MultiPolygon') {
          feature.geometry.coordinates.forEach(poly => drawRegion(poly));
        }
      });
    });
}

function drawRegion(coordinates) {
  let spherePoints = [];
  let cylinderPoints = [];

  const flushLines = () => {
    if (spherePoints.length > 1) {
      const sphereGeo = new THREE.BufferGeometry().setFromPoints(spherePoints);
      const sphereMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });
      earthGroup.add(new THREE.Line(sphereGeo, sphereMat));

      const cylinderGeo = new THREE.BufferGeometry().setFromPoints(cylinderPoints);
      const sphereCoords = new Float32Array(spherePoints.length * 3);
      spherePoints.forEach((p, i) => {
        sphereCoords[i*3] = p.x; sphereCoords[i*3+1] = p.y; sphereCoords[i*3+2] = p.z;
      });
      cylinderGeo.setAttribute('spherePos', new THREE.BufferAttribute(sphereCoords, 3));

      const cylMat = createUnfoldMaterial(0x2563eb); 
      const cylLine = new THREE.Line(cylinderGeo, cylMat);
      cylLine.visible = false; 
      cylLine.frustumCulled = false; // FINALLY FIXED RENDER CROPPING IN STEP 2
      cylinderGroup.add(cylLine);

      for (let i = 0; i < spherePoints.length; i += 15) {
        const cylP = cylinderPoints[i];
        const rayGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), cylP]);
        const rayMat = new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0 });
        const rayLine = new THREE.Line(rayGeo, rayMat);
        
        const initScale = R_EARTH / cylP.length();
        rayLine.scale.set(initScale, initScale, initScale);
        rayLine.userData = { initScale: initScale };
        rayLine.frustumCulled = false;
        raysGroup.add(rayLine);
      }
    }
    spherePoints = [];
    cylinderPoints = [];
  };

  let prevLon = null;
  coordinates[0].forEach(coord => {
    const lon = coord[0];
    const lat = coord[1];
    if (prevLon !== null && Math.abs(lon - prevLon) > 90) flushLines();
    prevLon = lon;
    spherePoints.push(lonLatToSphere(lon, lat, R_EARTH));
    cylinderPoints.push(lonLatToMercatorCylinder(lon, lat, R_CYLINDER));
  });
  flushLines();
}

// MAKE STEPS REPEATABLE AND REVERSIBLE
export function step1_wrapCylinder() {
  if (!glassCylinder) {
    const geometry = new THREE.CylinderGeometry(R_CYLINDER * 1.01, R_CYLINDER * 1.01, 30, 64, 1, true);
    const material = new THREE.MeshPhongMaterial({
      color: 0x94a3b8, transparent: true, opacity: 0, side: THREE.DoubleSide, shininess: 100
    });
    glassCylinder = new THREE.Mesh(geometry, material);
    scene.add(glassCylinder);
  }
  
  // Revert states
  cylinderGroup.children.forEach(child => {
    if (child.material && child.material.uniforms) {
      gsap.to(child.material.uniforms.uUnfold, { value: 0.0, duration: 1.5, ease: "power2.inOut" });
      gsap.to(child.material.uniforms.uProject, { value: 0.0, duration: 1.5, ease: "power2.inOut" });
      gsap.to(child.material.uniforms.uOpacity, { value: 0.0, duration: 1.0 });
    }
  });

  raysGroup.children.forEach(ray => {
    gsap.to(ray.scale, { x: ray.userData.initScale, y: ray.userData.initScale, z: ray.userData.initScale, duration: 1.5 });
    gsap.to(ray.material, { opacity: 0, duration: 1.0 });
  });

  earthGroup.children.forEach(mesh => {
    if (mesh.material) gsap.to(mesh.material, { opacity: 0.9, duration: 1.5 });
  });

  gsap.to(camera.position, { x: 15, y: 10, z: 25, duration: 2, ease: "power2.out" });
  gsap.to(glassCylinder.material, { opacity: 0.15, duration: 1.5 });
}

export function step2_projectRays() {
  cylinderGroup.children.forEach(child => {
    if (child.material && child.material.uniforms) {
      child.visible = true;
      gsap.to(child.material.uniforms.uOpacity, { value: 1.0, duration: 0.5 });
      gsap.to(child.material.uniforms.uProject, { value: 1.0, duration: 2.5, ease: "power2.inOut" });
      gsap.to(child.material.uniforms.uUnfold, { value: 0.0, duration: 2.0, ease: "power2.inOut" });
    }
  });

  raysGroup.children.forEach(ray => {
    gsap.to(ray.material, { opacity: 0.4, duration: 0.5 });
    gsap.to(ray.scale, { x: 1, y: 1, z: 1, duration: 2.5, ease: "power2.inOut" });
  });

  earthGroup.children.forEach(mesh => {
    if (mesh.material) gsap.to(mesh.material, { opacity: 0.25, duration: 2.5 });
  });

  if (glassCylinder) gsap.to(glassCylinder.material, { opacity: 0.15, duration: 1.5 });
  gsap.to(camera.position, { x: 15, y: 10, z: 25, duration: 2, ease: "power2.out" });
}

export function step3_unfoldMap() {
  if (glassCylinder) gsap.to(glassCylinder.material, { opacity: 0, duration: 1 });
  raysGroup.children.forEach(ray => {
    gsap.to(ray.material, { opacity: 0, duration: 1 });
  });

  cylinderGroup.children.forEach(child => {
    if (child.material && child.material.uniforms) {
      gsap.to(child.material.uniforms.uUnfold, { value: 1.0, duration: 3, ease: "power2.inOut" });
      // fade out slowly to reveal purely the 2d map behind/below it
      gsap.to(child.material.uniforms.uOpacity, { value: 0.0, delay: 2.0, duration: 1.5 });
    }
  });
  
  gsap.to(camera.position, { x: 0, y: 0, z: 35, duration: 3, ease: "power2.inOut" });
}

export let onRotationChange = null;
export function setRotationCallback(cb) { onRotationChange = cb; }

let extUpdating = false;

// EXPOSE ROTATION SETTER FOR TWO-WAY BINDING
export function setGlobeRotation(lon, lat) {
  if (!camera || !controls) return;
  extUpdating = true;
  const radius = camera.position.distanceTo(controls.target);
  const phi = Math.PI/2 - lat * (Math.PI/180);
  const theta = -lon * (Math.PI/180);

  camera.position.set(
    radius * Math.sin(phi) * Math.sin(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.cos(theta)
  );
  controls.update();

  requestAnimationFrame(() => { extUpdating = false; });
}

function animate() {
  animationFrameId = requestAnimationFrame(animate);
  if (controls) {
    controls.update();
    if (onRotationChange && !extUpdating) {
      let lon = -controls.getAzimuthalAngle() * 180 / Math.PI;
      let lat = (Math.PI / 2 - controls.getPolarAngle()) * 180 / Math.PI;
      onRotationChange({ lon, lat });
    }
  }
  renderer.render(scene, camera);
}

function onWindowResize(container) {
  if (!container) return;
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

export function destroyScene() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  if (renderer) renderer.dispose();
  if (controls) controls.dispose();
}
`;

const appVueContent = `<template>
  <div class="app-container" :class="{ scrolling: isUnfolded || currentTab !== 'show' }">
    <header class="top-nav">
      <div class="brand">🌍 地球投影可视化展示平台</div>
      <nav class="tabs">
        <button :class="{ active: currentTab === 'show' }" @click="currentTab = 'show'">展示面板</button>
        <button :class="{ active: currentTab === 'resources' }" @click="currentTab = 'resources'">课程资源</button>
        <button :class="{ active: currentTab === 'support' }" @click="currentTab = 'support'">支持我们</button>
      </nav>
    </header>

    <div v-show="currentTab === 'show'" class="tab-content show-tab">
      <div class="sidebar">
        <h2>📌 投影过程控制</h2>
        <p class="sidebar-tip">支持鼠标左键旋转 / 中键拖拽 / 滚轮缩放</p>

        <div class="menu">
          <div class="menu-group">
            <button class="menu-btn active">① 圆柱投影：墨卡托 (Mercator)</button>
            <div class="sub-menu">
              <button @click="triggerStep(1)"><span>1.</span> 套上投影圆柱</button>
              <button @click="triggerStep(2)"><span>2.</span> 射线投影与畸变生成</button>
              <button @click="triggerStep(3)"><span>3.</span> 展开为平面地图</button>
            </div>
          </div>

          <button class="menu-btn disabled">② 圆锥投影 (开发中...)</button>
          <button class="menu-btn disabled">③ 方位投影 (开发中...)</button>
        </div>
      </div>

      <div class="main-content" :class="{ 'is-unfolded': isUnfolded }">
        <div class="content-wrapper">
          
          <div class="intro-text">
            <h2>墨卡托投影 (Mercator Projection)</h2>
            <p>墨卡托投影是一种等角正圆柱投影，由荷兰地图学家墨卡托于1569年创立。它的设计初衷是为了航海：在这类地图上，任何两点间的直线（等角航线）都能与所有的经线保持相同的交角，极大地方便了中世纪航海海图的使用。</p>
            <p>本展示平台通过三维交互引擎，实时复现了地球投影至相切圆柱体，再平铺为二维地图的完整数学几何转换过程。展开后，您可以拖拽上方地球模型，下方二维图会实时响应经纬网的变化。</p>
          </div>

          <div class="top-scene">
            <div class="window-frame">
              <Scene3D ref="scene3d" />
            </div>
          </div>

          <div class="bottom-map" v-if="isUnfolded">
            <div class="window-frame map2d-frame">
              <!-- RECEIVE 2-way binding event -->
              <Map2D :globeRotation="globeRotation" @update:rotation="handleRotationFromMap" />
            </div>
          </div>

        </div>
      </div>
    </div>

    <!-- 占位页 -->
    <div v-if="currentTab === 'resources'" class="tab-content other-tab">
      <div class="placeholder-box">
        <h2>📁 资源与课程资料</h2>
        <p>相关教案与资料正在整理，敬请期待...</p>
      </div>
    </div>

    <div v-if="currentTab === 'support'" class="tab-content other-tab">
      <div class="support-box">
        <h2>💖 支持本项目的开发</h2>
        <p>如果您觉得这个可视化平台对您的学习或教学有所启发，欢迎打赏支持我们的服务器与后续维护费用。感谢您的肯定！</p>
        <div class="qrcode-wrapper">
          <div style="height: 250px; background:#f1f5f9; border-radius:8px; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:1.2rem;">二维码区域</div>
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
import { setRotationCallback, setGlobeRotation } from './core/threeApp.js';

const scene3d = ref(null);
const isUnfolded = ref(false);
const currentTab = ref('show');
const globeRotation = ref({ lon: 0, lat: 0 }); 

onMounted(() => {
  setRotationCallback((rot) => {
    globeRotation.value = rot;
  });
});

// TWO WAY BINDING
const handleRotationFromMap = (newRot) => {
  globeRotation.value = newRot;
  setGlobeRotation(newRot.lon, newRot.lat);
};

const triggerStep = (step) => {
  if (scene3d.value) {
    scene3d.value.runStep(step);
  }
  
  if (step === 3) {
    setTimeout(() => {
      isUnfolded.value = true;
    }, 2800);
  } else {
    // Allows repeating previous steps by hiding 2D map
    isUnfolded.value = false;
  }
};
</script>

<style>
/* 强制美化全局默认样式 - 增大字体和改善质感 */
body, html {
  margin: 0 !important; padding: 0 !important;
  width: 100%; height: 100%;
  background-color: #f8fafc !important; color: #1e293b;
  font-family: 'PingFang SC', 'Microsoft YaHei', 'Segoe UI', sans-serif;
  letter-spacing: 0.5px;
}

.app-container {
  width: 100vw; height: 100vh;
  display: flex; flex-direction: column;
  overflow: hidden;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
}

.app-container.scrolling { overflow: auto; }

/* 顶部导航栏 - 高度与字号增加 */
.top-nav {
  height: 90px;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  color: white;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 60px;
  z-index: 1000;
  box-shadow: 0 4px 15px rgba(0,0,0,0.2);
  flex-shrink: 0;
  position: sticky;
  top: 0;
}

.top-nav .brand {
  font-size: 2.2rem; font-weight: 800; letter-spacing: 2px;
  text-shadow: 0 2px 4px rgba(0,0,0,0.5);
}

.tabs { display: flex; gap: 30px; }
.tabs button {
  background: transparent; border: none; color: #cbd5e1;
  font-size: 1.4rem; font-weight: 600; cursor: pointer;
  padding: 10px 24px; border-radius: 8px; transition: all 0.3s;
}
.tabs button.active, .tabs button:hover {
  color: white; background: rgba(255,255,255,0.15);
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.tab-content { flex: 1; position: relative; display: flex; }

/* 左侧边栏 - 美化与宽敞排版 */
.sidebar {
  width: 480px; background: rgba(255, 255, 255, 0.95); 
  border-right: 1px solid #e0dfdc;     
  padding: 40px; display: flex; flex-direction: column; z-index: 10;       
  height: calc(100vh - 90px);
  position: sticky; top: 90px;
  backdrop-filter: blur(10px);
  box-shadow: 2px 0 20px rgba(0,0,0,0.05);
}

.sidebar h2 { font-size: 2.4rem; margin-top: 0; margin-bottom: 0.8rem; color: #0f172a; }
.sidebar-tip { font-size: 1.3rem; color: #64748b; margin-bottom: 2.5rem; font-weight: 500; }

.menu-btn {
  width: 100%; padding: 22px 24px;
  background: white; border: 2px solid #e2e8f0;
  border-radius: 12px; margin-bottom: 16px;
  font-size: 1.5rem; font-weight: 700; color: #334155;
  cursor: pointer; transition: all 0.3s ease;
  box-shadow: 0 4px 6px rgba(0,0,0,0.02); text-align: left;
}

.menu-btn:hover:not(.disabled) {
  border-color: #94a3b8; box-shadow: 0 8px 15px rgba(0,0,0,0.08);
  transform: translateY(-2px);
}

.menu-btn.active {
  background: #f0f9ff; border-color: #3b82f6; color: #1d4ed8;
  border-left: 8px solid #3b82f6;
}

.sub-menu button {
  display: block; width: 92%; margin: 12px auto; padding: 16px 20px;
  background: white; border: 1px solid #cbd5e1; border-radius: 8px;
  cursor: pointer; font-size: 1.3rem; font-weight: 500; text-align: left;
  transition: all 0.2s; color: #475569;
}
.sub-menu button span { color: #3b82f6; font-weight: 800; margin-right: 6px; }
.sub-menu button:hover { background: #f8fafc; border-color: #94a3b8; transform: translateX(4px); }

/* 右侧主画面与间距 */
.main-content {
  flex: 1; display: flex; justify-content: center;
  padding: 50px 30px;
}
.content-wrapper { width: 100%; max-width: 1200px; display: flex; flex-direction: column; gap: 40px; }

.intro-text {
  background: #ffffff; padding: 35px 50px;
  border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.06);
  border-left: 8px solid #3b82f6;
}
.intro-text h2 { margin-top: 0; font-size: 2.5rem; color: #1e293b; margin-bottom: 20px; }
.intro-text p { font-size: 1.4rem; line-height: 2.0; color: #475569; margin-bottom: 15px; }

.top-scene { width: 100%; height: 60vh; min-height: 550px; transition: all 1s ease; }
.main-content.is-unfolded .top-scene { height: 50vh; min-height: 450px; }

.window-frame {
  width: 100%; height: 100%;
  border: 4px solid #fde047;
  box-shadow: 0 15px 35px rgba(0,0,0,0.15);
  border-radius: 16px; overflow: hidden; background: #fff;
  display: flex; align-items: stretch; justify-content: stretch;
}

.bottom-map { width: 100%; animation: fadeIn 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
.map2d-frame { height: auto; min-height: 650px; background: #ffffff; flex-direction: column;}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(40px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 非展示页的主容器样式 */
.other-tab {
  justify-content: center; align-items: flex-start;
  padding-top: 100px;
  min-height: calc(100vh - 90px - 80px); 
}
.placeholder-box, .support-box {
  background: white; padding: 50px 70px; border-radius: 16px;
  box-shadow: 0 15px 40px rgba(0,0,0,0.08); text-align: center; max-width: 700px;
}
.support-box h2 { font-size: 2.4rem; margin-top: 0; }
.support-box p { font-size: 1.4rem; color: #64748b; line-height: 1.8; margin-bottom: 40px; }

.app-footer {
  background: #0f172a; color: #94a3b8;
  padding: 30px 0; text-align: center;
  font-size: 1.2rem; margin-top: auto;
}
.app-footer .divider { margin: 0 20px; color: #475569; }
</style>
`;

const map2dContent = `<template>
  <div class="map2d-container">
    <div class="controls-panel">
      <div class="panel-header">
        <h3>💡 2D 投影参数 (支持双向联动与精确修改)</h3>
        <span class="badge">双向实时同步开启</span>
      </div>
      
      <div class="sliders-grid">
        <div class="param-item">
          <label>经度 (Longitude)</label>
          <input type="range" min="-180" max="180" v-model.number="centerMeridian" @input="onManualUpdate" />
          <input type="number" class="value-input" v-model.number="centerMeridian" @change="onManualUpdate" />
          <span class="unit">°</span>
        </div>
        
        <div class="param-item">
          <label>纬度 (Latitude)</label>
          <input type="range" min="-85" max="85" v-model.number="centerLatitude" @input="onManualUpdate" />
          <input type="number" class="value-input" v-model.number="centerLatitude" @change="onManualUpdate" />
          <span class="unit">°</span>
        </div>

        <div class="param-item">
          <label>旋转角 (Roll)</label>
          <input type="range" min="-180" max="180" v-model.number="roll" @input="updateLocalMap" />
          <input type="number" class="value-input" v-model.number="roll" @change="updateLocalMap" />
          <span class="unit">°</span>
        </div>

        <div class="param-item">
          <label>全局缩放 (Scale)</label>
          <input type="range" min="50" max="800" v-model.number="scale" @input="updateLocalMap" />
          <input type="number" class="value-input scale-i" v-model.number="scale" @change="updateLocalMap" />
        </div>
      </div>
    </div>
    
    <div class="svg-wrapper" ref="wrapperRef">
      <svg ref="svgRef" width="100%" height="600"></svg>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';

const props = defineProps({
  globeRotation: {
    type: Object,
    default: () => ({ lon: 0, lat: 0 })
  }
});

const emit = defineEmits(['update:rotation']);

const centerMeridian = ref(0);
const centerLatitude = ref(0);
const roll = ref(0);
const scale = ref(150);

let isInternalChange = false;

// Listen to Earth 3D changing
watch(() => props.globeRotation, (newVal) => {
  if (!isInternalChange) {
    centerMeridian.value = Math.round(newVal.lon);
    centerLatitude.value = Math.round(newVal.lat);
    updateLocalMap();
  }
}, { deep: true });

// Trigger changes back to Earth 3D
const onManualUpdate = () => {
  isInternalChange = true;
  updateLocalMap();
  emit('update:rotation', { lon: centerMeridian.value, lat: centerLatitude.value });
  setTimeout(() => { isInternalChange = false; }, 100);
};

const svgRef = ref(null);
const wrapperRef = ref(null);
let geoData = null;

const loadData = async () => {
  const res = await fetch('https://unpkg.com/world-atlas@2.0.2/land-110m.json');
  const data = await res.json();
  geoData = topojson.feature(data, data.objects.land);
  updateLocalMap();
};

const updateLocalMap = () => {
  if (!geoData || !svgRef.value) return;
  
  const svg = d3.select(svgRef.value);
  const width = svg.node().clientWidth || 1000;
  const height = svg.node().clientHeight || 600;

  svg.selectAll('*').remove();

  svg.append('rect')
    .attr('width', width)
    .attr('height', height)
    .attr('fill', '#f0f7ff');

  const projection = d3.geoMercator()
    .rotate([-centerMeridian.value, -centerLatitude.value, roll.value])
    .translate([width / 2, height / 2])
    .scale(scale.value);

  const pathGenerator = d3.geoPath().projection(projection);

  svg.append('g')
    .selectAll('path')
    .data(geoData.features)
    .join('path')
    .attr('d', pathGenerator)
    .attr('fill', '#fdfbf7')
    .attr('stroke', '#1e293b')
    .attr('stroke-width', 1.2);

  const graticule = d3.geoGraticule();
  svg.append('path')
    .datum(graticule)
    .attr('class', 'graticule')
    .attr('d', pathGenerator)
    .attr('fill', 'none')
    .attr('stroke', '#94a3b8')
    .attr('stroke-width', 0.6)
    .attr('stroke-dasharray', '4,4');
};

onMounted(() => {
  loadData();
  window.addEventListener('resize', updateLocalMap);
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
  background: linear-gradient(to right, #1e293b, #334155);
  color: white;
  padding: 25px 40px;
  border-bottom: 3px solid #e2e8f0;
}

.panel-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 25px;
}

.panel-header h3 {
  margin: 0; font-size: 1.8rem; font-weight: 700; color: #f8fafc;
  letter-spacing: 1px;
}

.badge {
  background: #10b981; color: white;
  padding: 6px 14px; border-radius: 20px;
  font-size: 1.2rem; font-weight: bold;
  letter-spacing: 0.5px;
  box-shadow: 0 2px 6px rgba(16,185,129,0.4);
}

.sliders-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px 60px;
}

.param-item {
  display: flex;
  align-items: center;
  background: rgba(0,0,0,0.25);
  padding: 15px 20px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.05);
}

.param-item label {
  width: 160px;
  font-size: 1.4rem;
  color: #cbd5e1;
  font-weight: 600;
}

.param-item input[type="range"] {
  flex: 1;
  margin: 0 20px;
  accent-color: #3b82f6; 
  height: 6px;
}

/* Clickable input styling */
.value-input {
  width: 70px;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 6px;
  color: #6ee7b7;
  font-family: 'Courier New', Courier, monospace;
  font-weight: bold;
  font-size: 1.5rem;
  padding: 6px 4px;
  text-align: center;
  outline: none;
  transition: all 0.3s;
}
.value-input.scale-i { width: 85px; }

.value-input:focus {
  background: rgba(255,255,255,0.2);
  border-color: #6ee7b7;
  box-shadow: 0 0 8px rgba(110,231,183,0.5);
}

/* Hide arrows for number inputs */
input[type=number]::-webkit-inner-spin-button, 
input[type=number]::-webkit-outer-spin-button { 
  -webkit-appearance: none; 
  margin: 0; 
}
input[type=number] { -moz-appearance: textfield; }

.unit {
  font-size: 1.4rem;
  color: #94a3b8;
  margin-left: 6px;
  font-weight: bold;
}

.svg-wrapper {
  background: #ffffff;
  flex: 1;
  display: flex;
  min-height: 600px;
}
</style>
`;

const scene3dContent = `<template>
  <div ref="container" class="scene-container"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { initScene, destroyScene, step1_wrapCylinder, step2_projectRays, step3_unfoldMap, setGlobeRotation } from '../core/threeApp.js';

const container = ref(null);

onMounted(() => {
  if (container.value) {
    initScene(container.value);
  }
});

onBeforeUnmount(() => {
  destroyScene();
});

defineExpose({
  runStep: (step) => {
    if (step === 1) step1_wrapCylinder();
    if (step === 2) step2_projectRays();
    if (step === 3) step3_unfoldMap();
  },
  setRotation: (lon, lat) => setGlobeRotation(lon, lat)
});
</script>

<style scoped>
.scene-container { width: 100%; height: 100%; }
</style>
`;

fs.writeFileSync(path.join(__dirname, 'src/core/threeApp.js'), threeAppContent, 'utf8');
fs.writeFileSync(path.join(__dirname, 'src/App.vue'), appVueContent, 'utf8');
fs.writeFileSync(path.join(__dirname, 'src/components/Map2D.vue'), map2dContent, 'utf8');
fs.writeFileSync(path.join(__dirname, 'src/components/Scene3D.vue'), scene3dContent, 'utf8');

console.log("Successfully overhauled functional parity, 2-way dragging, editable inputs, logic repeats and aesthetics.");
