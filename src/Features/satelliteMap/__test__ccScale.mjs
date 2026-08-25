// Node replay test for the LAMBERT_CC capture geometry.
// Run: node src/Features/satelliteMap/__test__ccScale.mjs
//
// Independent checks (no proj4 in the reference side):
//  1. proj4 LCC forward vs a hand-coded Snyder ellipsoidal LCC (2SP).
//  2. scale factor k vs Snyder analytic k, and |k−1| ≤ 1e-4 in-zone.
//  3. meterByPx × width vs the Vincenty geodesic length of the top edge.
//  4. Height rounding yields an exact bbox/pixel aspect.
//  5. Optional live WMS probe (EPSG:3949, 64×64) — skipped offline.

import proj4 from "proj4";
import {
  getCcZoneEpsg,
  projectToCc,
  getCcScaleFactor,
  getCcCaptureGeometry,
} from "./utils/ccProjection.js";

const A = 6378137;
const F = 1 / 298.257222101; // GRS80
const E2 = 2 * F - F * F;
const E = Math.sqrt(E2);
const rad = (d) => (d * Math.PI) / 180;

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
  if (!ok) failures += 1;
}

// --- Snyder LCC 2SP (Map Projections: A Working Manual, eq. 15-1..15-9) ---
function snyderLcc(zone) {
  const phi0 = rad(zone),
    phi1 = rad(zone - 0.75),
    phi2 = rad(zone + 0.75);
  const lam0 = rad(3),
    x0 = 1700000,
    y0 = (zone - 41) * 1e6 + 200000;
  const m = (p) => Math.cos(p) / Math.sqrt(1 - E2 * Math.sin(p) ** 2);
  const t = (p) =>
    Math.tan(Math.PI / 4 - p / 2) /
    Math.pow((1 - E * Math.sin(p)) / (1 + E * Math.sin(p)), E / 2);
  const n = Math.log(m(phi1) / m(phi2)) / Math.log(t(phi1) / t(phi2));
  const Fc = m(phi1) / (n * Math.pow(t(phi1), n));
  const rho = (p) => A * Fc * Math.pow(t(p), n);
  const rho0 = rho(phi0);
  return {
    forward(lat, lng) {
      const p = rad(lat),
        th = n * (rad(lng) - lam0),
        r = rho(p);
      return { x: x0 + r * Math.sin(th), y: y0 + rho0 - r * Math.cos(th) };
    },
    k(lat) {
      const p = rad(lat);
      return (n * rho(p)) / (A * m(p)); // Snyder 15-4 (ellipsoidal)
    },
  };
}

// --- Vincenty inverse (geodesic distance on GRS80) ---
function vincenty(lat1, lon1, lat2, lon2) {
  const b = A * (1 - F),
    L = rad(lon2 - lon1);
  const U1 = Math.atan((1 - F) * Math.tan(rad(lat1)));
  const U2 = Math.atan((1 - F) * Math.tan(rad(lat2)));
  const sU1 = Math.sin(U1),
    cU1 = Math.cos(U1),
    sU2 = Math.sin(U2),
    cU2 = Math.cos(U2);
  let lam = L,
    lamP,
    iter = 0,
    sinS,
    cosS,
    sig,
    sinA,
    cos2A,
    cos2SM;
  do {
    const sL = Math.sin(lam),
      cL = Math.cos(lam);
    sinS = Math.hypot(cU2 * sL, cU1 * sU2 - sU1 * cU2 * cL);
    if (sinS === 0) return 0;
    cosS = sU1 * sU2 + cU1 * cU2 * cL;
    sig = Math.atan2(sinS, cosS);
    sinA = (cU1 * cU2 * sL) / sinS;
    cos2A = 1 - sinA * sinA;
    cos2SM = cos2A ? cosS - (2 * sU1 * sU2) / cos2A : 0;
    const C = (F / 16) * cos2A * (4 + F * (4 - 3 * cos2A));
    lamP = lam;
    lam =
      L +
      (1 - C) *
        F *
        sinA *
        (sig + C * sinS * (cos2SM + C * cosS * (-1 + 2 * cos2SM ** 2)));
  } while (Math.abs(lam - lamP) > 1e-12 && ++iter < 200);
  const u2 = (cos2A * (A * A - b * b)) / (b * b);
  const Aa = 1 + (u2 / 16384) * (4096 + u2 * (-768 + u2 * (320 - 175 * u2)));
  const B = (u2 / 1024) * (256 + u2 * (-128 + u2 * (74 - 47 * u2)));
  const dS =
    B *
    sinS *
    (cos2SM +
      (B / 4) *
        (cosS * (-1 + 2 * cos2SM ** 2) -
          (B / 6) * cos2SM * (-3 + 4 * sinS ** 2) * (-3 + 4 * cos2SM ** 2)));
  return b * Aa * (sig - dS);
}

