import {
  transform,
  multiply,
  sampleArc,
  polylinePoints,
} from "./dxfGeometry.js";
import DxfParser from "dxf-parser";
import { decodeDxf } from "../../promptIa/utils/summarizeDxf.js";
import { DxfMtextHandler, DxfTextHandler, makeDxfText } from "./dxfText.js";
import { DxfHatchHandler, hatchPolygons } from "./dxfHatch.js";
import dimensionFallback from "./dxfDimension.js";

const SUPPORTED = new Set([
  "LINE",
  "LWPOLYLINE",
  "POLYLINE",
  "ARC",
  "CIRCLE",
  "INSERT",
  "TEXT",
  "MTEXT",
  "DIMENSION",
  "HATCH",
  "SOLID",
  "ELLIPSE",
]);
const TAU = Math.PI * 2;
const IDENTITY = [1, 0, 0, 1, 0, 0];
const MAX_OBJECTS = 25000;
const MAX_POINTS = 1000000;

function color(value) {
  // ACI white is the foreground color on a dark CAD canvas.
  const rgb = Number.isInteger(value) && value !== 0xffffff ? value : 0x202020;
  return `#${rgb.toString(16).padStart(6, "0")}`;
}

// Preserve unsupported entities in the parse tree, including inside blocks,
// so the import report counts them instead of silently dropping them.
function fallbackHandler(type) {
  return class {
    ForEntityName = type;
    parseEntity(scanner) {
      const entity = { type };
      while (!scanner.isEOF()) {
        const group = scanner.next();
        if (group.code === 0) break;
        if (group.code === 8) entity.layer = group.value;
        if (group.code === 5) entity.handle = group.value;
        if (group.code === 67) entity.inPaperSpace = Boolean(group.value);
      }
      return entity;
    }
  };
}

