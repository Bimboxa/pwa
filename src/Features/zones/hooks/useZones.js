import exampleZones from "../data/exampleZones.md?raw";
import parseMarkdownToTreeZones from "../utils/parseMarkdownToTreeZones";

export default function useZones() {
  return parseMarkdownToTreeZones(exampleZones);
}
