// dexie-export-import@4.1.4 occasionally emits invalid JSON with trailing
// commas (e.g. `...,]` or `...,}`) when its filter rejects the last row of a
// table. The bug surfaces in partial exports that filter out whole tables.
// We parse normally first (no-op for well-formed JSON) and only sanitize on
// parse failure.

function stripTrailingCommas(text) {
  let out = "";
  let inStr = false;
  let escape = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (escape) {
      out += c;
      escape = false;
      continue;
    }
    if (inStr) {
      out += c;
      if (c === "\\") escape = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      out += c;
      continue;
    }
    if (c === ",") {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      if (text[j] === "]" || text[j] === "}") continue;
    }
    out += c;
  }
  return out;
}

export default async function parseDexieExportBlob(blob) {
  const text = await blob.text();
  try {
    return JSON.parse(text);
  } catch {
    return JSON.parse(stripTrailingCommas(text));
  }
}

export { stripTrailingCommas };
