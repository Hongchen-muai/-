<template>
  <div class="dynamic-bg">
    <div v-for="block in activeBlocks" :key="block.id"
         class="text-block"
         :style="{ left: block.x + '%', top: block.y + '%' }"
         :class="{ 'fade-in': !block.isFadingOut, 'fade-out': block.isFadingOut }">
      <h3 class="block-title">{{ block.title }}</h3>
      <p class="block-content">
        {{ block.displayedContent }}<span class="cursor" v-show="!block.isDone">_</span>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue';

const gisTerms = [
  { title: "圆柱投影 Cylindrical", content: "将地球表面投影到包裹在地球外部的圆柱面上。墨卡托投影是最著名的等角圆柱投影，其经纬线成正交的直线网，广泛应用于航海和Web地图服务。它能够保持局部角度的不变性，确保航线在地图上显示为直线。然而，由于投影光线从球心发散，高纬度地区的面积会被严重夸大，例如格陵兰岛在图上看起来与非洲大小相当，但实际上非洲要大得多，因此不适合用于全球面积分布对比的场景。" },
  { title: "方位投影 Azimuthal", content: "以平面作为投影面，将球面上的经纬线网投影到平面上。这种投影能保持中心点到各个方向的方位角不变，投影光线可以从球心、球面一端或无穷远处射出。它常用于极地地图和航空图绘制。在极点投影时，所有经线呈放射状，纬线呈同心圆，直观反映极地特征；而在赤道投影时，中央经线和赤道为正交直线，四周变形逐渐增大，适合半球展示。" },
  { title: "圆锥投影 Conic", content: "将地球表面投影到与地球相切或相割的圆锥面上。展开后经线呈放射状直线，纬线呈同心圆弧。非常适合绘制中纬度东西延伸的地区，如中国、美国全图。割圆锥投影有两条标准纬线，在这两条线上没有任何变形，而在这两条线之间及外侧的区域，变形情况分布相对均匀，能够很好地兼顾面积和形状的平衡，是国家级基础地理信息系统首选的投影方式之一。" },
  { title: "前方交会 Intersection", content: "摄影测量与遥感中的基本三维空间定位方法。在两个或多个已知空间位置的控制点（如相机拍摄点）上，通过测量两个方向线，利用空间几何相交原理，求得两条或多条方向线在空间中唯一交点坐标的严密解算过程。它是立体视觉和多目视觉重建的基石，广泛应用于无人机测绘、三维实景建模和工业摄影测量领域。" },
  { title: "后方交会 Resection", content: "已知三个以上地面绝对控制点坐标的情况下，在待定观测点上进行光学观测，通过测出目标点之间的空间或平面夹角，利用空间几何约束反向解算出观测点自身的三维空间坐标位置。此方法是航空摄影测量中相机外方位元素解算的核心步骤，也被广泛用于机器人视觉导航（SLAM）和手持设备的初始位置姿态定位标定中。" },
  { title: "高程模型 DEM", content: "Digital Elevation Model，是以数字矩阵形式高精度表示地面高程的实体模型。它通过格网状排列的高程数据，纯粹描述地形的起伏形态，去除了地表建筑物和植被等非地形因素。DEM是流域分析、坡度坡向计算、可视性分析和三维地形仿真的基础数据底座，在水文水资源、土木工程和军事战场环境感知中不可或缺。" },
  { title: "空间缓冲 Buffer", content: "地理信息系统（GIS）最基本且高频使用的空间分析功能。指在点、线、面等空间几何实体周围，通过数学形态学自动建立一定宽度范围的多边形区域，用于解决空间“邻近度”问题。例如，划定河流两侧500米的生态保护区，或是计算化工厂爆炸影响半径内的受灾人口数量，它是将抽象的几何距离转化为具象的分析范围的关键算法。" },
  { title: "叠置分析 Overlay", content: "将同一地理区域的两个或多个不同主题图层进行空间布尔逻辑叠加，产生包含新空间实体拓扑关系和复合属性的计算过程。它是GIS空间决策支持的核心，常用于复杂选址分析。例如，通过将“平原图层”、“水系图层”和“交通路网图层”进行交集叠置，瞬间筛选出既平坦又靠近水源且交通便利的最优建设地块。" },
  { title: "拓扑关系 Topology", content: "数学概念在地理学中的延伸，描述地理实体在空间上的相邻、包含、相交等关系，且这种本征关系在空间坐标发生连续变形时依然保持绝对不变。严密的拓扑规则是GIS进行高级空间查询、复杂网络分析和保证数据几何质量的绝对数学基础。" },
  { title: "空间插值 Interpolation", content: "利用已知有限采样点的属性数据，基于空间自相关性原理，估算预测同一区域内其他大量未知点属性值的地质数学方法。常见的有克里金插值、反距离权重法。它将离散的点数据转化为连续的面状栅格数据，在气象温度预测、矿产资源储量评估中极其关键。" },
  { title: "坐标转换 Transform", content: "包含仿射变换和投影转换的集合。仿射变换包括平移、缩放、旋转和倾斜，能保持图形的直线性和平行性。而更复杂的投影转换则涉及椭球体基准面的变更和高阶多项式拟合，解决不同国家标准坐标系（如WGS84、CGCS2000）之间的无缝衔接与数据融合问题。" },
  { title: "高斯克吕格 Gauss-Krüger", content: "一种等角横切椭圆柱投影。假设用一个椭圆柱横套在地球椭球体上，并与某一条子午线相切。它是中国大中比例尺国家基本比例尺地形图的法定投影规范。它能保证在中央经线附近长度和面积变形极小，非常适合南北狭长分布的国家进行精密国土测绘与工程建设。" }
];

