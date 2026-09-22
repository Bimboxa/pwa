import { useDispatch } from "react-redux";

import db from "App/db/db";

import {
  openRegenerateBaseMap,
  setPdfFile,
} from "Features/baseMapCreator/baseMapCreatorSlice";
import { resolveDetailResource } from "Features/baseMaps/services/detailBaseMapUtils";

// Opens the base map creator in "regenerate" mode on the stored PDF page of
// a base map (see baseMapCreatorSlice.openRegenerateBaseMap).
export default function useOpenRegenerateBaseMap() {
  const dispatch = useDispatch();

  return async (baseMap) => {
    const record = await db.baseMaps.get(baseMap?.id);
    if (!record?.createdFrom?.resourceId) return false;
    const resource = await resolveDetailResource({
      createdFrom: record.createdFrom,
      projectId: record.projectId,
    });
    if (!resource) return false;
    const fileRecord = await db.files.get(resource.fileName);
    if (!fileRecord?.fileArrayBuffer) return false;

    const file = new File([fileRecord.fileArrayBuffer], resource.name, {
      type: fileRecord.fileMime || "application/pdf",
    });
    dispatch(setPdfFile(file));
    dispatch(
      openRegenerateBaseMap({
        baseMapId: record.id,
        baseMapName: record.name,
        createdFrom: record.createdFrom,
      })
    );
    return true;
  };
}
