export const TOUR_STORAGE_KEY = 'map-projection-intro-v1';

export function isTourDismissed(storage) {
  try {
    const value = JSON.parse(storage?.getItem(TOUR_STORAGE_KEY) ?? 'null');
    return value?.version === 1 && value.dismissed === true;
  } catch {
    return false;
  }
}

export function saveTourPreference(storage, dismissed) {
  try {
    if (!storage) return false;
    if (dismissed) storage.setItem(TOUR_STORAGE_KEY, JSON.stringify({ version: 1, dismissed: true }));
    else storage.removeItem(TOUR_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

const clipRect = (rect, width, height, padding = 0) => {
  const x = Math.max(0, rect.x - padding);
  const y = Math.max(0, rect.y - padding);
  const right = Math.min(width, rect.x + rect.width + padding);
  const bottom = Math.min(height, rect.y + rect.height + padding);
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null;
};

// Partition the backdrop around the real DOM targets, including a two-view spotlight.
export function backdropTiles(width, height, holes) {
  const xs = [...new Set([0, width, ...holes.flatMap(r => [r.x, r.x + r.width])])].sort((a, b) => a - b);
  const ys = [...new Set([0, height, ...holes.flatMap(r => [r.y, r.y + r.height])])].sort((a, b) => a - b);
  const tiles = [];
  for (let j = 0; j < ys.length - 1; j++) {
    let run = null;
    for (let i = 0; i < xs.length - 1; i++) {
      const x = (xs[i] + xs[i + 1]) / 2;
      const y = (ys[j] + ys[j + 1]) / 2;
      const inside = holes.some(r => x > r.x && x < r.x + r.width && y > r.y && y < r.y + r.height);
      if (inside) { run = null; continue; }
      if (run) run.width = xs[i + 1] - run.x;
      else {
        run = { x: xs[i], y: ys[j], width: xs[i + 1] - xs[i], height: ys[j + 1] - ys[j] };
        tiles.push(run);
      }
    }
  }
  return tiles;
}

export function tourLayout(width, height, targets) {
  let holes = targets.map(r => clipRect(r, width, height, 4)).filter(Boolean);
  let panel;
  const occupied = holes.map(r => [r.x, r.x + r.width]).sort((a, b) => a[0] - b[0]);
  const gaps = [];
  let cursor = 0;
  for (const [left, right] of occupied) {
    if (left > cursor) gaps.push([cursor, left]);
    cursor = Math.max(cursor, right);
  }
  if (cursor < width) gaps.push([cursor, width]);
  const gap = gaps.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0];
  if (gap && gap[1] - gap[0] >= 284) {
    const panelWidth = Math.min(400, gap[1] - gap[0] - 24);
    const panelHeight = Math.min(560, height - 24);
    panel = { x: (gap[0] + gap[1] - panelWidth) / 2, y: (height - panelHeight) / 2, width: panelWidth, height: panelHeight };
  } else if (height < 480) {
    const panelWidth = Math.min(480, width - 24);
    panel = { x: (width - panelWidth) / 2, y: 12, width: panelWidth, height: height - 24 };
    holes = [];
  } else {
    const panelHeight = Math.min(460, height * 0.54);
    panel = { x: 12, y: height - panelHeight - 12, width: width - 24, height: panelHeight };
    holes = holes.map(r => clipRect(r, width, panel.y - 12)).filter(Boolean);
  }
  return { holes, panel, tiles: backdropTiles(width, height, holes) };
}

export const TOUR_STEPS = [
  { title: '同一地球，两种表达', kicker: '球面与地图', targets: ['scene', 'map'], kind: 'overview' },
  { title: '蓝线与红线，谁对应谁？', kicker: '标准线与交圈', targets: ['scene', 'legend'], kind: 'lines' },
  { title: '箭头不一定是光线', kicker: '几何与数学', targets: ['scene'], kind: 'mapping' },
  { title: '小圆为什么变成椭圆？', kicker: '局部变形', targets: ['indicatrices', 'layers'], kind: 'distortion' },
  { title: '参数改变了什么？', kicker: '坐标与辅助面', targets: ['parameters'], kind: 'parameters' }
];
