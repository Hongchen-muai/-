# 地图投影教学平台改造计划

本文档只制定修改方案，暂不改动业务代码。确认后再进入实现阶段。

## 1. 改造目标

本次改造的核心目标是把页面从“复杂联动演示器”调整为“专业、清晰、可教学的投影参数观察平台”：

- 顶部固定投影类型栏，方便在圆柱投影、平面/方位投影、圆锥投影之间切换。
- 三维展示区与二维展示区左右相邻，同屏对比。
- 三维区只展示投影逻辑和参数对球体/承影面的直观影响，投影图像作为示意，不强求与真实投影完全一致。
- 二维区独立承担精确投影结果，所有二维地图必须按 D3/投影公式正确绘制。
- 参数调节区作为 3D 与 2D 的共同入口，按作用对象分类，用 GIS 专业术语命名。
- 取消从三维展示区反向修改参数的逻辑，三维区只允许拖动观察视角。

## 2. 权威资料依据

后续实现投影名称、参数术语、历史和用途说明时，优先依据以下资料：

- USGS：John P. Snyder, *Map Projections: A Working Manual*，用于投影原理、公式和历史背景。https://pubs.usgs.gov/publication/pp1395
- PROJ Mercator 文档：确认墨卡托为等角圆柱投影及航海用途。https://proj.org/en/stable/operations/projections/merc.html
- PROJ Equal Area Cylindrical 文档：确认 Lambert Cylindrical Equal-Area 是 `lat_ts=0` 的等面积圆柱特例。https://proj.org/en/stable/operations/projections/cea.html
- PROJ Equidistant Cylindrical 文档：确认 Plate Carrée / Equidistant Cylindrical、`lat_ts`、`lon_0` 等参数。https://proj.org/en/stable/operations/projections/eqc.html
- PROJ Lambert Conformal Conic 文档：确认 LCC、双标准纬线和适用范围。https://proj.org/operations/projections/lcc.html
- PROJ Albers Equal Area 文档：确认 Albers Equal-Area Conic 和双标准纬线参数。https://proj.org/operations/projections/aea.html
- PROJ Equidistant Conic 文档：确认 Equidistant Conic 和双标准纬线参数。https://proj.org/en/stable/operations/projections/eqdc.html
- PROJ Stereographic、Lambert Azimuthal Equal Area、Orthographic 文档：确认方位投影参数和半球显示限制。https://proj.org/en/stable/operations/projections/stere.html、https://proj.org/en/stable/operations/projections/laea.html、https://proj.org/en/stable/operations/projections/ortho.html
- D3 官方 d3-geo 文档：确认前端可直接使用的投影 API。https://d3js.org/d3-geo/cylindrical、https://d3js.org/d3-geo/conic、https://d3js.org/d3-geo/azimuthal

## 3. 页面结构调整

### 3.1 顶部固定栏

原“左侧功能栏”改为顶部固定栏，统一命名为“投影类型栏”。

内容：

- 圆柱投影 Cylindrical
- 平面/方位投影 Planar / Azimuthal
- 圆锥投影 Conic
- 当前投影性质切换：等角、等面积、常用/妥协

交互：

- 切换投影大类时保留可兼容参数，如中央经线、投影中心纬度。
- 切换投影性质时只更新二维投影公式和说明文字，三维区仍保留对应大类的经典点光源/透视示意。
- 顶部栏常驻屏幕上方，页面滚动时不丢失。

### 3.2 主展示区

顶部栏下方设置左右双栏：

- 左侧：三维展示区，显示球体、承影面、示意投影射线、承影面上的示意图像。
- 右侧：二维展示区，显示精确二维投影地图、经纬网、标准线/标准圈、可选变形椭圆。

建议比例：

- 桌面端：三维区 50%，二维区 50%，高度保持一致。
- 窄屏端：上下堆叠，三维区在上，二维区在下。

### 3.3 参数调节区

参数区位于三维/二维展示区下方，横跨两栏，作为两个展示区共同的参数来源。

分类：

- 球体与投影中心参数
- 承影面参数
- 二维地图显示参数
- 教学辅助显示参数

这样用户先观察左右对比，再向下调整参数，参数变化同时反馈到上方两个展示区。

## 4. 投影类型与二维精确投影方案

