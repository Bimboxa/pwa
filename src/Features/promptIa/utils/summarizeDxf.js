// Pure digest of a DXF file (ASCII) for the Prompt IA `contexte.json`: what
// the external model needs to know before it opens the file — unit, extents,
// layers, inserted blocks. A plain scan of the group codes, no geometry.

// $INSUNITS → unit name and length of one drawing unit in metres.
const INSUNITS = {
  0: { name: "sans unité", meters: null },
  1: { name: "in", meters: 0.0254 },
  2: { name: "ft", meters: 0.3048 },
  4: { name: "mm", meters: 0.001 },
  5: { name: "cm", meters: 0.01 },
  6: { name: "m", meters: 1 },
  7: { name: "km", meters: 1000 },
  14: { name: "dm", meters: 0.1 },
};

const MAX_LAYERS = 200;
const MAX_BLOCKS = 80;

// AutoCAD 2007 (AC1021) and later write UTF-8, whatever $DWGCODEPAGE says;
// older files use the Windows code page.
export function getDxfEncoding(bytes) {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 4096));
  const match = head.match(/\$ACADVER\s+1\s+(AC\d{4})/);
  const version = match?.[1] ?? null;
  const utf8 = version ? Number(version.slice(2)) >= 1021 : true;
  return { version, encoding: utf8 ? "utf-8" : "windows-1252" };
}

export function decodeDxf(input) {
  if (typeof input === "string") return input;
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  return new TextDecoder(getDxfEncoding(bytes).encoding).decode(bytes);
}

const round3 = (v) => Math.round(v * 1000) / 1000;

/**
 * @param {string|ArrayBuffer|Uint8Array} input - content of the .dxf file
 * @returns {Object|null} null when the content is not an ASCII DXF
 */
export default function summarizeDxf(input) {
  const text = decodeDxf(input);
  const lines = text.split(/\r?\n/);
  if (lines.length < 4) return null;

  const header = {};
  const entitiesByType = {};
  const layers = new Map(); // name → { count, byType }
  const blocks = new Map(); // "layer|name" → { name, layer, count }
  let section = null;
  let blockCount = 0;
  let paperSpaceEntities = 0;
  let headerVar = null;
  let entity = null; // { type, layer, block }
  let sawSection = false;

  const closeEntity = () => {
    if (!entity) return;
    const layer = entity.layer ?? "0";
    if (!layers.has(layer)) layers.set(layer, { count: 0, byType: {} });
    const row = layers.get(layer);
    row.count += 1;
    row.byType[entity.type] = (row.byType[entity.type] ?? 0) + 1;
    if (entity.type === "INSERT" && entity.block) {
      const key = `${layer}|${entity.block}`;
      if (!blocks.has(key))
        blocks.set(key, { name: entity.block, layer, count: 0 });
      blocks.get(key).count += 1;
    }
    entity = null;
  };

  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = lines[i].trim();
    const value = lines[i + 1].trim();

    if (code === "0") {
      closeEntity();
      headerVar = null;
      if (value === "SECTION") {
        // the section name is the next pair (code 2)
        section = (lines[i + 3] ?? "").trim();
        sawSection = true;
        i += 2;
        continue;
      }
      if (value === "ENDSEC") {
        section = null;
        continue;
      }
      if (section === "ENTITIES") {
        entitiesByType[value] = (entitiesByType[value] ?? 0) + 1;
        entity = { type: value, layer: null, block: null };
      } else if (section === "BLOCKS" && value === "BLOCK") blockCount += 1;
      continue;
    }

    if (section === "HEADER") {
      if (code === "9") {
        headerVar = value;
        header[headerVar] = {};
      } else if (headerVar) header[headerVar][code] = value;
      continue;
    }

    if (entity) {
      if (code === "8") entity.layer = value;
      else if (code === "2" && entity.type === "INSERT") entity.block = value;
      else if (code === "67" && value === "1") paperSpaceEntities += 1;
    }
  }
  closeEntity();
  if (!sawSection) return null;

  const point = (name) => {
    const v = header[name];
    const x = Number(v?.["10"]);
    const y = Number(v?.["20"]);
    return Number.isFinite(x) && Number.isFinite(y)
      ? { x: round3(x), y: round3(y) }
      : null;
  };
  const min = point("$EXTMIN");
  const max = point("$EXTMAX");
  const unitCode = Number(header.$INSUNITS?.["70"] ?? 0);
  const unit = INSUNITS[unitCode] ?? { name: `code ${unitCode}`, meters: null };

  const sortedLayers = [...layers.entries()]
    .map(([name, row]) => ({ name, count: row.count, byType: row.byType }))
    .sort((a, b) => b.count - a.count);
  const sortedBlocks = [...blocks.values()].sort((a, b) => b.count - a.count);

  return {
    format: "DXF",
    version: header.$ACADVER?.["1"] ?? null,
    unit: { code: unitCode, name: unit.name, meters: unit.meters },
    extents:
      min && max && max.x > min.x && max.y > min.y
        ? {
            min,
            max,
            width: round3(max.x - min.x),
            height: round3(max.y - min.y),
          }
        : null,
    entityCount: Object.values(entitiesByType).reduce((n, c) => n + c, 0),
    entitiesByType,
    paperSpaceEntities,
    layerCount: sortedLayers.length,
    layers: sortedLayers.slice(0, MAX_LAYERS),
    blockDefinitionCount: blockCount,
    // blocks inserted in the model, most used first (Revit exports name them
    // with the family, the type and the element id)
    insertedBlockCount: sortedBlocks.length,
    insertedBlocks: sortedBlocks.slice(0, MAX_BLOCKS),
  };
}
