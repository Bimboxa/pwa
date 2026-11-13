import fetchRemoteImageBlob from "Features/images/utils/fetchRemoteImageBlob";

// Turns a drop DataTransfer into image Files, whether the drag comes from
// the desktop (Files) or from another web page (text/uri-list, text/html,
// text/plain pointing to an image). Remote urls are fetched; the site must
// allow CORS, otherwise the url ends up in `failedUrls`.
//
// `collectImageDropData` must run synchronously inside the drop event: the
// DataTransfer payload (getData / files) is cleared once the event returns.
// `resolveImageDropData` may then run async.

const IMAGE_EXT_BY_MIME = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/bmp": "bmp",
  "image/avif": "avif",
};

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i;

// Readable during dragover (only `types` and items' kind / type are exposed).
export function dataTransferMayHoldImage(dataTransfer) {
  if (!dataTransfer) return false;
  const items = Array.from(dataTransfer.items ?? []);
  if (
    items.some(
      (item) => item.kind === "file" && item.type?.startsWith("image/")
    )
  )
    return true;
  const types = Array.from(dataTransfer.types ?? []);
  return types.includes("text/uri-list") || types.includes("text/html");
}

function isImageUrl(url) {
  return /^https?:\/\//i.test(url) || /^data:image\//i.test(url);
}

function getUrlsFromUriList(text) {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

function getUrlsFromHtml(html) {
  if (!html) return [];
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const urls = [];
    doc.querySelectorAll("img").forEach((img) => {
      let src = img.getAttribute("src");
      if (!src) {
        const srcset = img.getAttribute("srcset");
        src = srcset?.split(",")[0]?.trim().split(/\s+/)[0];
      }
      if (!src) return;
      try {
        urls.push(new URL(src, document.baseURI).href);
      } catch {
        // ignore unparsable src
      }
    });
    return urls;
  } catch {
    return [];
  }
}

// Sync part: snapshot files and candidate urls while the event is live.
export function collectImageDropData(dataTransfer) {
  const files = Array.from(dataTransfer?.files ?? []).filter((f) =>
    f.type?.startsWith("image/")
  );
  if (files.length > 0) return { files, urls: [] };

  const candidates = [
    ...getUrlsFromUriList(dataTransfer?.getData("text/uri-list")),
    ...getUrlsFromHtml(dataTransfer?.getData("text/html")),
  ];
  const plain = dataTransfer?.getData("text/plain")?.trim();
  if (plain && isImageUrl(plain)) candidates.push(plain);

  const urls = [...new Set(candidates.filter(isImageUrl))];
  return { files: [], urls };
}

function getFileNameFromUrl(url, mime) {
  const ext = IMAGE_EXT_BY_MIME[mime] ?? "png";
  if (url.startsWith("data:")) return `image.${ext}`;
  try {
    const segment = decodeURIComponent(
      new URL(url).pathname.split("/").filter(Boolean).pop() ?? ""
    );
    if (segment && IMAGE_EXT_RE.test(segment)) return segment;
  } catch {
    // fall through
  }
  return `image.${ext}`;
}

async function fetchImageFile(url) {
  const blob = url.startsWith("data:")
    ? await (await fetch(url)).blob()
    : await fetchRemoteImageBlob({ url });
  if (!blob?.type?.startsWith("image/")) {
    throw new Error(`Not an image (${blob?.type || "unknown type"}) at ${url}`);
  }
  return new File([blob], getFileNameFromUrl(url, blob.type), {
    type: blob.type,
  });
}

// Async part: fetch remote urls into Files.
export async function resolveImageDropData({ files, urls }) {
  if (files.length > 0) return { files, failedUrls: [] };

  const resolved = [];
  const failedUrls = [];
  for (const url of urls) {
    try {
      resolved.push(await fetchImageFile(url));
    } catch (error) {
      console.warn(
        "[getImageFilesFromDataTransfer] cannot load image",
        url,
        error
      );
      failedUrls.push(url);
    }
  }
  return { files: resolved, failedUrls };
}

export default async function getImageFilesFromDataTransfer(dataTransfer) {
  return resolveImageDropData(collectImageDropData(dataTransfer));
}