### 4.1 圆柱投影 Cylindrical

保留三种性质：

- 等角：墨卡托投影 Mercator，D3 使用 `d3.geoMercator()`。
- 等面积：兰伯特等面积圆柱投影 Lambert Cylindrical Equal-Area，D3 使用自定义 `d3.geoProjection(raw)`，公式以 `lat_ts` 控制标准纬线。
- 常用/妥协：等距圆柱投影 / 经纬网投影 Plate Carrée / Equidistant Cylindrical，D3 使用 `d3.geoEquirectangular()`，必要时扩展 `lat_ts` 版本。

二维参数：

- 中央经线 Central Meridian
- 投影原点纬度 Latitude of Projection Origin
- 标准纬线 / 真比例纬线 Standard Parallel / Latitude of True Scale
- 地图显示比例尺 View Scale

三维示意：

- 只展示“球心点光源向外投影到圆柱承影面”的教学逻辑。
- 圆柱轴向支持正轴圆柱 Normal Aspect 与横轴圆柱 Transverse Aspect。
- 圆柱半径由“标准纬线 / 真比例纬线”控制：`R_cylinder = R_earth * cos(phi_ts)`。`phi_ts = 0` 时为相切圆柱，`phi_ts > 0` 时为相割圆柱。
- 圆柱上的图像为示意图，不声明为真实墨卡托或真实等面积圆柱结果。

### 4.2 平面/方位投影 Planar / Azimuthal

保留三种性质：

- 等角：极射赤面投影 Stereographic，D3 使用 `d3.geoStereographic()` 或现有 raw 投影。
- 等面积：兰伯特等面积方位投影 Lambert Azimuthal Equal-Area，D3 使用 `d3.geoAzimuthalEqualArea()` 或现有 raw 投影。
- 常用/妥协：正射投影 Orthographic，D3 使用 `d3.geoOrthographic()`。

二维参数：

- 投影中心经度 Longitude of Projection Center
- 投影中心纬度 Latitude of Projection Center
- 标准圈角距 Standard Circle Angular Distance
- 地图显示比例尺 View Scale
- 半球裁切 Hemisphere Clipping

三维示意：

- 使用平面承影面展示方位投影逻辑。
- 为满足“经典点光源投影”的教学要求，三维示意默认采用心射式逻辑：点光源位于球心，射线投向切平面或割平面。
- 平面位置由“标准圈角距”控制：`d = R_earth * cos(c)`。`c = 0` 为切平面，`c > 0` 为割平面。
- 平面可通过投影中心经纬度调整相切/相割位置。
- 平面投影二维结果默认只显示承影面朝向的半球，避免背半球点在教学展示中造成误解。对 Stereographic 和 LAEA，这属于教学域裁切；投影公式本身仍按正确数学公式计算。

### 4.3 圆锥投影 Conic

保留三种性质：

- 等角：兰伯特等角圆锥投影 Lambert Conformal Conic，D3 使用 `d3.geoConicConformal()`。
- 等面积：阿尔伯斯等面积圆锥投影 Albers Equal-Area Conic，D3 使用 `d3.geoConicEqualArea()`。
- 常用/妥协：等距圆锥投影 Equidistant Conic，D3 使用 `d3.geoConicEquidistant()`。

二维参数：

- 中央经线 Central Meridian
- 投影原点纬度 Latitude of Projection Origin
- 第一标准纬线 First Standard Parallel
- 第二标准纬线 Second Standard Parallel
- 地图显示比例尺 View Scale

三维示意：

- 使用球心点光源向圆锥承影面投影的教学逻辑。
- 圆锥形状由第一、第二标准纬线共同决定。
- 两条标准纬线不同且位于同一半球时展示相割圆锥；两条标准纬线趋近时展示相切圆锥。
- 三维圆锥上的投影图像只作示意，避免继续追求与 LCC/Albers/Equidistant Conic 的完整数学一致。

## 5. 参数区专业命名方案

### 5.1 球体与投影中心参数

- 中央经线 Central Meridian
- 投影中心经度 Longitude of Projection Center
- 投影中心纬度 Latitude of Projection Center
- 投影原点纬度 Latitude of Projection Origin
- 投影轴向 Aspect：正轴 Normal、横轴 Transverse

说明：

