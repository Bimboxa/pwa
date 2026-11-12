// Run: node src/Features/comments/utils/commentsUtils.test.mjs
import assert from "node:assert/strict";

import parseYoutubeVideoId from "./parseYoutubeVideoId.js";
import normalizeLinkUrl from "./normalizeLinkUrl.js";

// parseYoutubeVideoId
const ID = "dQw4w9WgXcQ";
for (const url of [
  `https://www.youtube.com/watch?v=${ID}`,
  `https://youtube.com/watch?v=${ID}&t=42s`,
  `https://m.youtube.com/watch?feature=share&v=${ID}`,
  `https://youtu.be/${ID}`,
  `https://youtu.be/${ID}?si=abc`,
  `youtu.be/${ID}`,
  `https://www.youtube.com/shorts/${ID}`,
  `https://www.youtube.com/embed/${ID}`,
  `https://www.youtube-nocookie.com/embed/${ID}`,
  `https://www.youtube.com/live/${ID}?feature=share`,
  `  https://www.youtube.com/watch?v=${ID}  `,
]) {
  assert.equal(parseYoutubeVideoId(url), ID, url);
}
for (const url of [
  "",
  null,
  undefined,
  "not a url",
  "https://vimeo.com/123456789",
  "https://www.youtube.com/",
  "https://www.youtube.com/watch?v=short",
  "https://www.youtube.com/channel/UCxxxxxxxxxxx",
  `https://evil.example.com/watch?v=${ID}`,
]) {
  assert.equal(parseYoutubeVideoId(url), null, String(url));
}

// normalizeLinkUrl
assert.equal(normalizeLinkUrl("example.com"), "https://example.com/");
assert.equal(normalizeLinkUrl(" https://a.b/c?d=1 "), "https://a.b/c?d=1");
assert.equal(normalizeLinkUrl("http://a.b"), "http://a.b/");
assert.equal(normalizeLinkUrl(""), null);
assert.equal(normalizeLinkUrl(null), null);
assert.equal(normalizeLinkUrl("javascript:alert(1)"), null);
assert.equal(normalizeLinkUrl("mailto:a@b.c"), null);

console.log("comments utils: all tests passed");
