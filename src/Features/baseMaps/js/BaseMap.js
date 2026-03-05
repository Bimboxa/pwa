import { nanoid } from "@reduxjs/toolkit";
import ImageObject from "Features/images/js/ImageObject";
import getDateString from "Features/misc/utils/getDateString";
import db from "App/db/db";
import editor from "App/editor";

function getImageCacheKey(image) {
  if (!image) return null;
  const base =
    image.fileName ||
    image.imageUrlClient ||
    image.imageUrlRemote ||
    image.url ||
    null;
  if (base && image.fileUpdatedAt) return `${base}@${image.fileUpdatedAt}`;
  return base;
}

export default class BaseMap {
  constructor({
    id,
    createdAt,
    projectId,
    listingId,
    name,
    image,
    imageEnhanced,
    showEnhanced,
    meterByPx,
    latLng,
    opacity,
    opacityEnhanced,
    grayScale,
    mainAngleInDeg,
    rotation2D, // in deg
    // version system
    versions,
    refWidth,
    refHeight,
  }) {
    this.id = id;
    this.createdAt = createdAt;
    this.projectId = projectId;
    this.listingId = listingId;
    this.name = name;
    this.image = image;
    this.imageEnhanced = imageEnhanced;
    this.showEnhanced = showEnhanced;
    this.meterByPx = meterByPx;
    this.latLng = latLng;
    this.opacity = opacity;
    this.opacityEnhanced = opacityEnhanced;
    this.grayScale = grayScale;
    this.mainAngleInDeg = mainAngleInDeg;
    this.rotation2D = rotation2D;
    // version system
    this.versions = versions || [];
    this.refWidth = refWidth || null;
    this.refHeight = refHeight || null;
  }

  // STATIC METHOD

  static async create({
    projectId,
    name,
    imageFile,
    image,
    imageEnhancedFile,
    imageEnhanced,
    showEnhanced,
    opacity,
    opacityEnhanced,
    grayScale,
    meterByPx,
    latLng,
    mainAngleInDeg,
    rotation2D,
  }) {
    const baseMap = new BaseMap({
      projectId,
      name,
      image,
      imageEnhanced,
      showEnhanced,
      opacity,
      opacityEnhanced,
      grayScale,
      meterByPx,
      latLng,
      mainAngleInDeg,
      rotation2D,
    });
    await baseMap.initialize({ imageFile, imageEnhancedFile });
    return baseMap;
  }