// ---------------------------------------------------------------- tests
const samples = [
  { name: "Paris", lat: 48.8566, lng: 2.3522 },
  { name: "Marseille", lat: 43.2965, lng: 5.3698 },
  { name: "Brest", lat: 48.3904, lng: -4.4861 },
  { name: "Strasbourg", lat: 48.5734, lng: 7.7521 },
  { name: "Lille", lat: 50.6292, lng: 3.0573 },
  { name: "Perpignan", lat: 42.6887, lng: 2.8948 },
];

for (const s of samples) {
  const epsg = getCcZoneEpsg(s.lat);
  const zone = Number(epsg.slice(-2));
  const ref = snyderLcc(zone);
  const p = projectToCc(epsg, s);
  const q = ref.forward(s.lat, s.lng);
  const dxy = Math.hypot(p.x - q.x, p.y - q.y);
  check(
    `${s.name} ${epsg} forward == Snyder`,
    dxy < 0.001,
    `Δ=${dxy.toExponential(2)} m  (${p.x.toFixed(3)}, ${p.y.toFixed(3)})`
  );

  const k = getCcScaleFactor(epsg, s);
  const kRef = ref.k(s.lat);
  check(
    `${s.name} k == Snyder k`,
    Math.abs(k - kRef) < 1e-9,
    `k=${k.toFixed(9)} ref=${kRef.toFixed(9)}`
  );
  check(
    `${s.name} |k−1| ≤ 1e-4`,
    Math.abs(k - 1) <= 1e-4,
    `k−1=${(k - 1).toExponential(2)}`
  );
}

// Synthetic viewport ~ zoom 20, 1600×900 CSS px at Paris (Mercator res 0.149 m/px)
for (const s of samples) {
  const res3857 = 0.1493; // m (mercator units) per CSS px at z20
  const halfW = (1600 / 2) * res3857,
    halfH = (900 / 2) * res3857;
  const cx = ((s.lng * Math.PI) / 180) * A,
    cy = A * Math.log(Math.tan(Math.PI / 4 + rad(s.lat) / 2));
  const toLL = (x, y) => ({
    lng: ((x / A) * 180) / Math.PI,
    lat: ((2 * Math.atan(Math.exp(y / A)) - Math.PI / 2) * 180) / Math.PI,
  });
  const nw = toLL(cx - halfW, cy + halfH),
    ne = toLL(cx + halfW, cy + halfH);
  const se = toLL(cx + halfW, cy - halfH),
    sw = toLL(cx - halfW, cy - halfH);
  const center = toLL(cx, cy);

  const g = getCcCaptureGeometry({
    corners: [nw, ne, se, sw],
    center,
    width: 2048,
  });
  const bboxW = g.bbox.maxx - g.bbox.minx,
    bboxH = g.bbox.maxy - g.bbox.miny;
  check(
    `${s.name} exact aspect`,
    Math.abs(bboxW / bboxH - g.width / g.height) < 1e-9,
    `${g.width}x${g.height}`
  );

  // Ground width of the image = bboxW / k. Compare with the geodesic length
  // between the unprojected top corners of the bbox (Vincenty, independent).
  const tl = proj4(g.epsg, "EPSG:4326", [g.bbox.minx, g.bbox.maxy]);
  const tr = proj4(g.epsg, "EPSG:4326", [g.bbox.maxx, g.bbox.maxy]);
  const geod = vincenty(tl[1], tl[0], tr[1], tr[0]);
  const groundW = g.meterByPx * g.width;
  const rel = Math.abs(groundW - geod) / geod;
  check(
    `${s.name} meterByPx·W == Vincenty top edge`,
    rel < 1e-6,
    `rel=${rel.toExponential(2)}  W=${groundW.toFixed(4)} m  meterByPx=${g.meterByPx.toFixed(6)}`
  );

  // Show what the legacy Mercator/haversine formula would have given.
  const R = 6378137;
  const hav = (a, b) => {
    const dLat = rad(b.lat - a.lat),
      dLon = rad(b.lng - a.lng);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  };
  const legacy = hav(nw, ne) / 2048;
  const geodLegacy = vincenty(nw.lat, nw.lng, ne.lat, ne.lng);
  console.log(
    `      legacy haversine bias vs geodesic at ${s.name}: ${(((hav(nw, ne) - geodLegacy) / geodLegacy) * 100).toFixed(3)} %  (legacy meterByPx=${legacy.toFixed(6)})`
  );
}

// Optional live probe
try {
  const epsg = "EPSG:3949";
  const c = projectToCc(epsg, { lat: 48.8566, lng: 2.3522 });
  const bbox = `${c.x - 50},${c.y - 50},${c.x + 50},${c.y + 50}`;
  const url = `https://data.geopf.fr/wms-r/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=ORTHOIMAGERY.ORTHOPHOTOS&STYLES=&CRS=${epsg}&BBOX=${bbox}&WIDTH=64&HEIGHT=64&FORMAT=image/png`;
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const ct = r.headers.get("content-type") ?? "";
  check(
    "live WMS GetMap EPSG:3949 returns image",
    r.ok && ct.startsWith("image/"),
    `${r.status} ${ct}`
  );
} catch (e) {
  console.log("SKIP  live WMS probe (offline?)", e.message);
}

console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL PASS");
process.exit(failures ? 1 : 0);
