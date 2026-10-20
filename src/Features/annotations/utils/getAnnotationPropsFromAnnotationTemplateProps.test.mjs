import assert from "node:assert/strict";
import { test } from "node:test";

import getAnnotationPropsFromAnnotationTemplateProps from "./getAnnotationPropsFromAnnotationTemplateProps.js";

// A vertical face drawn in 3D from a POLYGON template: a POLYLINE row that
// carries the fill copied at creation and a stale stroke.
const verticalFace = {
  id: "a1",
  type: "POLYLINE",
  fillColor: "#ffcc00",
  fillOpacity: 0.75,
  strokeColor: "#ffcc00",
  strokeOpacity: 1,
};

const polygonTemplateProps = {
  fillColor: "#0000ff",
  fillOpacity: 0.5,
  strokeColor: "#e85426",
  strokeOpacity: 1,
  colorChannel: "FILL",
};

test("FILL template + POLYLINE row, fill locked: stroke mirrors the template fill", () => {
  const result = getAnnotationPropsFromAnnotationTemplateProps(verticalFace, {
    ...polygonTemplateProps,
    overrideFields: [
      "fillColor",
      "fillOpacity",
      "strokeColor",
      "strokeOpacity",
    ],
  });
  assert.equal(result.fillColor, "#0000ff");
  assert.equal(result.strokeColor, "#0000ff");
  assert.equal(result.strokeOpacity, 0.5);
});

test("FILL template + POLYLINE row, fill unlocked: stroke mirrors the row's own fill", () => {
  const result = getAnnotationPropsFromAnnotationTemplateProps(verticalFace, {
    ...polygonTemplateProps,
    overrideFields: ["strokeColor", "strokeOpacity"],
  });
  assert.equal(result.fillColor, "#ffcc00");
  assert.equal(result.strokeColor, "#ffcc00");
  assert.equal(result.strokeOpacity, 0.75);
});

test("FILL template + STRIP row: same mirror", () => {
  const result = getAnnotationPropsFromAnnotationTemplateProps(
    { ...verticalFace, type: "STRIP" },
    { ...polygonTemplateProps, overrideFields: ["fillColor"] }
  );
  assert.equal(result.strokeColor, "#0000ff");
});

test("STROKE template + POLYGON row: fill mirrors the stroke", () => {
  const result = getAnnotationPropsFromAnnotationTemplateProps(
    { id: "a2", type: "POLYGON", fillColor: "#111111", strokeColor: "#222222" },
    {
      strokeColor: "#00ff00",
      strokeOpacity: 0.6,
      colorChannel: "STROKE",
      overrideFields: ["strokeColor", "strokeOpacity"],
    }
  );
  assert.equal(result.fillColor, "#00ff00");
  assert.equal(result.fillOpacity, 0.6);
});

test("FILL template + POLYGON row: nothing mirrored", () => {
  const result = getAnnotationPropsFromAnnotationTemplateProps(
    { ...verticalFace, type: "POLYGON", strokeColor: "#123456" },
    { ...polygonTemplateProps, overrideFields: ["fillColor"] }
  );
  assert.equal(result.fillColor, "#0000ff");
  assert.equal(result.strokeColor, "#123456");
});

test("no colour channel (both edited, or no template): row untouched, colorChannel never copied", () => {
  const both = getAnnotationPropsFromAnnotationTemplateProps(verticalFace, {
    ...polygonTemplateProps,
    colorChannel: null,
    overrideFields: ["fillColor", "colorChannel"],
  });
  assert.equal(both.strokeColor, "#ffcc00");
  assert.equal("colorChannel" in both, false);

  const none = getAnnotationPropsFromAnnotationTemplateProps(
    verticalFace,
    null
  );
  assert.equal(none.strokeColor, "#ffcc00");
});

test("FILL template + POLYLINE row without any fillColor: stroke kept", () => {
  const result = getAnnotationPropsFromAnnotationTemplateProps(
    { id: "a3", type: "POLYLINE", strokeColor: "#abcdef" },
    { colorChannel: "FILL", overrideFields: [] }
  );
  assert.equal(result.strokeColor, "#abcdef");
});
