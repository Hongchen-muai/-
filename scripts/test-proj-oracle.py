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
    ("equalEarth", "equalArea", "eqearth", {}, {}),
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
for lon0 in [-180, -90, 0, 110, 180]:
    oracle = Proj(proj="eqearth", R=1, lon_0=lon0)
    for name, lon, lat in ANCHORS + [("East dateline", 179.99, 30), ("West dateline", -179.99, -30), ("Near north pole", 20, 89.99), ("Near south pole", -30, -89.99)]:
        x, y = oracle(lon, lat)
        payload.append(["equalEarth", "equalArea", {"centralMeridian": lon0}, [lon, lat]])
        expected.append((f"eqearth/{lon0}/{name}", x, y))
# PROJ's general oblique rotation uses the old north pole expressed in the
# new frame, plus the longitude opposite the new pole. Derive these from an
# independent geographic tangent basis, not the app's Euler angles.
for lonc, latc, azimuth in [(110, 35, 60), (-75, -30, 120), (20, 0, 35), (170, 60, 160)]:
    lon, lat, alpha = map(math.radians, (lonc, latc, azimuth))
    c = (math.cos(lat) * math.cos(lon), math.cos(lat) * math.sin(lon), math.sin(lat))
    e = (-math.sin(lon), math.cos(lon), 0)
    n = (-math.sin(lat) * math.cos(lon), -math.sin(lat) * math.sin(lon), math.cos(lat))
    t = tuple(math.sin(alpha) * east + math.cos(alpha) * north for east, north in zip(e, n))
    pole = (c[1] * t[2] - c[2] * t[1], c[2] * t[0] - c[0] * t[2], c[0] * t[1] - c[1] * t[0])
    rotation = {"o_lat_p": math.degrees(math.asin(pole[2])), "o_lon_p": math.degrees(math.atan2(t[2], c[2])), "lon_0": math.degrees(math.atan2(pole[1], pole[0])) - 180}
    beta = math.pi / 2 - alpha
    for mode, projection in [("conformal", "merc"), ("equalArea", "cea"), ("compromise", "eqc")]:
        for standard in [0, 30, 75]:
            params = {"aspect": "oblique", "obliqueCenterLon": lonc, "obliqueCenterLat": latc, "obliqueAzimuth": azimuth, "standardParallel": standard}
            oracle = Proj(proj="ob_tran", o_proj=projection, R=1, lat_ts=standard, **rotation)
            for name, longitude, latitude in ANCHORS:
                u, v = oracle(longitude, latitude)
                x, y = math.cos(beta) * u - math.sin(beta) * v, math.sin(beta) * u + math.cos(beta) * v
                payload.append(["cylinder", mode, params, [longitude, latitude]])
                expected.append((f"ob_tran/{projection}/{lonc}/{latc}/{azimuth}/{standard}/{name}", x, y))
            if mode == "conformal":
                # Use the equivalent undirected bearing in Hotine's principal
                # azimuth interval; ob_tran above checks the full input angle.
                hotine_alpha = (azimuth + 90) % 180 - 90
                hotine = Proj(proj="omerc", R=1, lonc=lonc, lat_0=latc, alpha=hotine_alpha, k_0=math.cos(math.radians(standard)))
                for longitude, latitude in [(lonc, latc), (lonc + 5, latc + 3)]:
                    x, y = hotine(longitude, latitude)
                    payload.append(["cylinder", mode, params, [longitude, latitude]])
                    expected.append((f"omerc/{lonc}/{latc}/{azimuth}/{standard}", x, y))

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
