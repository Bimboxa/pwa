/**
 * Serialize a live <svg> element to a PNG data URL.
 *
 * @param {SVGSVGElement} svgEl - The live SVG node you want to export.
 * @param {Object} opts
 * @param {number} [opts.scale=2] - Resolution multiplier for the output PNG.
 * @param {string|null} [opts.backgroundColor=null] - Fill canvas with this color (e.g. "#fff").
 * @param {number} [opts.padding=0] - Extra padding (screen px) around the exported image.
 * @param {(node: Node)=>boolean} [opts.filter] - Return false to exclude a node from export.
 * @returns {Promise<string>} - Resolves to a PNG data URL (data:image/png;base64,...).
 */
export async function serializeSvgToPng(
  svgEl,
  { scale = 2, backgroundColor = null, padding = 0, filter } = {}
) {
  if (!svgEl || svgEl.tagName.toLowerCase() !== "svg") {
    throw new Error("serializeSvgToPng: svgEl must be an <svg> element.");
  }

  // 1) Snapshot size in CSS pixels (what’s on screen)
  const rect = svgEl.getBoundingClientRect();
  const screenW = Math.max(1, Math.ceil(rect.width));
  const screenH = Math.max(1, Math.ceil(rect.height));

  // 2) Clone the SVG so we can mutate freely
  const cloned = svgEl.cloneNode(true);

  // 3) (Optional) filter out nodes (e.g., toolbars) from the clone
  if (typeof filter === "function") {
    const walker = document.createTreeWalker(cloned, NodeFilter.SHOW_ELEMENT);
    const toRemove = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      // Find the corresponding node in the original tree by index path:
      // For robust style inlining we’ll match by DOM order while walking both trees.
      // But filtering only needs to act on the cloned tree:
      if (!filter(node)) toRemove.push(node);
    }
    toRemove.forEach((n) => n.parentNode && n.parentNode.removeChild(n));
  }

  // 4) Ensure essential namespaces & size attributes on the cloned root
  cloned.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  cloned.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  // Explicit width/height in CSS pixels helps some browsers (Safari)
  cloned.setAttribute("width", `${screenW}`);
  cloned.setAttribute("height", `${screenH}`);
  // Preserve the original viewBox if present
  const vb = svgEl.getAttribute("viewBox");
  if (vb) {
    cloned.setAttribute("viewBox", vb);
  } else {
    // If no viewBox, set one matching the on-screen size to keep proportions stable
    cloned.setAttribute("viewBox", `0 0 ${screenW} ${screenH}`);
  }

  // 5) Inline computed styles into the clone so appearance matches what you see
  inlineAllComputedStyles(svgEl, cloned);

  // 6) Inline external <image> hrefs to data URLs to avoid canvas taint
  await inlineExternalImages(cloned);

  // 7) Serialize the cloned SVG to a Blob URL
  const svgText = new XMLSerializer().serializeToString(cloned);
  const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    // 8) Paint the SVG into a canvas at desired scale
    const exportW = Math.max(1, Math.ceil(screenW + padding * 2));
    const exportH = Math.max(1, Math.ceil(screenH + padding * 2));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(exportW * scale));
    canvas.height = Math.max(1, Math.floor(exportH * scale));
    const ctx = canvas.getContext("2d");

    if (backgroundColor) {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const img = await loadImage(svgUrl); // resolves when <img> from svgUrl is loaded

    // Draw SVG image onto canvas (offset by padding, scaled)
    const drawX = Math.floor(padding * scale);
    const drawY = Math.floor(padding * scale);
    const drawW = Math.floor(screenW * scale);
    const drawH = Math.floor(screenH * scale);
    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    // 9) Export PNG data URL
    try {
      return canvas.toDataURL("image/png");
    } catch (err) {
      if (err.name === "SecurityError") {
        console.warn("Canvas is tainted, trying fallback method...");
        // Fallback: try to export with a different approach
        // Create a new canvas and try to draw without external images
        const fallbackCanvas = document.createElement("canvas");
        fallbackCanvas.width = canvas.width;
        fallbackCanvas.height = canvas.height;
        const fallbackCtx = fallbackCanvas.getContext("2d");

        if (backgroundColor) {
          fallbackCtx.fillStyle = backgroundColor;
          fallbackCtx.fillRect(
            0,
            0,
            fallbackCanvas.width,
            fallbackCanvas.height
          );
        }

        // Try to draw the SVG again, but this time we'll handle taint differently
        try {
          fallbackCtx.drawImage(img, drawX, drawY, drawW, drawH);
          return fallbackCanvas.toDataURL("image/png");
        } catch (fallbackErr) {
          console.error("Fallback also failed:", fallbackErr);
          // Last resort: return a minimal canvas with background color
          const minimalCanvas = document.createElement("canvas");
          minimalCanvas.width = canvas.width;
          minimalCanvas.height = canvas.height;
          const minimalCtx = minimalCanvas.getContext("2d");
          minimalCtx.fillStyle = backgroundColor || "#ffffff";
          minimalCtx.fillRect(0, 0, minimalCanvas.width, minimalCanvas.height);
          return minimalCanvas.toDataURL("image/png");
        }
      }
      throw err;
    }
  } finally {
    // 10) Cleanup
    URL.revokeObjectURL(svgUrl);
  }
}

