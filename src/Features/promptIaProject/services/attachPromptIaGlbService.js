import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";
import parseScene3dGlb, {
  disposeScene3dGlbModel,
} from "Features/scene3d/js/parseScene3dGlb";
import { seedScene3dGlb } from "Features/scene3d/services/scene3dGlbCache";
import {
  getScene3dGlbFileName,
  saveScene3dGlbFileService,
} from "Features/scene3d/services/scene3dGlbFileService";
import { getScene3dGlbBaseMapDescriptor } from "Features/scene3d/utils/getScene3dBaseMapDescriptor";

export default async function attachPromptIaGlbService({
  record,
  scene,
  projectId,
}) {
  const {
    modelFile,
    bounds: [minX, minY, maxX, maxY],
    baseZ,
  } = scene;
  const { width, height } = record.image?.imageSize ?? {
    width: record.refWidth,
    height: record.refHeight,
  };
  const aspect = (maxX - minX) / (maxY - minY);
  if (
    !(width > 0 && height > 0) ||
    Math.abs(aspect / (width / height) - 1) > 0.01
  ) {
    throw new Error(
      "Le cadre du GLB doit avoir les proportions du fond de plan."
    );
  }

  const model = await parseScene3dGlb(await modelFile.arrayBuffer());
  try {
    const sceneId = nanoid();
    const glbFileName = getScene3dGlbFileName(sceneId);
    const scene3d = getScene3dGlbBaseMapDescriptor({
      descriptor: {
        ...model,
        sceneId,
        srcFileName: modelFile.name,
        fileBytes: modelFile.size,
      },
      glbFileName,
      polygon: [
        [minX, minY],
        [maxX, minY],
        [maxX, maxY],
        [minX, maxY],
      ],
      rotationDeg: 0,
    });
    scene3d.relativeToBaseMap = true;
    if (baseZ != null) scene3d.zone.zMin = baseZ;
    await db.transaction("rw", [db.files, db.baseMaps], async () => {
      const current = await db.baseMaps.get(record.id);
      if (!current || current.deletedAt)
        throw new Error("Fond de plan introuvable.");
      await saveScene3dGlbFileService({
        fileName: glbFileName,
        file: modelFile,
        projectId,
      });
      await db.baseMaps.update(record.id, { scene3d });
    });
    seedScene3dGlb(glbFileName, model);
    return { ...record, scene3d };
  } catch (error) {
    disposeScene3dGlbModel(model);
    throw error;
  }
}