  static async createFromRecord(record) {

    try {
      if (!record) return null;

      editor.baseMapsCache = editor.baseMapsCache || {};
      const cacheEntry = editor.baseMapsCache[record.id];

      // --- Version system: load ALL version images ---
      if (record.versions?.length > 0) {
        const cachedImages = cacheEntry?.versionImages || {};

        const hydratedVersions = await Promise.all(
          record.versions.map(async (v) => {
            const key = getImageCacheKey(v.image);
            let loadedImage =
              cachedImages[v.id]?.key === key
                ? cachedImages[v.id].image
                : null;

            if (!loadedImage && v.image?.fileName) {
              const fileRecord = await db.files.get(v.image.fileName);
              if (fileRecord) {
                const { fileArrayBuffer, fileMime, fileName } = fileRecord;
                const file = new File([fileArrayBuffer], fileName, {
                  type: fileMime,
                });
                loadedImage = await ImageObject.create({
                  imageFile: file,
                  thumbnail: v.image.thumbnail,
                });
              }
            }

            cachedImages[v.id] = { key, image: loadedImage };
            return { ...v, image: loadedImage || v.image };
          })
        );

        editor.baseMapsCache[record.id] = { versionImages: cachedImages };

        const activeVersion =
          hydratedVersions.find((v) => v.isActive) || hydratedVersions[0];

        const baseMap = new BaseMap({
          ...record,
          versions: hydratedVersions,
          // Legacy fields: keep image from active version for backward compat
          image: activeVersion?.image,
        });

        return baseMap;
      }

      // --- Legacy path: image + imageEnhanced ---
      const imageKey = getImageCacheKey(record.image);
      const imageEnhancedKey = getImageCacheKey(record.imageEnhanced);

      let bmImage =
        cacheEntry && cacheEntry.imageKey === imageKey
          ? cacheEntry.image
          : null;
      let bmImageEnhanced =
        cacheEntry && cacheEntry.imageEnhancedKey === imageEnhancedKey
          ? cacheEntry.imageEnhanced
          : null;

      if (!bmImage && record?.image?.fileName) {
        const fileRecord = await db.files.get(record.image.fileName);
        if (fileRecord) {
          const { fileArrayBuffer, fileMime, fileName } = fileRecord;
          const file = new File([fileArrayBuffer], fileName, {
            type: fileMime,
          });
          bmImage = await ImageObject.create({
            imageFile: file,
            thumbnail: record.image.thumbnail
          });
        }
      }

      if (!bmImageEnhanced && record?.imageEnhanced?.fileName) {
        const fileEnhancedRecord = await db.files.get(
          record.imageEnhanced.fileName
        );
        if (fileEnhancedRecord) {
          const { fileArrayBuffer, fileMime, fileName } = fileEnhancedRecord;
          const fileEnhanced = new File([fileArrayBuffer], fileName, {
            type: fileMime,
          });
          bmImageEnhanced = await ImageObject.create({
            imageFile: fileEnhanced,
            thumbnail: record.imageEnhanced.thumbnail
          });
        }
      }

      editor.baseMapsCache[record.id] = {
        imageKey,
        imageEnhancedKey,
        image: bmImage,
        imageEnhanced: bmImageEnhanced,
      };

      const baseMap = new BaseMap({
        ...record,
        image: bmImage,
        imageEnhanced: bmImageEnhanced,
      });

      return baseMap;
    } catch (e) {
      console.error("debug_0915 error createFromRecord", e);
      return null;
    }
  }

  // INIT

  async initialize({ imageFile, imageEnhancedFile }) {
    if (!this.id) this.id = nanoid();

    if (!this.createdAt) this.createdAt = getDateString(Date.now());

    // imageFile
    if (!this.image && imageFile) {
      this.image = await ImageObject.create({ imageFile: imageFile });
    }

    // imageEnhancedFile
    if (!this.imageEnhanced && imageEnhancedFile) {
      this.imageEnhanced = await ImageObject.create({
        imageFile: imageEnhancedFile,
      });
    }

    if (!this.name && this.image) this.name = this.image.fileName;
  }

  // GETTERS

  getActiveVersion = () => {
    if (this.versions?.length > 0) {
      return this.versions.find((v) => v.isActive) || this.versions[0];
    }
    return null;
  };

  getVersionUrl = (versionId) => {
    const version = this.versions?.find((v) => v.id === versionId);
    if (!version) return null;
    const img = version.image;
    return img?.imageUrlClient ?? img?.imageUrlRemote;
  };

  getUrl = () => {
    const activeVersion = this.getActiveVersion();
    if (activeVersion) {
      const img = activeVersion.image;
      return img?.imageUrlClient ?? img?.imageUrlRemote;
    }
    // Legacy fallback
    const imageToUse = this.showEnhanced && this.imageEnhanced ? this.imageEnhanced : this.image;
    return imageToUse?.imageUrlClient ?? imageToUse?.imageUrlRemote;
  };

  getThumbnail = () => {
    const activeVersion = this.getActiveVersion();
    if (activeVersion) {
      return activeVersion.image?.thumbnail;
    }
    // Legacy fallback
    const imageToUse = this.showEnhanced && this.imageEnhanced ? this.imageEnhanced : this.image;
    return imageToUse?.thumbnail;
  };

