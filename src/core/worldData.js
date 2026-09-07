import { feature } from 'topojson-client';

let request;
export const loadWorldData = () => {
  if (!request) request = fetch(`${import.meta.env.BASE_URL}world-110m.json`)
    .then(async (response) => {
      if (!response.ok) throw new Error(`世界地图数据加载失败 (${response.status})`);
      const topology = await response.json();
      const data = feature(topology, topology.objects.land || topology.objects.countries);
      return data.type === 'FeatureCollection' ? data : { type: 'FeatureCollection', features: [data] };
    }).catch((error) => { request = null; throw error; });
  return request;
};
