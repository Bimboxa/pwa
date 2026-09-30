import { useDispatch } from "react-redux";

import { openPdfEditor } from "../pdfEditorSlice";
import { setSelectedResourceId } from "Features/resources/resourcesSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import isWholeResourceRel from "Features/businessObjects/utils/isWholeResourceRel";

// Opens the resource of a document link (db.relsBusinessObjectResource row,
// already resolved to its `resource`):
// - PDF: the PDF editor layer, at the page and highlighted passage of the
//   link (page 1 for a whole-resource link);
// - any other file (image, DWG…): the RESOURCES panel, as before.
export default function useOpenResourceRel() {
  const dispatch = useDispatch();

  return function openResourceRel(rel, resource) {
    if (!rel || !resource) return;

    if (resource.fileType === "PDF") {
      const isWhole = isWholeResourceRel(rel);
      dispatch(
        openPdfEditor({
          resourceId: resource.id,
          pageNumber: isWhole ? 1 : rel.pageNumber,
          highlightId: isWhole ? null : rel.id,
        })
      );
      return;
    }

    dispatch(setSelectedResourceId(resource.id));
    dispatch(setSelectedMenuItemKey("RESOURCES"));
  };
}