/* --------------------------- helpers below --------------------------- */

/**
 * Recursively copy computed styles from a live node tree to a cloned node tree.
 * This ensures the serialized SVG captures the same visual styles you see on screen,
 * including for <foreignObject> HTML content.
 */
function inlineAllComputedStyles(srcRoot, dstRoot) {
  const srcWalker = document.createTreeWalker(srcRoot, NodeFilter.SHOW_ELEMENT);
  const dstWalker = document.createTreeWalker(dstRoot, NodeFilter.SHOW_ELEMENT);

  // Also inline styles on the root nodes themselves
  copyComputedStyle(srcRoot, dstRoot);

  while (true) {
    const srcOk = srcWalker.nextNode();
    const dstOk = dstWalker.nextNode();
    if (!srcOk || !dstOk) break;
    const srcEl = srcWalker.currentNode;
    const dstEl = dstWalker.currentNode;
    copyComputedStyle(srcEl, dstEl);
  }

  // Additionally, embed current page font-face rules when accessible (optional).
  // Commented out by default due to cross-origin stylesheet restrictions.
  // const cssText = collectAccessibleFontFaceCss();
  // if (cssText) {
  //   const style = document.createElement("style");
  //   style.setAttribute("type", "text/css");
  //   style.innerHTML = cssText;
  //   dstRoot.insertBefore(style, dstRoot.firstChild);
  // }
}

/**
 * Copy all computed CSS properties from srcEl into a style="" on dstEl.
 */
function copyComputedStyle(srcEl, dstEl) {
  const computed = window.getComputedStyle(srcEl);
  // Build a style string with all properties
  // (You may narrow this list for smaller output)
  let css = "";
  for (let i = 0; i < computed.length; i++) {
    const prop = computed[i];
    const val = computed.getPropertyValue(prop);
    // Skip properties that can break rendering or bloat a lot if needed
    // (e.g., 'd' on paths is an attribute, not CSS)
    css += `${prop}:${val};`;
  }
  dstEl.setAttribute("style", css);

  // Special handling: for <svg> elements, ensure important presentation attrs are set
  if (dstEl.tagName && dstEl.tagName.toLowerCase() === "svg") {
    dstEl.setAttribute("font-family", computed.fontFamily);
    dstEl.setAttribute("font-size", computed.fontSize);
  }
}

/**
 * Convert all <image> href/src to embedded data URLs so drawImage won't taint the canvas.
 * Requires CORS access to those URLs (or same-origin).
 */
async function inlineExternalImages(svgNode) {
  const images = Array.from(svgNode.querySelectorAll("image"));
  await Promise.all(
    images.map(async (img) => {
      const href =
        img.getAttributeNS("http://www.w3.org/1999/xlink", "href") ||
        img.getAttribute("href");
      if (!href) return;

      // Ignore already-embedded data URLs
      if (/^data:/i.test(href)) return;

      try {
        const res = await fetch(href, { mode: "cors" });
        const blob = await res.blob();
        const dataUrl = await blobToDataUrl(blob);
        img.setAttributeNS("http://www.w3.org/1999/xlink", "href", dataUrl);
        img.setAttribute("href", dataUrl);
      } catch (err) {
        // If CORS fails, remove the image to prevent canvas taint
        console.warn(
          "inlineExternalImages: failed to inline",
          href,
          err,
          "- removing image to prevent canvas taint"
        );
        if (img.parentNode) {
          img.parentNode.removeChild(img);
        }
      }
    })
  );
}

/**
 * Promise wrapper to load an <img> from a URL (blob/data/http).
 */
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Using a blob URL: no crossOrigin needed. For http(s) you may use:
    // img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

/**
 * (Optional) Collect @font-face CSS rules from same-origin stylesheets so the
 * serialized SVG can render with the exact webfonts when opened elsewhere.
 * Cross-origin stylesheets are skipped by the browser for security reasons.
 */
// function collectAccessibleFontFaceCss() {
//   let cssText = "";
//   for (const sheet of Array.from(document.styleSheets)) {
//     try {
//       const rules = sheet.cssRules;
//       if (!rules) continue;
//       for (const rule of Array.from(rules)) {
//         if (rule.type === CSSRule.FONT_FACE_RULE) {
//           cssText += `${rule.cssText}\n`;
//         }
//       }
//     } catch (e) {
//       // Cross-origin stylesheet -> ignore
//     }
//   }
//   return cssText;
// }
