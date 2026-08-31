window.onerror = (msg, src, line, col, err) => {
  document.title = 'JS ERROR: ' + msg;
  console.error('onerror:', msg, src, line, col, err?.stack);
};
window.onunhandledrejection = (e) => {
  document.title = 'PROMISE ERROR: ' + e.reason;
  console.error('unhandledrejection:', e.reason);
};

fetch('style.json')
  .then(r => r.json())
  .then(style => {
    const map = new maplibregl.Map({
      container: 'map',
      style,
      hash: 'hash',
      center: [141.35889, 42.71694], // 風不死岳 (支笏湖畔、千歳市) -- recentered from 函館山・五稜郭, mapterhorn-japan-bridge DECISIONS.md D87
      zoom: 13,
      pitch: 50,
      maxPitch: 85,
      // bvmap のラベルは NotoSansJP/NotoSerifJP のグリフを参照するが、
      // CJK文字はブラウザのシステム sans-serif フォントで描画させる
      localIdeographFontFamily: 'sans-serif'
    });
    window.map = map;
    map.on('error', (e) => console.error('map error:', e.error?.message || e));
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.ScaleControl(), 'bottom-left');
    map.addControl(new maplibregl.TerrainControl({ source: 'mapterhorn', exaggeration: 1 }), 'top-right');

    const terrainToggle = document.getElementById('terrain-toggle');
    terrainToggle.addEventListener('change', () => {
      map.setTerrain(terrainToggle.checked ? { source: 'mapterhorn', exaggeration: 1 } : null);
    });
    map.on('terrain', () => {
      terrainToggle.checked = !!map.getTerrain();
    });
    // 3D on by default (mapterhorn-japan-bridge DECISIONS.md D92) -- wait
    // for 'load' so the 'mapterhorn' raster-dem source is actually ready;
    // the 'terrain' listener above then syncs the checkbox to match.
    map.on('load', () => {
      map.setTerrain({ source: 'mapterhorn', exaggeration: 1 });
    });
  });
