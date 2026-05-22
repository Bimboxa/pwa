import {useEffect, useMemo, useState} from "react";

import slugifyHeading from "../utils/slugifyHeading";

// Strip inline markdown emphasis/code from a heading line for display.
function cleanHeadingText(raw) {
  return raw
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .trim();
}

function parseHeadings(markdown) {
  if (!markdown) return [];
  const lines = markdown.split("\n");
  const out = [];
  let inFence = false;
  for (const line of lines) {
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = line.match(/^(#{2,3})\s+(.+?)\s*#*\s*$/);
    if (!m) continue;
    const depth = m[1].length;
    const text = cleanHeadingText(m[2]);
    if (!text) continue;
    out.push({id: slugifyHeading(text), text, depth});
  }
  return out;
}

export default function useHeadingsOutline(content, contentRef) {
  const headings = useMemo(() => parseHeadings(content), [content]);
  const [activeId, setActiveId] = useState(null);

  useEffect(() => {
    if (!contentRef?.current || headings.length === 0) {
      setActiveId(null);
      return;
    }
    const root = contentRef.current;
    const nodes = Array.from(root.querySelectorAll("h2, h3")).filter(
      (n) => n.id
    );
    if (nodes.length === 0) {
      setActiveId(null);
      return;
    }

    // Active = last heading whose top has crossed an offset near the top of
    // the scroll container. Recomputed live, never relying on stale geometry.
    const compute = () => {
      const rootTop = root.getBoundingClientRect().top;
      const offset = root.clientHeight * 0.3;
      let current = nodes[0].id;
      for (const n of nodes) {
        const topRelative = n.getBoundingClientRect().top - rootTop;
        if (topRelative - offset <= 0) {
          current = n.id;
        } else {
          break;
        }
      }
      setActiveId(current);
    };

    compute();
    const onScroll = () => compute();
    root.addEventListener("scroll", onScroll, {passive: true});
    window.addEventListener("resize", onScroll);
    return () => {
      root.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [headings, contentRef]);

  return {headings, activeId};
}
