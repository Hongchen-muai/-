import { cylindricalStandardComparison } from './projectionModel.js';
import { EQUAL_EARTH_STANDARD_PARALLEL } from './mapMath.js';

export const getProjectionTeaching = (family, mode, params) => {
  if (family === 'equalEarth') return {
    formula: 'sin θ = (√3/2) sin φ；y = R f(θ)；x = 2Rλ cos θ / [√3 f′(θ)]',
    notation: 'λ 为相对中央经线的经差，φ 为纬度，θ 为参数纬度，均以弧度代入。f(θ) = A₁θ + A₂θ³ + A₃θ⁷ + A₄θ⁹；A₁ = 1.340264，A₂ = −0.081106，A₃ = 0.000893，A₄ = 0.003796。',
    mapping: '先由参数纬度 θ 的多项式确定纬线的纵向位置，再按面积守恒确定横向间距，使 ∂x/∂λ · ∂y/∂φ = R² cos φ。P 到 M 的虚线是坐标对应，不是光线；只有完成后的投影保证等面积，过渡帧不代表另一种等面积投影。',
    surface: '伪圆柱表示经纬网的类型，不是可展开的物理圆柱。纬线为直线且间距不等，同一纬线上经线等间隔，中央经线为直线。后方平面仅承载数学坐标，其深度不属于投影参数。',
    flat: '平面由空间位置移到正视位置，x、y 坐标不再变化。南北极各自展开为一段极线，边缘形状仍会变形，不能将等面积理解为无变形。',
    standardNote: `蓝红线对应纬度约 ±${EQUAL_EARTH_STANDARD_PARALLEL.toFixed(2)}°。纬线方向长度比例为 1，由固定公式决定，不是平面与球面的交圈，也不保证所有方向的长度或角度不变。`,
    rays: '坐标映射连线', rayEnglish: 'Mathematical Mapping', source: false
  };
  if (family === 'cylinder') {
    const common = params.aspect === 'transverse' ? 'λ、φ 为旋转后的轴向经纬度；展开后恢复北向朝上。' : 'λ 为相对中央经线的经差，φ 为纬度，k₀ = cos φₛ。';
    const line = cylindricalStandardComparison(mode, params);
    const construction = {
      rays: '几何参考与数学修正', rayEnglish: 'Reference / Correction', source: true,
      sourceLabel: '球心参考点 O', sourceEnglish: 'Geometric Reference',
      geometry: '圆柱半径 r = R cos φₛ。O 是球心几何参考点，不是该投影的真实光源。实线经过球面点 P，与圆柱相交于 G，得到 r tan φ。相割时 G 可能在 O 与 P 之间，不能一律理解为先经过球面再到辅助面。',
      standardNote: line.latitude === 0 ? '赤道处，球面标准线与它的投影重合。蓝色表示原纬线，红色表示投影线，不是两个不同的纬度。'
        : `北侧 ${line.latitude}° 标准线：球面线的轴向坐标为 ${line.sphere.toFixed(3)} R，投影线为 ${line.mapped.toFixed(3)} R。它们是同一条纬线的两个空间位置，不必重合。`
    };
    if (mode === 'conformal') return {
      formula: 'x = Rk₀λ；y = Rk₀ ln tan(π/4 + φ/2)',
      mapping: 'G 只是几何对照。真正的落点 M 用对数等距纬度确定高度，使经、纬方向的局部比例相等。橙色虚线 G 到 M 是数学修正，不是折射或弯曲的光线。',
      surface: '蓝线位于球面，红线表示同一纬线的投影。辅助圆柱半径 Rk₀；标准线的“比例为 1”不要求两个空间圆重合。',
      notation: common, ...construction
    };
    if (mode === 'equalArea') return {
      formula: 'x = Rk₀λ；y = R sin φ / k₀',
      mapping: 'G 不是等面积投影结果。把高度改为 R sin φ / k₀ 得到 M，使两个方向的伸缩互为倒数、面积比例为 1。此处球心射线仅作几何对照，橙色虚线表示数学修正。',
      surface: '辅助圆柱半径 Rk₀。割线纬度为 0° 时是兰伯特形式，30° 为贝尔曼形式，45° 为高尔–彼得斯形式。',
      notation: common, ...construction
    };
    return {
      formula: 'x = Rk₀λ；y = Rφ',
      mapping: 'G 的高度 r tan φ 并不等距。等距圆柱把赤道到 P 的有向经线弧长 Rφ 作为 M 的高度，橙色虚线 G 到 M 就是这项数学修正；它不是光线折射，也不保持任意两点间距离。',
      surface: '标准纬线为赤道且正轴时，方格网形式称 Plate Carrée；改变割线纬度后仍属等距圆柱投影。',
      notation: common, ...construction
    };
  }
  if (family === 'planar') {
    const notation = 'c 为距投影中心的球面角距，ρ 为图上径向距离；辅助平面距球心 d = R cos cₛ。';
    if (mode === 'conformal') return {
      formula: 'ρ = (R + d) tan(c/2)',
      mapping: 'O 是投影中心的对跖点。实线穿过球面点 P，与辅助平面相交于 M，这是有真实视点的透视构造。切平面时依次为 O、P、M；相割时 M 也可能在 O 与 P 之间，箭头仍沿同一直线。',
      surface: '移动辅助平面会统一缩放图形而保持等角。此球面模型在交圈上的局部长度比例为 1；切平面时中心比例为 1。',
      notation, rays: '对跖点透视射线', source: true, sourceLabel: '对跖点视点 O', sourceEnglish: 'Perspective Center'
    };
    if (mode === 'equalArea') return {
      formula: 'ρ = 2R sin(c/2)',
      mapping: '令球面帽面积 2πR²(1 − cos c) 等于平面圆面积 πρ²，得到等面积径向函数。不存在统一点光源。',
      surface: '辅助平面前后移动不缩放数学坐标；直接乘 cos cₛ 会破坏单位面积比例。蓝圈是球面交圈，红圈是其映射，二者不必重合。',
      notation, rays: '坐标映射连线', source: false
    };
    return {
      formula: 'ρ = R sin c',
      mapping: '来自无限远处的平行射线，沿辅助平面的法线方向投影。与遥望地球的外观相同，只能表示面向中心的一侧半球。',
      surface: '平面前后移动不改变平行投影的 x、y 坐标；中心外沿径向逐渐压缩，交圈并非无变形圈。',
      notation, rays: '平行投影射线', source: false
    };
  }
  const radial = mode === 'conformal' ? 'ρ = RF / tanⁿ(π/4 + φ/2)'
    : mode === 'equalArea' ? 'ρ = R√(C − 2n sin φ) / n' : 'ρ = R(G − φ)';
  return {
    formula: `θ = nλ；${radial}`,
    mapping: mode === 'conformal' ? '选择 n 与径向函数使局部经、纬方向比例相等；标准纬线处比例为 1。这是数学映射，不是球心透视。'
      : mode === 'equalArea' ? '选择 n 与径向函数使面积比例恒为 1；标准纬线处的长度比例为 1。面积守恒不意味着轮廓无变形。'
        : 'ρ 随纬度线性变化，沿经线的长度比例为 1；两条标准纬线上的长度比例也为 1。',
    surface: '圆锥按 n 构造并沿背面母线展开。标准纬线由比例条件定义，不强称为几何交圈；原点纬度仅平移纵坐标，不旋转球体。',
    notation: 'λ 为经差，φ 为纬度；x = ρ sin θ，y = ρ₀ − ρ cos θ。F、C、G 和 n 由两条标准纬线确定；n = 0 取圆柱极限。',
    rays: '坐标映射连线', source: false
  };
};
