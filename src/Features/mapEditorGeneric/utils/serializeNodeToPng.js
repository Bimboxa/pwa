/**
 * Serialize an <svg> OR a child graphics element (<g>, <path>, etc.) to PNG.
 * If a non-<svg> node is supplied, we wrap it in a temporary <svg> sized
 * to the node’s own bounding box (as currently rendered).
 *
 * Usage:
 *   const dataUrl = await serializeNodeToPng(worldGroupRef.current, { scale: 2, backgroundColor: "#fff" });
 *   // then download the dataUrl or send it somewhere
 *
 * @param {SVGSVGElement|SVGGraphicsElement} node
 * @param {Object} opts
 * @param {number}  [opts.scale=2]                Resolution multiplier
 * @param {string}  [opts.backgroundColor=null]   Fill canvas (e.g. "#fff") before drawing
 * @param {number}  [opts.padding=0]              Extra pixels around export (screen px)
 * @returns {Promise<string>} PNG data URL
 */
export async function serializeNodeToPng(
  node,
  { scale = 2, backgroundColor = null, padding = 0 } = {}
) {
  if (!node) throw new Error("serializeNodeToPng: node is required.");

  // If it's already an <svg>, we can export it directly.
  if (node.tagName.toLowerCase() === "svg") {
    return serializeSvgElementToPng(node, { scale, backgroundColor, padding });
  }

  // Otherwise wrap the node (e.g. <g>) into a new <svg>.
  const svg = node.ownerSVGElement;
  if (!svg)
    throw new Error("serializeNodeToPng: node must be inside an <svg>.");

  // --- 1) Compute sizes ---
  const rect = node.getBoundingClientRect(); // on-screen px (after transforms)
  const screenW = Math.max(1, Math.ceil(rect.width));
  const screenH = Math.max(1, Math.ceil(rect.height));

  // Bounding box in SVG user units (includes transforms affecting the node)
  let bbox;
  try {
    bbox = node.getBBox(); // {x,y,width,height} in current user coordinates
  } catch {
    // Fallback: map screen rect to user units via inverse screen CTM
    const ctm = svg.getScreenCTM();
    if (!ctm) throw new Error("Could not compute CTM for fallback bbox.");
    const inv = ctm.inverse();
    const p0 = new DOMPoint(rect.left, rect.top).matrixTransform(inv);
    const p1 = new DOMPoint(rect.right, rect.bottom).matrixTransform(inv);
    bbox = {
      x: Math.min(p0.x, p1.x),
      y: Math.min(p0.y, p1.y),
      width: Math.abs(p1.x - p0.x),
      height: Math.abs(p1.y - p0.y),
    };
  }

  const { wrapper, clonedNode } = buildWrapperSvgForNode(
    node,
    bbox,
    screenW,
    screenH
  );

  // Inline computed styles so appearance matches what you see
  inlineAllComputedStyles(node, clonedNode);

  // Copy <defs> from the source SVG (filters/markers/gradients referenced by url(#id))
  copyAllDefs(svg, wrapper);

  // Inline external <image> hrefs to data URLs to avoid canvas taint
  await inlineExternalImages(wrapper);

  // Serialize & draw to canvas
  return svgToPngDataUrl(wrapper, {
    scale,
    backgroundColor,
    padding,
    screenW,
    screenH,
  });
}

/* ======================= internals ======================= */

async function serializeSvgElementToPng(
  svgEl,
  { scale = 2, backgroundColor = null, padding = 0 } = {}
) {
  const rect = svgEl.getBoundingClientRect();
  const screenW = Math.max(1, Math.ceil(rect.width));
  const screenH = Math.max(1, Math.ceil(rect.height));

  // Clone so we can mutate freely
  const cloned = svgEl.cloneNode(true);
  ensureSvgNamespaces(cloned);
  // Inline styles for the whole tree
  inlineAllComputedStyles(svgEl, cloned);
  // Inline images
  await inlineExternalImages(cloned);

  return svgToPngDataUrl(cloned, {
    scale,
    backgroundColor,
    padding,
    screenW,
    screenH,
  });
}

