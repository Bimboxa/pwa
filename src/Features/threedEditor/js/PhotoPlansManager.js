import {
  DoubleSide,
  Group,
  Matrix3,
  Matrix4,
  Mesh,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
  Vector3,
} from "three";

import getTextureAsync from "./utilsImagesManager/getTextureAsync";

// Renders each CALIBRATED photoPlan as a textured plane in the scene: the
// geometry is the plan's source polygon mapped into its metric frame (the
// mask is the geometry boundary itself), posed in world by the calibration's
// pose, and textured with the ORIGINAL photo through the inverse homography
// applied PER FRAGMENT — exact perspective mapping, no subdivision (affine
// per-triangle UVs would visibly bend a homography).
//
// Driven by useAutoLoadPhotoPlansInThreedEditor (setPhotoPlans). Objects are
// intentionally NOT annotations: they live in their own objectsMap, are
// excluded from the render-mode material lifecycle, and are added to the
// export whitelist explicitly (buildExportScene).

const photoPlanVertexShader = /* glsl */ `
  varying vec2 vPlane;
  void main() {
    vPlane = position.xy; // geometry local frame = plane-local (u, v) meters
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const photoPlanFragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform mat3 uHinv;
  uniform float uOpacity;
  varying vec2 vPlane;
  void main() {
    vec3 ph = uHinv * vec3(vPlane, 1.0);
    if (abs(ph.z) < 1e-9) discard;
    vec2 photoUv = ph.xy / ph.z; // normalized photo coords, y DOWN
    if (photoUv.x < 0.0 || photoUv.x > 1.0 || photoUv.y < 0.0 || photoUv.y > 1.0) {
      discard;
    }
    vec4 c = texture2D(uMap, vec2(photoUv.x, 1.0 - photoUv.y));
    gl_FragColor = vec4(c.rgb, c.a * uOpacity);
    #include <colorspace_fragment>
  }
`;

export default class PhotoPlansManager {
  constructor({ sceneManager }) {
    this.sceneManager = sceneManager;
    this.scene = sceneManager.scene;
    this.objectsMap = {}; // photoPlanId -> posed Group
    this._signature = null;
    this._texturePromiseByUrl = {};
  }

  _getTexture(url) {
    if (!this._texturePromiseByUrl[url]) {
      this._texturePromiseByUrl[url] = getTextureAsync(url).catch((e) => {
        delete this._texturePromiseByUrl[url];
        throw e;
      });
    }
    return this._texturePromiseByUrl[url];
  }

  // items: [{ id, signature, pose, Hinv (flat row-major 9), imageUrl,
  //           ringLocal: [{x, y}], holesLocal: [[{x, y}]] }]
  // Full rebuild on signature change — photoPlans are few per project.
  setPhotoPlans(items) {
    const signature = (items ?? []).map((i) => i.signature).join("|");
    if (signature === this._signature) return;
    this._signature = signature;

    this.deleteAllObjects();
    (items ?? []).forEach((item) => this._createObject(item));
    this.sceneManager.requestRender?.();
  }

  _createObject(item) {
    const { id, pose, Hinv, imageUrl, ringLocal, holesLocal } = item;
    if (!pose || !Hinv || !imageUrl || !ringLocal || ringLocal.length < 3) {
      return;
    }

    const shape = new Shape(ringLocal.map((p) => ({ x: p.x, y: p.y })));
    for (const hole of holesLocal ?? []) {
      if (hole?.length >= 3) {
        const holePath = new Shape(hole.map((p) => ({ x: p.x, y: p.y })));
        shape.holes.push(holePath);
      }
    }
    const geometry = new ShapeGeometry(shape);

    const material = new ShaderMaterial({
      uniforms: {
        uMap: { value: null },
        uHinv: { value: new Matrix3().set(...Hinv) },
        uOpacity: { value: 1 },
      },
      vertexShader: photoPlanVertexShader,
      fragmentShader: photoPlanFragmentShader,
      side: DoubleSide,
      // Push the photo surface slightly back so flat reconstructed
      // annotations lying ON the plane never z-fight with it.
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });

    const mesh = new Mesh(geometry, material);
    mesh.userData.isPhotoPlanSurface = true;

    const group = new Group();
    const { origin, uDir, vDir, normal } = pose;
    const m = new Matrix4().makeBasis(
      new Vector3(uDir.x, uDir.y, uDir.z),
      new Vector3(vDir.x, vDir.y, vDir.z),
      new Vector3(normal.x, normal.y, normal.z)
    );
    m.setPosition(origin.x, origin.y, origin.z);
    m.decompose(group.position, group.quaternion, group.scale);
    group.add(mesh);
    group.userData = { isPhotoPlanSurface: true, photoPlanId: id };

    this.objectsMap[id] = group;
    this.scene.add(group);

    this._getTexture(imageUrl)
      .then((texture) => {
        // The rebuild may have replaced/removed the object meanwhile.
        if (this.objectsMap[id] !== group) return;
        material.uniforms.uMap.value = texture;
        this.sceneManager.requestRender?.();
      })
      .catch((e) => {
        console.error("[PhotoPlansManager] texture load failed", e);
      });
  }

  deleteAllObjects() {
    Object.values(this.objectsMap).forEach((group) => {
      group.parent?.remove(group);
      group.traverse?.((child) => {
        if (child.geometry) child.geometry.dispose();
        // Textures are shared per url (cache) — dispose materials only.
        if (child.material) child.material.dispose();
      });
    });
    this.objectsMap = {};
  }
}
