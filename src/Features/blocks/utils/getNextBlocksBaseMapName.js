import { DEFAULT_BLOCKS_BASE_MAP_NAME } from "./blockTypes.js";

// "Blocs", then "Blocs 2", "Blocs 3"… — the first name not used yet.
export default function getNextBlocksBaseMapName(existingNames) {
  const used = new Set(existingNames ?? []);
  if (!used.has(DEFAULT_BLOCKS_BASE_MAP_NAME))
    return DEFAULT_BLOCKS_BASE_MAP_NAME;
  let index = 2;
  while (used.has(`${DEFAULT_BLOCKS_BASE_MAP_NAME} ${index}`)) index += 1;
  return `${DEFAULT_BLOCKS_BASE_MAP_NAME} ${index}`;
}