export default function prepareDxf(input) {
  const text = decodeDxf(input).replace(/^\uFEFF/, "");
  if (text.startsWith("AutoCAD Binary DXF"))
    throw new Error(
      "Le DXF binaire n’est pas pris en charge. Exportez un DXF ASCII."
    );
  if (!/\bSECTION\b/.test(text) || !/\bEOF\s*$/.test(text))
    throw new Error("Le fichier n’est pas un DXF ASCII complet.");
  const parser = new DxfParser();
  parser.registerEntityHandler(DxfMtextHandler);
  parser.registerEntityHandler(DxfTextHandler);
  parser.registerEntityHandler(DxfHatchHandler);
  const lines = text.split(/\r\n|\n|\r/);
  // Also retain normals that some parser handlers do not expose (CIRCLE).
  const normals = new Map();
  let section = null;
  let entity = null;
  const finish = () => {
    if (entity?.handle && entity.normal)
      normals.set(entity.handle, entity.normal);
  };
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = Number(lines[i].trim());
    const value = lines[i + 1].trim();
    if (code === 0) {
      finish();
      entity = null;
      if (value === "SECTION") section = lines[i + 3]?.trim();
      if (value === "ENDSEC") section = null;
      if (
        ["ENTITIES", "BLOCKS"].includes(section) &&
        !["SECTION", "BLOCK", "ENDBLK", "VERTEX", "SEQEND"].includes(value)
      ) {
        entity = {};
        if (!SUPPORTED.has(value))
          parser.registerEntityHandler(fallbackHandler(value));
      }
    } else if (entity) {
      if (code === 5) entity.handle = value;
      if ([210, 220, 230].includes(code)) {
        entity.normal ??= { x: 0, y: 0, z: 1 };
        entity.normal[{ 210: "x", 220: "y", 230: "z" }[code]] = Number(value);
      }
    }
  }
  const parsed = parser.parseSync(text);
  if (!parsed?.entities)
    throw new Error("Aucun espace modèle trouvé dans ce DXF.");
  const layerMap = new Map(
    Object.entries(parsed.tables?.layer?.layers ?? {}).map(([name, layer]) => [
      name,
      {
        name,
        color: color(layer.color),
        visible: layer.visible !== false && !layer.frozen,
        count: 0,
      },
    ])
  );
  const getLayer = (name) => {
    if (!layerMap.has(name))
      layerMap.set(name, { name, color: "#202020", visible: true, count: 0 });
    return layerMap.get(name);
  };
  const objects = [];
  const skipped = {};
  const warnings = {};
  let pointCount = 0;
  let visited = 0;
  let curvedCount = 0;
  const skip = (reason) => {
    skipped[reason] = (skipped[reason] ?? 0) + 1;
  };
  const warn = (reason) => {
    warnings[reason] = (warnings[reason] ?? 0) + 1;
  };
  const addObject = (object, e, layer, color, dimensionHandle) => {
    const allPoints = [object.points, ...(object.holes ?? [])].flat();
    if (
      !allPoints.length ||
      allPoints.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))
    ) {
      skip("Géométries invalides");
      return;
    }
    pointCount += allPoints.length;
    if (objects.length >= MAX_OBJECTS || pointCount > MAX_POINTS)
      throw new Error(
        "Ce DXF est trop détaillé. Importez une sélection plus petite."
      );
    objects.push({
      ...object,
      color,
      layer,
      handle: String(e.handle ?? dimensionHandle ?? ""),
      sourceType: e.type,
      ...(dimensionHandle && { dimensionHandle }),
    });
    getLayer(layer).count++;
  };
  const visit = (
    e,
    matrix = IDENTITY,
    parentLayer = "0",
    parentColor = null,
    stack = [],
    dimensionHandle = null
  ) => {
    if (++visited > MAX_OBJECTS * 4)
      throw new Error(
        "Ce DXF contient trop d’objets. Importez une sélection plus petite."
      );
    if (e.inPaperSpace) {
      skip("Espace papier");
      return;
    }
    if (e.visible === false) {
      skip("Objets invisibles");
      return;
    }
    const layerName = !e.layer || e.layer === "0" ? parentLayer : e.layer;
    const layer = getLayer(layerName);
    const entityColor =
      e.colorIndex === 0
        ? (parentColor ?? layer.color)
        : e.colorIndex === 256 || e.color == null
          ? layer.color
          : color(e.color);
    const normal = normals.get(String(e.handle)) ??
      e.extrusionDirection ?? {
        x: e.extrusionDirectionX ?? 0,
        y: e.extrusionDirectionY ?? 0,
        z: e.extrusionDirectionZ ?? 1,
      };
    if (
      Math.abs(normal.x) > 1e-9 ||
      Math.abs(normal.y) > 1e-9 ||
      Math.abs(normal.z - 1) > 1e-9
    ) {
      skip("Plans inclinés / normales inversées");
      return;
    }
    if (e.type === "DIMENSION") {
      const key = `dimension:${e.block ?? e.handle}`;
      if (stack.includes(key) || stack.length >= 16) {
        skip("Cotations récursives");
        return;
      }
      const block = parsed.blocks?.[e.block];
      const children = block?.entities?.length
        ? block.entities
        : dimensionFallback(e, parsed.header);
      if (!children) {
        skip("DIMENSION sans bloc graphique compatible");
        return;
      }
      if (!block?.entities?.length)
        warn("Cotations sans bloc : tracé simplifié");
      // Cached dimension blocks already use drawing coordinates; adding the
      // definition point as an INSERT translation would shift them twice.
      for (const child of children)
        visit(
          child,
          matrix,
          layerName,
          entityColor,
          [...stack, key],
          String(e.handle ?? key)
        );
      return;
    }
    if (e.type === "MTEXT" || e.type === "TEXT") {
      const textObject = makeDxfText(e, matrix);
      if (!textObject) {
        skip(`${e.type} vide ou alignement non pris en charge`);
        return;
      }
      if (textObject.approximated)
        warn("Textes étirés ou miroirs : mise en forme simplifiée");
      addObject(textObject, e, layerName, entityColor, dimensionHandle);
      return;
    }
    if (e.type === "HATCH") {
      if (e.hatchError) {
        skip(e.hatchError);
        return;
      }
      const rings = (e.rings ?? []).map((ring) =>
        ring.map((p) => transform(p, matrix))
      );
      for (const polygon of hatchPolygons(rings, e.hatchStyle)) {
        addObject(
          {
            ...polygon,
            kind: "POLYGON",
            closed: true,
            fillType: e.solid ? "SOLID" : "HATCHING",
            patternName: e.patternName,
          },
          e,
          layerName,
          entityColor,
          dimensionHandle
        );
      }
      if (!e.solid) warn("Motifs HATCH remplacés par des hachures diagonales");
      return;
    }
    if (e.type === "INSERT") {
      const block = parsed.blocks?.[e.name];
      if (!block || stack.includes(e.name) || stack.length >= 16) {
        skip("Blocs absents ou récursifs");
        return;
      }
      const angle = ((e.rotation ?? 0) * Math.PI) / 180;
      const c = Math.cos(angle),
        s = Math.sin(angle);
      const sx = e.xScale ?? 1,
        sy = e.yScale ?? 1;
      const origin = block.position ?? { x: 0, y: 0 };
      const pos = e.position ?? { x: 0, y: 0 };
      const rows = Math.max(1, e.rowCount ?? 1),
        columns = Math.max(1, e.columnCount ?? 1);
      if (rows * columns > MAX_OBJECTS)
        throw new Error("Ce bloc DXF contient trop de répétitions.");
      for (let row = 0; row < rows; row++)
        for (let col = 0; col < columns; col++) {
          const x = col * (e.columnSpacing ?? 0) - origin.x * sx;
          const y = row * (e.rowSpacing ?? 0) - origin.y * sy;
          const local = [
            c * sx,
            s * sx,
            -s * sy,
            c * sy,
            pos.x + c * x - s * y,
            pos.y + s * x + c * y,
          ];
          for (const child of block.entities ?? [])
            visit(
              child,
              multiply(matrix, local),
              layerName,
              entityColor,
              [...stack, e.name],
              dimensionHandle
            );
        }
      return;
    }
    let points,
      closed = false,
      curved = false,
      kind = "POLYLINE";
    if (e.type === "LINE") points = e.vertices;
    else if (e.type === "SOLID") {
      const vertices = e.points ?? [];
      points = [vertices[0], vertices[1], vertices[3], vertices[2]].filter(
        Boolean
      );
      points = points.filter(
        (p, i) => !i || p.x !== points[i - 1].x || p.y !== points[i - 1].y
      );
      closed = true;
      kind = "POLYGON";
    } else if (["LWPOLYLINE", "POLYLINE"].includes(e.type)) {
      if (
        e.is3dPolyline ||
        e.is3dPolygonMesh ||
        e.isPolyfaceMesh ||
        e.includesSplineFitVertices ||
        e.includesCurveFitVertices
      ) {
        skip("Polylignes 3D / lissées");
        return;
      }
      closed = Boolean(e.shape);
      points = polylinePoints(e.vertices ?? [], closed);
      curved = e.vertices?.some((p) => p.bulge);
    } else if (e.type === "ELLIPSE") {
      const axis = e.majorAxisEndPoint;
      if (!e.center || !axis || !(e.axisRatio > 0)) {
        skip("Ellipses invalides");
        return;
      }
      const start = e.startAngle ?? 0,
        end = e.endAngle ?? TAU;
      closed = Math.abs(end - start) >= TAU - 1e-8;
      const sweep = closed ? TAU : (((end - start) % TAU) + TAU) % TAU;
      points = sampleArc({ x: 0, y: 0 }, 1, start, sweep).map((p) => ({
        x: e.center.x + axis.x * p.x - axis.y * e.axisRatio * p.y,
        y: e.center.y + axis.y * p.x + axis.x * e.axisRatio * p.y,
      }));
      if (closed) points.pop();
      curved = true;
    } else if (e.type === "ARC" || e.type === "CIRCLE") {
      if (!e.center || !(e.radius > 0)) {
        skip("Géométries invalides");
        return;
      }
      closed = e.type === "CIRCLE";
      const start = closed ? 0 : e.startAngle;
      const sweep = closed ? TAU : (((e.endAngle - start) % TAU) + TAU) % TAU;
      points = sampleArc(e.center, e.radius, start, sweep);
      if (closed) points.pop();
      curved = true;
    } else {
      skip(e.type);
      return;
    }
    if (
      !points ||
      points.length < 2 ||
      points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))
    ) {
      skip("Géométries invalides");
      return;
    }
    // A non-planar LINE must not silently become a measured 2D segment.
    if (points.some((p) => Math.abs((p.z ?? 0) - (points[0].z ?? 0)) > 1e-9)) {
      skip("Géométries non planes");
      return;
    }
    const worldPoints = points.map((p) => transform(p, matrix));
    if (
      worldPoints.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))
    ) {
      skip("Géométries invalides");
      return;
    }
    addObject(
      {
        points: worldPoints,
        closed,
        kind,
        ...(kind === "POLYGON" && { fillType: "SOLID" }),
      },
      e,
      layerName,
      entityColor,
      dimensionHandle
    );
    if (curved) curvedCount++;
  };
  for (const entity of parsed.entities) visit(entity);
  if (!objects.length)
    throw new Error(
      `Aucune géométrie 2D compatible. Objets rencontrés : ${Object.keys(skipped).join(", ") || "aucun"}.`
    );
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const object of objects)
    for (const p of object.points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  return {
    objects,
    layers: [...layerMap.values()],
    skipped,
    warnings,
    curvedCount,
    unitCode: parsed.header?.$INSUNITS ?? 0,
    bounds: { minX, minY, maxX, maxY },
  };
}
