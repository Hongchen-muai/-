import { getProjectionTeaching } from '../core/projectionTeaching.js';

export function projectionHelp(family, mode, params = {}) {
  const teaching = getProjectionTeaching(family, mode, params);
  const parallel = family === 'equalEarth'
    ? '固定真比例纬线约为南北纬 40.38°，由平等地球公式决定，不是辅助平面与球面的交圈。'
    : '标准纬线表示沿该纬线方向的长度比例为 1，不表示所有方向或所有位置都没有变形。';
  const standard = family === 'planar'
    ? '蓝圈是辅助平面与球面的交圈，红圈是它的投影。除球面立体投影的真比例交圈外，不能把交圈一般地理解为无变形圈。'
    : parallel + (['transverse', 'oblique'].includes(params.aspect) && family === 'cylinder' ? '横轴或斜轴情况下，它属于旋转后的轴向坐标，不是地理纬线。' : '');
  return {
    centralMeridian: '中央经线决定地图的经度中心，背面的经线是切缝。它改变地理位置相对投影的朝向，不是旋转观察相机。',
    projectionCenterLon: '投影中心的经度。方位投影围绕中心组织方向与径向距离，与中心纬度共同确定球面上的中心位置。',
    projectionCenterLat: '投影中心的纬度。0° 为赤道中心，±90° 为极区中心；这决定投影朝向，而不是相机视角。',
    latitudeOfOrigin: '圆锥投影的纵坐标原点纬度，只改变 y 坐标零点。它不旋转球体，也不改变圆锥与球面的空间关系。',
    aspect: '正轴的投影轴与地球极轴一致；横轴与其垂直；斜轴用中央线上的基点及该点的方位角定位。它们先变换球面坐标，不是简单旋转已经画好的地图。',
    obliqueCenterLon: '中心点 C 的经度。相切时 C 位于圆柱接触球面的中央线大圆上；经纬度和方位角共同确定该大圆。此参数只用于斜轴，不覆盖正轴、横轴的中央经线。',
    obliqueCenterLat: '中心点 C 的纬度，也是中央线的基点纬度。相切接触是一条大圆，不是孤立切点；相割时 C 仍是参考点，但不位于圆柱与球面的交线上。',
    obliqueAzimuth: '中央线在 C 点的方向，从当地北向顺时针量取：0° 为北向，90° 为东向。仅有经纬度无法唯一确定圆柱轴向。极点处采用沿所填中心经线逼近时的局部方向约定。',
    standardParallel: parallel + '圆柱半径随 cos φₛ 改变；不同投影的纵向公式不同，因此地图的变化也不同。',
    standardParallel1: '第一条标准纬线，与第二条一起决定圆锥常数和径向函数。沿标准纬线的长度比例为 1；两参数相等时采用单标准纬线形式。',
    standardParallel2: '第二条标准纬线。它与第一条共同约束投影比例，不是控制观察角度；改变参数可能改变圆锥开口与地图形状。',
    standardCircleDistance: mode === 'conformal'
      ? '交圈角距是交圈到投影中心的球面角距离。0° 时辅助平面相切；增大时平面靠近球心，球面立体投影随之统一缩放，仍保持等角。'
      : '交圈角距决定辅助平面的位置，0° 时相切。等面积方位与正射投影的数学 x、y 坐标不因平面前后移动而改变；交圈不是真比例圈。',
    radius: 'R 为球面模型的地球半径。参数框使用度；公式中的经纬度与三角函数使用相应弧度。',
    surface: teaching.surface,
    rays: teaching.mapping,
    source: family === 'cylinder' ? 'O 是球心几何参考点，不是圆柱等角、等面积或等距投影的真实光源。' : 'O 是投影中心的对跖点视点，球面立体投影的透视射线由此出发。',
    projectedImage: '球面地理位置按当前投影公式得到的地图轮廓。三维辅助面上的落点与二维地图使用同一组数学坐标。',
    graticule: '经纬网由经线与纬线组成。其形状、间距和夹角反映投影变形；三维观察角度会另外带来视觉压缩。',
    standard,
    blue: '蓝色表示球面上的原位置。' + standard,
    red: '红色表示蓝色球面线的投影位置。两者对应同一组地点，但在三维空间不必重合。' + standard,
    correction: family === 'cylinder' ? 'G → M 表示从几何交点到实际数学投影点的修正，是数学坐标变换，不是折射或弯曲光线。' : 'P → M 表示同一地理位置从球面到数学平面的对应，不表示统一点光源的光线。',
    indicatrix: '相同大小的微小球面圆对应一阶变形椭圆。等角时微小圆仍为圆，等面积时面积比例保持一致；三维斜视造成的变扁不属于投影变形。',
    viewScale: '这里是显示倍率，不是投影的数学比例或制图比例尺。二维显示放大不改变投影公式与三维相机。',
    conformal: '等角保持局部角度与微小形状，不保持全球面积或任意两点间距离。',
    equalArea: '等面积保持地区之间的面积比例，允许形状、角度和长度发生变化。',
    compromise: family === 'planar' ? '此处为正射投影：采用平行投影，既非等角也非等面积，半球边缘径向压缩明显。'
      : `此处为等距投影：沿${family === 'cylinder' && params.aspect === 'oblique' ? '轴向' : ''}经线以及标准纬线的长度比例为 1，不保持任意方向或任意两点间的距离，也不是等角或等面积投影。`,
    notation: teaching.notation
  };
}

export function annotationHelp(text, family) {
  const symbols = {
    C: 'C：斜轴中央线的基点，投影坐标为 (0, 0)。相切时位于切线大圆上；相割时仅作参考，不是圆柱与球面的几何交点。',
    O: family === 'cylinder' ? 'O：球心几何参考点，不是该圆柱投影的真实光源。' : 'O：投影中心的对跖点视点，球面立体投影的射线由此出发。',
    P: 'P：球面地理点，与 M 对应同一经纬度位置。',
    G: 'G：直线 OP 与辅助圆柱的几何交点，仅作参考，不是最终数学投影。相割时 G 也可能位于 O 与 P 之间。',
    M: 'M：按当前投影公式计算的实际落点，与二维地图中的同一地点对应。'
  };
  if (/^[OPGMC](=[OPGMC])*$/.test(text)) return text.split('=').map(key => symbols[key]).join('\n')
    + (text.includes('=') ? '\n等号表示这些点在当前参数下位置重合。' : '');
  return 'φ 表示纬度，横轴或斜轴情况下表示轴向纬度；c 表示距投影中心的球面角距。P 为用于说明映射关系的球面示例点。';
}

export function placeHelp(anchor, size, viewport) {
  const margin = 12, gap = 10;
  const width = Math.min(size.width, viewport.width - margin * 2);
  const height = Math.min(size.height, viewport.height - margin * 2);
  let x, y;
  if (anchor.right + gap + width <= viewport.width - margin) {
    x = anchor.right + gap; y = anchor.top;
  } else if (anchor.left - gap - width >= margin) {
    x = anchor.left - gap - width; y = anchor.top;
  } else {
    x = (anchor.left + anchor.right - width) / 2;
    y = anchor.bottom + gap + height <= viewport.height - margin ? anchor.bottom + gap : anchor.top - gap - height;
  }
  return { x: Math.max(margin, Math.min(viewport.width - margin - width, x)), y: Math.max(margin, Math.min(viewport.height - margin - height, y)) };
}