- 圆柱投影使用“中央经线”和“投影轴向”。
- 方位投影使用“投影中心经度/纬度”。
- 圆锥投影使用“中央经线”和“投影原点纬度”。

### 5.2 承影面参数

圆柱投影：

- 标准纬线 / 真比例纬线 Standard Parallel / Latitude of True Scale
- 圆柱半径 Cylinder Radius，仅作为三维教学辅助显示，可由标准纬线自动换算，不一定让用户直接输入。
- 承影关系 Developable Surface Contact：相切 Tangent、相割 Secant，自动由标准纬线判断。

平面/方位投影：

- 标准圈角距 Standard Circle Angular Distance
- 平面距球心距离 Plane Distance from Sphere Center，由标准圈角距自动换算。
- 承影关系 Plane Contact：切平面 Tangent Plane、割平面 Secant Plane。

圆锥投影：

- 第一标准纬线 First Standard Parallel
- 第二标准纬线 Second Standard Parallel
- 圆锥常数 Cone Constant，仅作为高级只读说明。
- 承影关系 Cone Contact：切圆锥 Tangent Cone、割圆锥 Secant Cone。

### 5.3 二维地图显示参数

- 地图显示比例尺 View Scale
- 适屏 Fit to View
- 显示经纬网 Graticule
- 显示标准线/标准圈 Standard Line / Standard Circle
- 显示变形椭圆 Tissot Indicatrix

### 5.4 教学辅助显示参数

- 显示投影射线 Projection Rays
- 显示点光源 Point Light Source
- 显示承影面 Developable Surface
- 重新播放投影示意 Replay Demonstration

## 6. 三维展示区交互和动画调整

现有三步动画容易出现回退失败、圆锥结果错位、重复演示需要刷新等问题。建议改为更稳定的操作模型：

- 取消“上一步/下一步”作为核心控制。
- 改为三维区右上角只保留观察视角按钮，使用小眼睛图标和文字“观察视角”。
- 鼠标拖动三维区只控制相机 OrbitControls，不再反向修改任何投影参数。
- 三维区下方或角落提供三个显示开关：承影面、投影射线、示意投影图像。
- 提供“重新演示”按钮，每次都从当前参数重新生成场景并播放一次投影射线到承影面的动画。
- 参数变化时，停止旧动画，重新计算承影面和示意图像，避免旧动画状态残留。
- `threeApp.js` 中保留纯 JS 引擎边界，新增 `setProjectionParameters(params)` 之类的单向 API，由 `App.vue` 调用。

## 7. 二维展示区精确性方案

二维区必须独立于三维示意，按数学投影正确绘制：

- 使用统一投影配置表定义每个大类下的三种模式。
- 每个投影模式明确 `projectionFactory(params)`，返回 D3 projection。
- 地图数据继续使用 `public/world-110m.json`。
- 投影参数变化时只重绘二维 SVG，不依赖三维动画状态。
- 方位投影根据教学需求设置半球裁切，避免背半球数据显示造成误解。
- 标准线/标准圈由 `mapMath.js` 统一计算，二维红线与参数保持一致。

## 8. 变形椭圆方案

二维区增加“显示变形椭圆 Tissot Indicatrix”开关。

实现策略：

- 通过投影函数的局部数值导数计算每个采样点的东西向和南北向尺度。
- 绘制小椭圆，椭圆长短轴和旋转角表达局部角度/面积/长度变形。
- 如果投影点被裁切、导数结果非有限数、或当前缩放导致椭圆严重遮挡，则该采样点不绘制。
- 如果某种投影模式下无法稳定计算，则自动关闭变形椭圆，并显示简短状态文字“当前参数下变形椭圆已隐藏”。
- 默认不开启，避免干扰教学主视图。

## 9. 投影说明文字方案

每个二维投影模式提供简短专业说明，位置放在二维展示区下方或右上角可折叠信息区，不遮挡地图。

说明内容包含：

- 投影名称，中英文。
- 投影性质：等角、等面积、等距/常用视觉。
- 历史来源。
- 典型用途。
- 主要变形特征。

示例风格：

