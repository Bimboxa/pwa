const VIDEO_ID_RE = /^[\w-]{11}$/;

// Extracts the video id of a YouTube url: watch?v=, youtu.be/, /shorts/,
// /embed/, /live/ (with or without protocol / www / m.). Null when the url is
// not a YouTube video.
export default function parseYoutubeVideoId(url) {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  let parsed;
  try {
    parsed = new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    );
  } catch {
    return null;
  }

  const host = parsed.hostname
    .replace(/^(www\.|m\.|music\.)/, "")
    .toLowerCase();
  const segments = parsed.pathname.split("/").filter(Boolean);

  let id = null;
  if (host === "youtu.be") {
    id = segments[0];
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (segments[0] === "watch") id = parsed.searchParams.get("v");
    else if (["shorts", "embed", "live", "v"].includes(segments[0]))
      id = segments[1];
  }

  return id && VIDEO_ID_RE.test(id) ? id : null;
}
