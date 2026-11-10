import { useDispatch } from "react-redux";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import setAnnotationsBlockService from "../services/setAnnotationsBlockService";

// Returns async ({annotationIds, blockId}) => linked ids. blockId null unlinks.
export default function useSetAnnotationsBlock() {
  const dispatch = useDispatch();

  return async function setAnnotationsBlock({ annotationIds, blockId }) {
    const ids = await setAnnotationsBlockService({ annotationIds, blockId });
    if (ids.length > 0) dispatch(triggerAnnotationsUpdate());
    return ids;
  };
}