- 墨卡托投影：等角圆柱投影，1569 年由 Mercator 提出，恒向线为直线，适合航海方向表达，但高纬面积显著放大。
- 兰伯特等面积圆柱投影：圆柱等面积投影，保持面积比例，适合全球专题统计，但形状会随纬度变形。
- 阿尔伯斯等面积圆锥投影：双标准纬线圆锥等面积投影，常用于中纬度东西向区域的面积表达。

## 10. 代码实施分阶段计划

确认后建议按以下阶段实现，降低风险。

### 阶段一：状态模型和投影配置重构

- 调整 `mapMath.js` 的 `PROJECTION_CONFIG`，从当前多变体结构改为三大类乘三性质。
- 新增统一参数对象，例如：
  - `projectionFamily`
  - `projectionMode`
  - `centralMeridian`
  - `projectionCenterLon`
  - `projectionCenterLat`
  - `latitudeOfOrigin`
  - `standardParallel`
  - `standardParallel1`
  - `standardParallel2`
  - `standardCircleDistance`
  - `aspect`
  - `showIndicatrix`
- 保留参数归一化函数，避免非法标准纬线、异半球圆锥标准纬线等情况。

### 阶段二：页面布局重构

- 将 `App.vue` 中 `.lesson-sidebar` 改为顶部固定投影类型栏。
- 建立主区域：左侧 `Scene3D`，右侧 `Map2D`。
- 将参数面板从 `Map2D.vue` 中拆出或逻辑上上移到 `App.vue` 管理。
- 建议新增组件：
  - `ProjectionTopBar.vue`
  - `ProjectionParameterPanel.vue`
  - `ProjectionInfoPanel.vue`

### 阶段三：二维精确投影实现

- 更新 `Map2D.vue`，让它只负责二维 SVG 地图、经纬网、标准线、变形椭圆、投影说明。
- 增加或修正以下 D3 投影：
  - `geoMercator`
  - Lambert Cylindrical Equal-Area 自定义 raw
  - `geoEquirectangular`
  - `geoConicConformal`
  - `geoConicEqualArea`
  - `geoConicEquidistant`
  - `geoStereographic`
  - `geoAzimuthalEqualArea`
  - `geoOrthographic`
- 加入统一裁切和 fit 逻辑。

### 阶段四：三维示意引擎简化

- 在 `threeApp.js` 中移除三维拖拽反向改参数的路径。
- 保留 OrbitControls 观察视角。
- 重做承影面几何：
  - 圆柱：正轴/横轴圆柱，半径随标准纬线变化。
  - 平面：平面法线随投影中心变化，距离随标准圈角距变化。
  - 圆锥：圆锥形状随双标准纬线变化。
- 投影到承影面的大陆轮廓使用示意算法，目标是稳定清晰，不追求与二维精确投影重合。
- 动画改为可重复播放的单向演示。

### 阶段五：变形椭圆和投影说明

- 实现 Tissot Indicatrix 开关。
- 写入九个投影模式的历史、用途、变形说明。
- 对显示拥挤情况做自动隐藏或采样点减少。

### 阶段六：测试与验收

- 更新 `scripts/test-map-math.js`，覆盖新增三种模式和参数归一化。
- 运行 `npm run test:math`。
- 运行 `npm run build`。
- 启动本地页面，用浏览器检查：
  - 顶部栏固定。
  - 三维/二维同屏。
  - 参数变化能同时反馈到两个展示区。
  - 三维区不能反向改参数。
  - 九种二维投影能正确切换。
  - 变形椭圆开关表现稳定。

## 11. 需要确认的设计取舍

目前我建议采用以下默认取舍，请确认：

1. 平面/方位投影的“常用/妥协”模式选择正射投影 Orthographic，而不是心射投影 Gnomonic。原因是正射最符合“太空视角、直观常用”的教学目标；心射投影作为三维点光源示意保留在三维区逻辑中。
2. 三维区的承影面投影图像明确标注为“示意投影”，二维区才是精确投影结果。
3. 参数面板从 `Map2D.vue` 中分离出来，由 `App.vue` 统一管理，这样更符合“参数是 3D 与 2D 的桥梁”。
4. 方位投影二维区默认裁切到投影中心所在半球，以配合教学表述“只投平面所在半球”。
5. 变形椭圆默认关闭，由用户手动开启；无法稳定计算时自动隐藏。

确认这些取舍后，即可开始代码修改。
