// pdfjs-dist v5 loads the JPEG 2000 (OpenJPEG) and color-management (QCMS)
// image decoders from WASM modules. pdf.js resolves them against `wasmUrl`.
// Without it, `wasmUrl` is null, pdf.js tries to fetch the bogus specifier
// "nullopenjpeg_nowasm_fallback.js", JPX decoding fails, and any PDF whose
// pages are stored as JPEG 2000 images renders as blank white pages.
//
// The wasm assets are copied from node_modules/pdfjs-dist/wasm into
// public/pdfjs/wasm (same pattern as public/opencv). Spread these params into
// every getDocument() call.
export const PDFJS_DOC_PARAMS = {
  wasmUrl: `${import.meta.env.BASE_URL}pdfjs/wasm/`,
};
