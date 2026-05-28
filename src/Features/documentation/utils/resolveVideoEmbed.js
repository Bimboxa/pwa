// Detect a video-provider URL from a Markdown image (`![alt](url)`) and return
// its embeddable iframe form. Returns {provider, embedSrc} or null when the URL
// is not a recognized video link (so callers fall back to a normal <img>).
//
// Supported:
// - Google Drive  drive.google.com/file/d/<ID>/...  |  ?id=<ID>  ->  /file/d/<ID>/preview
// - YouTube        youtu.be/<ID> | watch?v=<ID> | /embed/<ID> | /shorts/<ID>  ->  /embed/<ID>
// - Vimeo          vimeo.com/<ID>  ->  player.vimeo.com/video/<ID>
export default function resolveVideoEmbed(src) {
  if (!src || typeof src !== "string") return null;

  // Google Drive
  const drive =
    src.match(/drive\.google\.com\/file\/d\/([\w-]+)/i) ||
    src.match(/drive\.google\.com\/(?:open|uc)\?(?:[^#]*&)?id=([\w-]+)/i);
  if (drive) {
    return {
      provider: "drive",
      embedSrc: `https://drive.google.com/file/d/${drive[1]}/preview`,
    };
  }

  // YouTube
  const youtube =
    src.match(/youtu\.be\/([\w-]+)/i) ||
    src.match(/youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/)([\w-]+)/i);
  if (youtube) {
    return {
      provider: "youtube",
      embedSrc: `https://www.youtube.com/embed/${youtube[1]}`,
    };
  }

  // Vimeo
  const vimeo = src.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeo) {
    return {
      provider: "vimeo",
      embedSrc: `https://player.vimeo.com/video/${vimeo[1]}`,
    };
  }

  return null;
}
