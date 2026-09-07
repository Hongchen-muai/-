"""Independent sphere-coordinate oracle. Requires pyproj; not a runtime dependency."""
import json
import math
import subprocess
from pathlib import Path
from pyproj import Proj

ROOT = Path(__file__).resolve().parents[1]
CASES = [
    ("cylinder", "conformal", "merc", {"lat_ts": 30}, {"standardParallel": 30}),
    ("cylinder", "equalArea", "cea", {"lat_ts": 30}, {"standardParallel": 30}),
    ("cylinder", "compromise", "eqc", {"lat_ts": 30}, {"standardParallel": 30}),
    ("planar", "conformal", "stere", {"lat_0": 35}, {"projectionCenterLat": 35}),
    ("planar", "equalArea", "laea", {"lat_0": 35}, {"projectionCenterLat": 35}),
    ("planar", "compromise", "ortho", {"lat_0": 35}, {"projectionCenterLat": 35}),
    ("conic", "conformal", "lcc", {"lat_1": 25, "lat_2": 47, "lat_0": 35}, {"latitudeOfOrigin": 35}),
    ("conic", "equalArea", "aea", {"lat_1": 25, "lat_2": 47, "lat_0": 35}, {"latitudeOfOrigin": 35}),
    ("conic", "compromise", "eqdc", {"lat_1": 25, "lat_2": 47, "lat_0": 35}, {"latitudeOfOrigin": 35}),
    ("cylinder", "conformal", "tmerc", {"k_0": 1}, {"aspect": "transverse"}),
    ("cylinder", "equalArea", "tcea", {"k_0": 1}, {"aspect": "transverse"}),
    ("cylinder", "compromise", "cass", {}, {"aspect": "transverse"}),
]
ANCHORS = [
    ("Beijing", 116.4, 39.9), ("Madagascar", 47.5, -18.9),
    ("Sahara", 15, 25), ("Amazon", -60, -3), ("Greenland", -42, 72),
    ("Cape of Good Hope", 18.5, -34.4), ("Sydney", 151.2, -33.9),
]
payload = []
expected = []
for family, mode, proj, proj_params, params in CASES:
    for name, lon, lat in ANCHORS:
        # Center at the anchor's meridian, with a 15-degree eastward separation.
        lon0 = lon - 15
        oracle = Proj(proj=proj, R=1, lon_0=lon0, **proj_params)
        x, y = oracle(lon, lat)
        if not math.isfinite(x + y):
            continue
        payload.append([family, mode, {**params, "centralMeridian": lon0, "projectionCenterLon": lon0}, [lon, lat]])
        expected.append((f"{proj}/{name}", x, y))
js = """
import {createProjectionModel} from './src/core/projectionModel.js';
let input=''; for await (const chunk of process.stdin) input+=chunk;
console.log(JSON.stringify(JSON.parse(input).map(([f,m,p,c])=>createProjectionModel(f,m,p).projection(c))));
"""
result = subprocess.run(["node", "--input-type=module", "-e", js], input=json.dumps(payload), text=True, capture_output=True, check=True, cwd=ROOT)
actual = json.loads(result.stdout)
worst = 0
for (label, x, y), (ax, ay) in zip(expected, actual):
    error = math.hypot(ax - x, ay + y)
    worst = max(worst, error)
    assert error < 1e-8, f"{label}: model ({ax}, {-ay}) != PROJ ({x}, {y}); error={error}"
print(f"PROJ oracle: {len(expected)} named geographic anchors passed; max error {worst:.3g} R.")
