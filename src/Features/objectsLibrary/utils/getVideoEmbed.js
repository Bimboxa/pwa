// Resolve an object's videoUrl to a playable embed.
//
// Two kinds of sources coexist in the manifests:
// - a bundled asset ("assets/cercle.mp4") resolved to a local blob/url by
//   useObjectsLibrary -> playable directly in a <video> tag,
// - an external share link (Google Drive, YouTube) -> only playable in an
//   iframe, and usually with a different URL than the one you copy from the
//   browser address bar.
const DRIVE_FILE_REGEX = /drive\.google\.com\/file\/d\/([^/?#]+)/;
const YOUTUBE_WATCH_REGEX = /youtube\.com\/watch\?(?:.*&)?v=([^&#]+)/;
const YOUTUBE_SHORT_REGEX = /youtu\.be\/([^/?#]+)/;
const FILE_EXT_REGEX = /\.(mp4|webm|ogg|mov)(\?|#|$)/i;

export default function getVideoEmbed(videoUrl) {
  if (!videoUrl) return null;

  const driveMatch = videoUrl.match(DRIVE_FILE_REGEX);
  if (driveMatch) {
    return {
      kind: "IFRAME",
      src: `https://drive.google.com/file/d/${driveMatch[1]}/preview`,
    };
  }

  const youtubeMatch =
    videoUrl.match(YOUTUBE_WATCH_REGEX) ?? videoUrl.match(YOUTUBE_SHORT_REGEX);
  if (youtubeMatch) {
    return {
      kind: "IFRAME",
      src: `https://www.youtube.com/embed/${youtubeMatch[1]}`,
    };
  }

  if (FILE_EXT_REGEX.test(videoUrl) || videoUrl.startsWith("blob:")) {
    return { kind: "FILE", src: videoUrl };
  }

  // Unknown remote source: an iframe is the safest bet.
  return { kind: "IFRAME", src: videoUrl };
}
