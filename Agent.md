# Agent.md

这是本项目后续协作时给前端/GIS Agent 使用的工作备忘录。项目是一款用于地图投影教学展示的 Vue 3 + Three.js + D3.js 纯前端网页，核心目标是把地图投影从球面到承影面、再到二维平面的过程可视化。

## 1. 当前架构理解

- `src/App.vue` 是全局状态中心，负责投影族、投影性质、演示步骤、拖拽模式、投影中心和投影参数的统一管理。
- `src/components/Scene3D.vue` 是 Vue 包装层，只负责挂载 Three.js 画布，并向 `App.vue` 暴露 `runStep()`、`setRotation()`、`showTransverseCylinder()` 等方法。
- `src/core/threeApp.js` 是三维渲染和动画引擎，负责 Three.js 场景、GSAP 动画、承影面几何、投影射线、红色标准线和斜轴旋转。该文件必须保持与 Vue 解耦。
- `src/components/Map2D.vue` 是二维地图和参数控制组件，使用 D3 绘制 SVG 地图，接收 `App.vue` 的 props，并通过 `update:rotation`、`update:params` 把二维侧交互回传。
- `src/core/mapMath.js` 是 2D/3D 共享的投影数学层，集中保存投影配置、默认参数、标准线计算和前向公式。

## 2. 页面区域统一命名

后续交流和代码注释统一使用以下名称：

| 中文统一名称 | 英文辅助名 | 当前主要代码位置 | 说明 |
| --- | --- | --- | --- |
| 左侧功能栏 | Function Sidebar | `App.vue` 的 `.lesson-sidebar` | 选择投影族、投影性质，以及部分教学辅助开关。 |
| 中间三维展示区 | 3D Display Area | `App.vue` 的 `.scene-display-card`、`.scene-stage` 和 `Scene3D.vue` | 展示地球、承影面、投影射线、标准线和三步动画。 |
| 右侧二维展示区 | 2D Display Area | `App.vue` 的 `.map-display-card`，`Map2D.vue` 的 `.map-display-layout`、`svgRef` | 展示 D3 生成的二维投影结果、经纬网、红色标准线和变形预览。 |
| 二维参数控制区 | 2D Parameter Control Area | `Map2D.vue` 的 `.controls-panel` | 控制投影中心、标准纬线/标准圈、二维地图缩放和变形预览缩放。 |

备注：当前 `Map2D.vue` 把“二维参数控制区”和“右侧二维展示区”放在同一个组件内。讨论页面布局时应区分这两个区域；讨论组件边界时可统一称为 `Map2D` 模块。

## 3. 投影与交互数据流

1. 左侧功能栏改变投影族或投影性质时，`App.vue` 更新 `currentProjection`、`currentVariant`、`projectionParams`，然后调用 `updateProjectionMode()` 同步到 Three.js，并把 props 传给 `Map2D.vue`。
2. 二维参数控制区改变投影中心时，`Map2D.vue` 触发 `update:rotation`，`App.vue` 调用 `setGlobeRotation()` 更新三维投影轴。
3. 二维参数控制区改变标准纬线、双标准纬线或标准圈时，`Map2D.vue` 触发 `update:params`，`App.vue` 归一化参数后调用 `updateProjectionMode()`。
4. 中间三维展示区在“旋转投影轴”模式下拖拽时，`threeApp.js` 通过 `setRotationCallback()` 通知 `App.vue`，再驱动 `Map2D.vue` 重绘。
5. 三步动画由 `App.vue` 的 `currentStep` 控制：套合承影面、投影到承影面、展开为二维地图。`Scene3D.vue` 只转发到 `threeApp.js` 的 step 函数。

## 4. 已有投影类型

- 圆柱投影：墨卡托等角投影、兰勃特等面积圆柱投影。
- 方位投影：心射投影、正射投影、极射赤面投影、兰勃特方位等面积投影。
- 圆锥投影：兰勃特等角圆锥投影、阿尔伯斯等面积圆锥投影。

## 5. 后续开发约定

- 涉及投影公式时，优先在 `mapMath.js` 维护共享数学，再让 `threeApp.js` 和 `Map2D.vue` 调用或保持严格一致。
- 三维空间中地球半径继续使用 `R_EARTH = 5`，承影面几何使用略大于地球的比例避免 Z-fighting。
- 红色 `#d92d20` 统一表示标准纬线、标准圈或局部比例尺为 1 的不变线。
- `threeApp.js` 不引入 Vue，也不直接操作 DOM UI；Vue 与 Three.js 通过公开函数和回调通信。
- 修改数学逻辑后，应运行 `npm run test:math` 和 `npm run build`。
- 修改布局或视觉后，应检查四个区域名称是否仍能对应到实际页面结构。

## 6. 当前可改进点记录

- 当前源文件中中文内容为 UTF-8，若终端显示乱码，应优先检查 PowerShell 编码，不直接判断源码损坏。
- `App.vue` 中仍保留较多历史样式和旧类名，新布局主要看 `.edu-shell`、`.lesson-sidebar`、`.display-grid`、`.scene-display-card`、`.map-display-card`。
- `Map2D.vue` 同时承担参数面板与二维 SVG 地图，后续若做大规模 UI 调整，可以考虑拆分为 `ProjectionParameterPanel` 和 `Map2DCanvas`，但在没有明确需求前不主动重构。