const activeBlocks = ref([]);
let idCounter = 0;
let availableTerms = [...gisTerms];
let spawnInterval = null;

// 高密度网格: 4列 x 4行 = 16个宫格，错落分布
const cells = [];
for (let c = 0; c < 4; c++) {
  for (let r = 0; r < 4; r++) {
    cells.push({ x: [c * 25, c * 25 + 10], y: [r * 25, r * 25 + 10] });
  }
}

const spawnBlock = () => {
  if (activeBlocks.value.length >= 10) return; 

  if (availableTerms.length === 0) availableTerms = [...gisTerms];
  
  const termIdx = Math.floor(Math.random() * availableTerms.length);
  const term = availableTerms.splice(termIdx, 1)[0];

  const usedCells = activeBlocks.value.map(b => b.cellIdx);
  const freeCells = cells.map((_, i) => i).filter(c => !usedCells.includes(c));
  if (freeCells.length === 0) return;
  
  const cellIdx = freeCells[Math.floor(Math.random() * freeCells.length)];
  const cell = cells[cellIdx];
  
  const posX = cell.x[0] + Math.random() * (cell.x[1] - cell.x[0]);
  const posY = cell.y[0] + Math.random() * (cell.y[1] - cell.y[0]);

  const block = reactive({
    id: idCounter++,
    cellIdx,
    title: term.title,
    fullContent: term.content,
    displayedContent: '',
    x: posX,
    y: posY,
    isDone: false,
    isFadingOut: false
  });

  activeBlocks.value.push(block);

  let charIdx = 0;
  const typeTimer = setInterval(() => {
    if (charIdx < block.fullContent.length) {
      block.displayedContent += block.fullContent[charIdx];
      charIdx++;
    } else {
      clearInterval(typeTimer);
      block.isDone = true;
      // 完成后停留 1秒 (1000ms)，然后开始淡出
      setTimeout(() => {
        block.isFadingOut = true;
        setTimeout(() => {
          activeBlocks.value = activeBlocks.value.filter(b => b.id !== block.id);
        }, 1200); // 配合 CSS 的淡出时间
      }, 1000); 
    }
  }, 20); // 调整为 20ms，让打字效果清晰可见
};

onMounted(() => {
  spawnInterval = setInterval(spawnBlock, 700); // 间隔700ms密集生成
  spawnBlock();
  setTimeout(spawnBlock, 300);
  setTimeout(spawnBlock, 600);
  setTimeout(spawnBlock, 900);
});

onUnmounted(() => {
  clearInterval(spawnInterval);
});
</script>

<style scoped>
.dynamic-bg {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  width: 100%; height: 100%;
  pointer-events: none;
  overflow: hidden;
}

.text-block {
  position: absolute;
  width: 280px;
  font-family: "Noto Serif SC", serif;
  opacity: 0;
  transition: opacity 1.2s ease;
  z-index: 1;
}

.text-block.fade-in {
  opacity: 1;
}

.text-block.fade-out {
  opacity: 0;
}

.block-title {
  font-size: 2rem; /* 如参考图一样巨大的背景标题 */
  font-family: "Noto Serif SC", serif;
  font-weight: 300;
  margin: 0 0 10px 0;
  color: rgba(0, 0, 0, 0.15); /* 提升亮度，原来是 0.06 */
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.block-content {
  font-size: 0.9rem; /* 原为 0.8rem，略微放大 */
  line-height: 1.8;
  margin: 0;
  color: rgba(0, 0, 0, 0.35); /* 明显加深颜色，确保正文打字可见，原来是 0.04 */
  text-align: justify;
}

.cursor {
  display: inline-block;
  width: 6px;
  background: rgba(0,0,0,0.05);
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  50% { opacity: 0; }
}
</style>
