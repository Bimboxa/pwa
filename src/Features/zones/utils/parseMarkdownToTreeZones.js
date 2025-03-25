import {nanoid} from "@reduxjs/toolkit";

export default function parseMarkdownToTreeZones(markdown) {
  const lines = markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== ""); // Remove empty or whitespace-only lines

  const root = [];
  const stack = [];

  for (const line of lines) {
    const match = line.match(/^(#+)\s+(.*)$/);
    if (!match) continue;

    const level = match[1].length;
    const label = match[2].trim();

    const node = {
      id: nanoid(),
      label,
      children: [],
    };

    // Keep stack in sync with current level
    while (stack.length >= level) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }

    stack.push(node);
  }

  return root;
}