  // Returns reference coordinate space (used for annotation resolution)
  getImageSize = () => {
    if (this.versions?.length > 0 && this.refWidth && this.refHeight) {
      return { width: this.refWidth, height: this.refHeight };
    }
    // Legacy fallback
    const imageToUse = this.showEnhanced && this.imageEnhanced ? this.imageEnhanced : this.image;
    return imageToUse?.imageSize;
  };

  // Returns the actual pixel dimensions of the active version's image
  getActiveImageSize = () => {
    const activeVersion = this.getActiveVersion();
    if (activeVersion) {
      return activeVersion.image?.imageSize;
    }
    // Legacy fallback
    const imageToUse = this.showEnhanced && this.imageEnhanced ? this.imageEnhanced : this.image;
    return imageToUse?.imageSize;
  };

  getImageScale = () => {
    const activeVersion = this.getActiveVersion();
    if (activeVersion) {
      return activeVersion.transform?.scale ?? 1;
    }
    // Legacy fallback
    let scale = 1;
    if (this.showEnhanced && this.imageEnhanced && this.image) {
      scale = this.imageEnhanced.imageSize.width / this.image.imageSize.width;
    }
    return scale;
  };

  getImageOffset = () => {
    const activeVersion = this.getActiveVersion();
    if (activeVersion) {
      return {
        x: activeVersion.transform?.x ?? 0,
        y: activeVersion.transform?.y ?? 0,
      };
    }
    // Legacy fallback
    let offset = { x: 0, y: 0 };
    if (this.showEnhanced && this.imageEnhanced && this.image) {
      const scale = this.getImageScale();
      offset = {
        x: (this.image.imageSize.width - this.imageEnhanced.imageSize.width / scale) / 2,
        y: (this.image.imageSize.height - this.imageEnhanced.imageSize.height / scale) / 2,
      };
    }
    return offset;
  }

  getActiveVersionTransform = () => {
    const activeVersion = this.getActiveVersion();
    if (activeVersion) {
      return activeVersion.transform || { x: 0, y: 0, rotation: 0, scale: 1 };
    }
    return { x: 0, y: 0, rotation: 0, scale: 1 };
  };

  getMeterByPx = (options) => {

    const variant = options?.variant; // "imageEnhanced", "image"

    if (!this.meterByPx) return null;

    // if (this.showEnhanced && this.imageEnhanced && this.image || variant === "imageEnhanced") {
    //   return this.meterByPx * 1 / (this.imageEnhanced.imageSize.width / this.image.imageSize.width);
    // }
    return this.meterByPx;
  };

  // SERIALIZER

  toJSON() {
    const json = {
      id: this.id,
      createdAt: this.createdAt,
      projectId: this.projectId,
      name: this.name,
      meterByPx: this.meterByPx,
      opacity: this.opacity,
      grayScale: this.grayScale,
      latLng: this.latLng,
      mainAngleInDeg: this.mainAngleInDeg,
      rotation2D: this.rotation2D,
    };

    if (this.versions?.length > 0) {
      json.versions = this.versions.map((v) => ({
        ...v,
        image: v.image?.toJSON ? v.image.toJSON() : v.image,
      }));
      json.refWidth = this.refWidth;
      json.refHeight = this.refHeight;
    }

    // Legacy fields (kept for backward compat)
    json.image = this.image?.toJSON ? this.image.toJSON() : this.image;
    json.imageEnhanced = this.imageEnhanced?.toJSON
      ? this.imageEnhanced.toJSON()
      : this.imageEnhanced;
    json.showEnhanced = this.showEnhanced;
    json.opacityEnhanced = this.opacityEnhanced;

    return json;
  }

  toKonva = () => {
    const url = this.getUrl();
    const imageSize = this.getImageSize();
    return {
      id: this.id,
      url,
      width: imageSize?.width,
      height: imageSize?.height,
      nodeType: "MAP",
    };
  };
}