function buildWrapperSvgForNode(node, bbox, screenW, screenH) {
  // Create a standalone <svg> sized to the node’s on-screen box,
  // but with viewBox cropping to the node’s user-space bbox.
  const wrapper = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  ensureSvgNamespaces(wrapper);

  wrapper.setAttribute("width", String(screenW));
  wrapper.setAttribute("height", String(screenH));
  wrapper.setAttribute(
    "viewBox",
    `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`
  );

  // We’ll translate the node so its bbox top-left maps to (bbox.x, bbox.y) in this viewBox.
  // In practice, simply appending the cloned node is sufficient because the viewBox crops
  // to bbox; but if you want to enforce origin alignment, you can wrap in a <g translate(...)}>.
  const clonedNode = node.cloneNode(true);
  wrapper.appendChild(clonedNode);

  return { wrapper, clonedNode };
}

function ensureSvgNamespaces(svgEl) {
  svgEl.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svgEl.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
}

function copyAllDefs(srcSvg, dstSvg) {
  const defs = srcSvg.querySelectorAll("defs");
  if (!defs.length) return;
  // Ensure a <defs> exists at the top of dstSvg
  let dstDefs = dstSvg.querySelector("defs");
  if (!dstDefs) {
    dstDefs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    dstSvg.insertBefore(dstDefs, dstSvg.firstChild);
  }
  defs.forEach((d) => {
    dstDefs.appendChild(d.cloneNode(true));
  });
}

/**
 * Walk source/clone trees in parallel and copy computed CSS -> style="" on each element.
 * Works for SVG and HTML (inside <foreignObject>) alike.
 */
function inlineAllComputedStyles(srcRoot, dstRoot) {
  // root first
  copyComputedStyle(srcRoot, dstRoot);

  const srcWalker = document.createTreeWalker(srcRoot, NodeFilter.SHOW_ELEMENT);
  const dstWalker = document.createTreeWalker(dstRoot, NodeFilter.SHOW_ELEMENT);

  while (true) {
    const srcOk = srcWalker.nextNode();
    const dstOk = dstWalker.nextNode();
    if (!srcOk || !dstOk) break;
    copyComputedStyle(srcWalker.currentNode, dstWalker.currentNode);
  }
}

function copyComputedStyle(srcEl, dstEl) {
  const computed = window.getComputedStyle(srcEl);
  let css = "";
  for (let i = 0; i < computed.length; i++) {
    const prop = computed[i];
    const val = computed.getPropertyValue(prop);
    css += `${prop}:${val};`;
  }
  dstEl.setAttribute("style", css);

  // SVG presentation attributes for good measure
  if (dstEl.tagName && dstEl.namespaceURI === "http://www.w3.org/2000/svg") {
    dstEl.setAttribute("font-family", computed.fontFamily);
    dstEl.setAttribute("font-size", computed.fontSize);
  }
}

async function inlineExternalImages(svgNode) {
  const images = Array.from(svgNode.querySelectorAll("image"));
  await Promise.all(
    images.map(async (img) => {
      const href =
        img.getAttributeNS("http://www.w3.org/1999/xlink", "href") ||
        img.getAttribute("href");
      if (!href || /^data:/i.test(href)) return;

      try {
        const res = await fetch(href, { mode: "cors" });
        const blob = await res.blob();
        const dataUrl = await blobToDataUrl(blob);
        img.setAttributeNS("http://www.w3.org/1999/xlink", "href", dataUrl);
        img.setAttribute("href", dataUrl);
      } catch (err) {
        console.warn("inlineExternalImages: failed to inline", href, err);
      }
    })
  );
}

function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

function svgToPngDataUrl(
  svgEl,
  { scale, backgroundColor, padding, screenW, screenH }
) {
  return new Promise((resolve, reject) => {
    const serializer = new XMLSerializer();
    const svgText = serializer.serializeToString(svgEl);
    const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const canvas = document.createElement("canvas");
    // add padding in screen px, then scale
    const exportW = Math.max(1, Math.ceil(screenW + padding * 2));
    const exportH = Math.max(1, Math.ceil(screenH + padding * 2));
    canvas.width = Math.max(1, Math.floor(exportW * scale));
    canvas.height = Math.max(1, Math.floor(exportH * scale));
    const ctx = canvas.getContext("2d");

    const img = new Image();
    img.onload = () => {
      try {
        if (backgroundColor) {
          ctx.fillStyle = backgroundColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        const dx = Math.floor(padding * scale);
        const dy = Math.floor(padding * scale);
        const dw = Math.floor(screenW * scale);
        const dh = Math.floor(screenH * scale);
        ctx.drawImage(img, dx, dy, dw, dh);
        const dataUrl = canvas.toDataURL("image/png");
        resolve(dataUrl);
      } catch (e) {
        reject(e);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}
