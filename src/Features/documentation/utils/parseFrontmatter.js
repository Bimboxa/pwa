import yaml from "js-yaml";

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n?/;

export default function parseFrontmatter(raw) {
  if (typeof raw !== "string") return {data: {}, content: ""};
  const match = raw.match(FRONTMATTER_RE);
  if (!match) return {data: {}, content: raw};
  let data = {};
  try {
    data = yaml.load(match[1]) ?? {};
  } catch {
    data = {};
  }
  const content = raw.slice(match[0].length);
  return {data, content};
}
