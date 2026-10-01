// Pure digest of an IFC file (STEP text) for the Prompt IA `contexte.json`:
// schema, unit, storeys, site placement (shared coordinates) and the number
// of elements per class. A text scan, no geometry.

// Classes worth counting: the physical elements a plan shows.
const ELEMENT_CLASSES = new Set([
  "IFCWALL",
  "IFCWALLSTANDARDCASE",
  "IFCSLAB",
  "IFCROOF",
  "IFCBEAM",
  "IFCCOLUMN",
  "IFCMEMBER",
  "IFCPLATE",
  "IFCFOOTING",
  "IFCPILE",
  "IFCSTAIR",
  "IFCSTAIRFLIGHT",
  "IFCRAMP",
  "IFCRAMPFLIGHT",
  "IFCRAILING",
  "IFCDOOR",
  "IFCWINDOW",
  "IFCCURTAINWALL",
  "IFCCOVERING",
  "IFCOPENINGELEMENT",
  "IFCBUILDINGELEMENTPROXY",
  "IFCSPACE",
  "IFCFURNISHINGELEMENT",
  "IFCFLOWTERMINAL",
  "IFCFLOWSEGMENT",
  "IFCFLOWFITTING",
  "IFCDISTRIBUTIONELEMENT",
]);

const SI_PREFIX = { MILLI: 0.001, CENTI: 0.01, DECI: 0.1, KILO: 1000 };

const round4 = (v) => Math.round(v * 10000) / 10000;

