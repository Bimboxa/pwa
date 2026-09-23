import { useDispatch } from "react-redux";

import db from "App/db/db";

import {
  setOpenBaseMapCreator,
  setPdfFile,
  setPdfSourceResource,
} from "../baseMapCreatorSlice";

// Opens the base map creator (page + crop) on a PDF stored in the project
// resources, as if the file had been picked from the computer. The source
// resource is kept in the slice so ButtonCreateBaseMaps can reuse a
// PDF_PAGE resource instead of extracting it again.
// Returns false when the resource file is missing (post-Krto import).
export default function useOpenBaseMapCreatorFromResource() {
  const dispatch = useDispatch();

  return async (resource) => {
    if (!resource?.fileName) return false;
    const fileRecord = await db.files.get(resource.fileName);
    if (!fileRecord?.fileArrayBuffer) return false;

    const file = new File([fileRecord.fileArrayBuffer], resource.name, {
      type: fileRecord.fileMime || "application/pdf",
    });
    dispatch(setPdfFile(file));
    dispatch(
      setPdfSourceResource({
        id: resource.id,
        kind: resource.kind ?? null,
        name: resource.name,
      })
    );
    dispatch(setOpenBaseMapCreator(true));
    return true;
  };
}
