const fs = require('fs');

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
      uProject: { value: 0.0 },                     // 0: Sphere, 1: Cylinder
      uUnfold: { value: 0.0 },                      // 0: Cylinder, 1: Flat
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

  // 添加稍微好看一点的材质和灯光
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

      // Use a striking blue color for the projected lines to differentiate
      const cylMat = createUnfoldMaterial(0x2563eb); 
      const cylLine = new THREE.Line(cylinderGeo, cylMat);
      cylLine.visible = false; 
      cylinderGroup.add(cylLine);

      for (let i = 0; i < spherePoints.length; i += 15) {
        const cylP = cylinderPoints[i];
        const rayGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), cylP]);
        const rayMat = new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0 });
        const rayLine = new THREE.Line(rayGeo, rayMat);
        
        // Prepare ray scaling for animation later
        const initScale = R_EARTH / cylP.length();
        rayLine.scale.set(initScale, initScale, initScale);
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

export function step1_wrapCylinder() {
  if (!glassCylinder) {
    const geometry = new THREE.CylinderGeometry(R_CYLINDER * 1.01, R_CYLINDER * 1.01, 30, 64, 1, true);
    const material = new THREE.MeshPhongMaterial({
      color: 0x94a3b8, transparent: true, opacity: 0, side: THREE.DoubleSide, shininess: 100
    });
    glassCylinder = new THREE.Mesh(geometry, material);
    scene.add(glassCylinder);
  }
  gsap.to(camera.position, { x: 15, y: 10, z: 25, duration: 2, ease: "power2.out" });
  gsap.to(glassCylinder.material, { opacity: 0.15, duration: 1.5 });
}

export function step2_projectRays() {
  cylinderGroup.children.forEach(child => {
    if (child.material && child.material.uniforms) {
      child.visible = true;
      // Show on sphere instantly
      child.material.uniforms.uOpacity.value = 1.0; 
      child.material.uniforms.uProject.value = 0.0;
      // Animate travelling from sphere outwards to cylinder
      gsap.to(child.material.uniforms.uProject, { value: 1.0, duration: 2.5, ease: "power2.inOut" });
    }
  });

  raysGroup.children.forEach(ray => {
    gsap.to(ray.material, { opacity: 0.4, duration: 0.5 });
    // Animate ray shooting out to cylinder bounds
    gsap.to(ray.scale, { x: 1, y: 1, z: 1, duration: 2.5, ease: "power2.inOut" });
  });

  earthGroup.children.forEach(mesh => {
    if (mesh.material) {
      gsap.to(mesh.material, { opacity: 0.25, duration: 2.5 });
    }
  });
}

export function step3_unfoldMap() {
  if (glassCylinder) gsap.to(glassCylinder.material, { opacity: 0, duration: 1 });
  raysGroup.children.forEach(ray => {
    gsap.to(ray.material, { opacity: 0, duration: 1 });
  });

  cylinderGroup.children.forEach(child => {
    if (child.material && child.material.uniforms) {
      gsap.to(child.material.uniforms.uUnfold, { value: 1.0, duration: 3, ease: "power2.inOut" });
      gsap.to(child.material.uniforms.uOpacity, { value: 0.0, delay: 2.5, duration: 1 });
    }
  });
  gsap.to(camera.position, { x: 0, y: 0, z: 35, duration: 3, ease: "power2.inOut" });
}

export let onRotationChange = null;
export function setRotationCallback(cb) { onRotationChange = cb; }

function animate() {
  animationFrameId = requestAnimationFrame(animate);
  if (controls) {
    controls.update();
    if (onRotationChange) {
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

fs.writeFileSync('src/core/threeApp.js', threeAppContent, 'utf8');

// We also need to rewrite App.vue and Map2D.vue CSS to increase element sizes. Read them first.
let appVue = fs.readFileSync('src/App.vue', 'utf8');
let map2dVue = fs.readFileSync('src/components/Map2D.vue', 'utf8');

// App.vue scale up
appVue = appVue.replace('width: 380px;', 'width: 480px;');
appVue = appVue.replace('height: 60px;', 'height: 80px;');
appVue = appVue.replace('top: 60px;', 'top: 80px;'); // sidebar position
appVue = appVue.replace('padding-top: 80px;', 'padding-top: 100px;');
appVue = appVue.replace('max-width: 1000px;', 'max-width: 1200px;'); // Wider main content

// App.vue fonts
appVue = appVue.replace('font-size: 1.4rem;', 'font-size: 1.8rem;'); // brand
appVue = appVue.replace(/font-size:\s*1\.1rem;/g, 'font-size: 1.3rem;'); // nav tabs and menu btns
appVue = appVue.replace('font-size: 1.6rem;', 'font-size: 2.0rem;'); // sidebar h2
appVue = appVue.replace(/font-size:\s*1\.0rem;/g, 'font-size: 1.25rem;'); // sidebar p
appVue = appVue.replace(/font-size:\s*0\.95rem;/g, 'font-size: 1.2rem;'); // sub menu and footer
appVue = appVue.replace('font-size: 1.8rem;', 'font-size: 2.2rem;'); // intro h2
appVue = appVue.replace('font-size: 1.05rem;', 'font-size: 1.25rem;'); // intro p
appVue = appVue.replace('padding: 15px;', 'padding: 20px;'); // menu-btn padding
appVue = appVue.replace('padding: 10px;', 'padding: 15px;'); // sub-menu btn padding

fs.writeFileSync('src/App.vue', appVue, 'utf8');

// Map2D scale up
map2dVue = map2dVue.replace('font-size: 1.2rem;', 'font-size: 1.6rem;'); // h3
map2dVue = map2dVue.replace('font-size: 0.8rem;', 'font-size: 1.1rem;'); // badge
map2dVue = map2dVue.replace('font-size: 0.95rem;', 'font-size: 1.2rem;'); // label
map2dVue = map2dVue.replace('font-size: 1.1rem;', 'font-size: 1.3rem;'); // readout
map2dVue = map2dVue.replace('width: 180px;', 'width: 200px;'); // label width fix
map2dVue = map2dVue.replace('gap: 20px 40px;', 'gap: 30px 50px;'); // more spacious grid

fs.writeFileSync('src/components/Map2D.vue', map2dVue, 'utf8');

console.log("Updated App.vue, Map2D.vue and threeApp.js successfully.");
