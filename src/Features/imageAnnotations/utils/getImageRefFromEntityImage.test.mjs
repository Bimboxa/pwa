import assert from "node:assert/strict";
import { test } from "node:test";
import getImageRefFromEntityImage from "./getImageRefFromEntityImage.js";

test("hydrated template image keeps only the persistent reference", () => {
  const ref = getImageRefFromEntityImage({
    fileName: "image_t1.png",
    isImage: true,
    imageSize: { width: 300, height: 200 },
    thumbnail: "data:image/png;base64,xx",
    fileUpdatedAt: "2026-01-01",
    imageUrlClient: "blob:http://x/1",
    file: { fileName: "image_t1.png", fileArrayBuffer: new ArrayBuffer(8) },
  });
  assert.deepEqual(ref, {
    isImage: true,
    fileName: "image_t1.png",
    imageSize: { width: 300, height: 200 },
    thumbnail: "data:image/png;base64,xx",
    fileUpdatedAt: "2026-01-01",
  });
});

test("freshly picked File is kept together with its preview url", () => {
  const file = new File(["x"], "crane.png", { type: "image/png" });
  const ref = getImageRefFromEntityImage({
    file,
    imageUrlClient: "blob:http://x/2",
    imageSize: { width: 10, height: 5 },
    isImage: true,
  });
  assert.equal(ref.file, file);
  assert.equal(ref.imageUrlClient, "blob:http://x/2");
  assert.equal(ref.fileName, undefined);
});

test("empty or fileless objects resolve to null", () => {
  assert.equal(getImageRefFromEntityImage(null), null);
  assert.equal(getImageRefFromEntityImage({ imageUrlClient: "blob:x" }), null);
});
