import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.."
);
const bundle = await build({
  stdin: {
    contents:
      'export {default} from "Features/imageAnnotations/services/createImageAnnotationCard";',
    resolveDir: root,
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  plugins: [
    {
      name: "texture",
      setup(b) {
        b.onResolve({ filter: /createImageAnnotation3D$/ }, () => ({
          path: "texture",
          namespace: "mock",
        }));
        b.onLoad({ filter: /.*/, namespace: "mock" }, () => ({
          contents:
            "export const getImageAnnotationTextureAsync=()=>new Promise(resolve=>globalThis.__resolveImage=resolve);",
        }));
        b.onResolve({ filter: /^Features\// }, (a) => ({
          path: path.join(root, "src", a.path + ".js"),
        }));
      },
    },
  ],
});
const { default: createCard } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text + "\n//# sourceURL=imageCard.bundle.js").toString("base64")}`
);

for (const orientation of ["VERTICAL", "HORIZONTAL"]) {
  test(`${orientation} card keeps image, text, geometry and cleanup together`, async (t) => {
    const text = [];
    let draws = 0;
    let photoRect;
    const ctx = {
      measureText: (s) => ({ width: s.length * 7 }),
      fillText: (s) => text.push(s),
      drawImage: (_image, ...rect) => {
        draws++;
        photoRect = rect;
      },
      setTransform() {},
      clearRect() {},
      beginPath() {},
      roundRect() {},
      fill() {},
      stroke() {},
      save() {},
      restore() {},
      translate() {},
      scale() {},
      fillRect() {},
      arc() {},
      clip() {},
    };
    // Photo inset inside the white frame + transparent shadow margin
    // (frame 10 + shadow 24, see createImageAnnotationCard).
    const inset = 34;
    globalThis.document = { createElement: () => ({ getContext: () => ctx }) };
    t.after(() => {
      delete globalThis.document;
      delete globalThis.__resolveImage;
    });
    const card = createCard(
      {
        id: "photo",
        label: "Kitchen",
        labelDescription: "Drain under the sink",
        bbox: { width: 200, height: 100 },
        rotation: 30,
        imageOrientation3d: orientation,
        image: { imageSize: { width: 300, height: 400 } },
      },
      { meterByPx: 0.01 }
    );
    assert.equal(card.userData.imageOrientation3d, orientation);
    assert.ok(text.includes("Kitchen"));
    assert.ok(text.includes("Drain under the sink"));
    if (orientation === "HORIZONTAL") {
      assert.equal(card.isMesh, true);
      // Physical width = canvas width scaled so the PHOTO spans 2 m.
      assert.ok(
        Math.abs(
          card.geometry.parameters.width - (2 * (260 + 2 * inset)) / 260
        ) < 1e-9
      );
      assert.ok(Math.abs(card.rotation.z + Math.PI / 6) < 1e-9);
    } else {
      assert.equal(card.isSprite, true);
      assert.equal(card.material.sizeAttenuation, true);
      assert.ok(Math.abs(card.scale.x - (2 * (260 + 2 * inset)) / 260) < 1e-9);
    }
    globalThis.__resolveImage({ image: { width: 300, height: 400 } });
    await Promise.resolve();
    assert.equal(draws, 1);
    // The photo sits inside the frame and occupies exactly the placed 2D
    // dimensions (2 m × 1 m), excluding frame, shadow and text.
    assert.deepEqual(photoRect, [inset, inset, 260, 130]);
    const cardHeight =
      orientation === "HORIZONTAL"
        ? card.geometry.parameters.height
        : card.scale.y;
    const canvasHeight = card.material.map.image.height / 2;
    assert.ok(Math.abs((cardHeight * photoRect[3]) / canvasHeight - 1) < 1e-9);
    // A photo without a caption only adds the frame and shadow margins.
    const bareCard = createCard(
      {
        bbox: { width: 200, height: 100 },
        imageOrientation3d: orientation,
        image: { imageSize: { width: 300, height: 400 } },
      },
      { meterByPx: 0.01 }
    );
    assert.equal(bareCard.material.map.image.height, (130 + 2 * inset) * 2);
    const bareHeight =
      orientation === "HORIZONTAL"
        ? bareCard.geometry.parameters.height
        : bareCard.scale.y;
    assert.ok(Math.abs(bareHeight - (130 + 2 * inset) / 130) < 1e-9);
    bareCard.userData.dispose();
    let disposed = false;
    card.material.map.addEventListener("dispose", () => (disposed = true));
    card.userData.dispose();
    assert.equal(disposed, true);
  });
}