// 'Coordonn\X\E9es' / '\X2\00E9\X0\' → é ; '' → '
export function decodeStepString(raw) {
  return String(raw ?? "")
    .replace(/\\X2\\((?:[0-9A-F]{4})+)\\X0\\/g, (_, hex) =>
      hex
        .match(/.{4}/g)
        .map((h) => String.fromCharCode(parseInt(h, 16)))
        .join("")
    )
    .replace(/\\X\\([0-9A-F]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/\\S\\(.)/g, (_, c) => String.fromCharCode(c.charCodeAt(0) + 128))
    .replace(/''/g, "'");
}

// Top-level arguments of a STEP entity: strings and nested lists kept whole.
export function splitStepArgs(args) {
  const out = [];
  let depth = 0;
  let inString = false;
  let current = "";
  for (let i = 0; i < args.length; i += 1) {
    const c = args[i];
    if (inString) {
      current += c;
      if (c === "'") {
        if (args[i + 1] === "'") {
          current += "'";
          i += 1;
        } else inString = false;
      }
      continue;
    }
    if (c === "'") {
      inString = true;
      current += c;
    } else if (c === "(") {
      depth += 1;
      current += c;
    } else if (c === ")") {
      depth -= 1;
      current += c;
    } else if (c === "," && depth === 0) {
      out.push(current.trim());
      current = "";
    } else current += c;
  }
  if (current.trim() || out.length) out.push(current.trim());
  return out;
}

const stringArg = (arg) =>
  arg && arg.startsWith("'") ? decodeStepString(arg.slice(1, -1)) : null;

const numbersArg = (arg) =>
  (arg ?? "")
    .replace(/[()]/g, "")
    .split(",")
    .map(Number)
    .filter(Number.isFinite);

const refArg = (arg) => (/^#\d+$/.test(arg ?? "") ? arg.slice(1) : null);

/**
 * @param {string} text - content of the .ifc file
 * @returns {Object|null} null when the content is not a STEP file
 */
export default function summarizeIfc(text) {
  if (typeof text !== "string" || !/ISO-10303-21/.test(text.slice(0, 200)))
    return null;

  // id → { type, args } of the few entities resolved afterwards
  const kept = new Map();
  const KEEP = new Set([
    "IFCPROJECT",
    "IFCSITE",
    "IFCBUILDINGSTOREY",
    "IFCSIUNIT",
    "IFCMAPCONVERSION",
    "IFCPROJECTEDCRS",
    "IFCRELCONTAINEDINSPATIALSTRUCTURE",
  ]);
  const elementsByClass = {};
  let entityCount = 0;

  const entityRe = /^#(\d+)\s*=\s*([A-Z0-9_]+)\s*\(/gm;
  let match;
  while ((match = entityRe.exec(text))) {
    entityCount += 1;
    const type = match[2];
    if (ELEMENT_CLASSES.has(type))
      elementsByClass[type] = (elementsByClass[type] ?? 0) + 1;
    if (!KEEP.has(type)) continue;
    // one entity per line (what every exporter writes)
    let end = text.indexOf("\n", entityRe.lastIndex);
    if (end < 0) end = text.length;
    const body = text.slice(entityRe.lastIndex, end).replace(/\)\s*;\s*$/, "");
    kept.set(match[1], { type, args: splitStepArgs(body) });
  }
  if (entityCount === 0) return null;

  // on-demand lookup of a placement entity (they are far too many to keep)
  const getEntity = (id) => {
    if (!id) return null;
    const re = new RegExp(`^#${id}\\s*=\\s*([A-Z0-9_]+)\\s*\\((.*)\\);`, "m");
    const found = text.match(re);
    return found ? { type: found[1], args: splitStepArgs(found[2]) } : null;
  };
  const getNumbers = (id) => numbersArg(getEntity(id)?.args[0]);

  const byType = (type) =>
    [...kept.entries()].filter(([, e]) => e.type === type);

  // header
  const schema = text.match(/FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'/)?.[1] ?? null;
  const fileName = text.match(/FILE_NAME\s*\(([\s\S]*?)\);/)?.[1];
  const application = fileName
    ? (stringArg(splitStepArgs(fileName)[5]) ?? null)
    : null;

  // length unit
  let lengthUnit = null;
  for (const [, unit] of byType("IFCSIUNIT")) {
    if (unit.args[1] !== ".LENGTHUNIT.") continue;
    const prefix = (unit.args[2] ?? "").replace(/\./g, "");
    const name = (unit.args[3] ?? "").replace(/\./g, "");
    lengthUnit = {
      name: `${prefix && prefix !== "$" ? prefix : ""}${name}`,
      meters: name === "METRE" ? (SI_PREFIX[prefix] ?? 1) : null,
    };
    break;
  }

  // storeys, with the number of elements each one contains
  const containedByStorey = new Map();
  for (const [, rel] of byType("IFCRELCONTAINEDINSPATIALSTRUCTURE")) {
    const storeyId = refArg(rel.args[5]);
    const count = (rel.args[4] ?? "").split("#").length - 1;
    if (storeyId)
      containedByStorey.set(
        storeyId,
        (containedByStorey.get(storeyId) ?? 0) + count
      );
  }
  const storeys = byType("IFCBUILDINGSTOREY")
    .map(([id, storey]) => ({
      name: stringArg(storey.args[2]),
      longName: stringArg(storey.args[7]),
      elevation: Number.isFinite(Number(storey.args[9]))
        ? round4(Number(storey.args[9]))
        : null,
      elementCount: containedByStorey.get(id) ?? 0,
    }))
    .sort((a, b) => (a.elevation ?? 0) - (b.elevation ?? 0));

  // site placement: the origin and the X axis of the model in the shared
  // (survey) coordinates — the first site that has an absolute placement
  let site = null;
  for (const [, entity] of byType("IFCSITE")) {
    const placement = getEntity(refArg(entity.args[5]));
    if (placement?.type !== "IFCLOCALPLACEMENT") continue;
    if (refArg(placement.args[0])) continue; // relative to another placement
    const axis = getEntity(refArg(placement.args[1]));
    if (axis?.type !== "IFCAXIS2PLACEMENT3D") continue;
    const location = getNumbers(refArg(axis.args[0]));
    const refDirection = getNumbers(refArg(axis.args[2]));
    if (location.length < 2) continue;
    const xAxis =
      refDirection.length >= 2
        ? { x: round4(refDirection[0]), y: round4(refDirection[1]) }
        : { x: 1, y: 0 };
    site = {
      name: stringArg(entity.args[2]),
      location: {
        x: round4(location[0]),
        y: round4(location[1]),
        z: round4(location[2] ?? 0),
      },
      xAxis,
      // angle of the model X axis in the shared coordinates, counter-clockwise
      angleDeg: round4((Math.atan2(xAxis.y, xAxis.x) * 180) / Math.PI),
    };
    break;
  }

  // explicit georeferencing (IFC4), when the exporter wrote it
  let mapConversion = null;
  const conversion = byType("IFCMAPCONVERSION")[0]?.[1];
  if (conversion) {
    const crs = kept.get(refArg(conversion.args[1]));
    const num = (i) =>
      Number.isFinite(Number(conversion.args[i]))
        ? Number(conversion.args[i])
        : null;
    mapConversion = {
      crs: crs ? stringArg(crs.args[0]) : null,
      eastings: num(2),
      northings: num(3),
      orthogonalHeight: num(4),
      xAxisAbscissa: num(5),
      xAxisOrdinate: num(6),
      scale: num(7),
    };
  }

  const project = byType("IFCPROJECT")[0]?.[1];

  return {
    format: "IFC",
    schema,
    application,
    project: project
      ? (stringArg(project.args[3]) ?? stringArg(project.args[2]))
      : null,
    lengthUnit,
    entityCount,
    site,
    mapConversion,
    storeys,
    elementCount: Object.values(elementsByClass).reduce((n, c) => n + c, 0),
    elementsByClass,
  };
}
