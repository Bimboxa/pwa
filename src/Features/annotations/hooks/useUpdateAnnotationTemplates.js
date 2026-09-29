import { useDispatch } from "react-redux";

import {
  triggerAnnotationsUpdate,
  triggerAnnotationTemplatesUpdate,
} from "../annotationsSlice";

import useUserEmail from "Features/auth/hooks/useUserEmail";

import db from "App/db/db";

// Batch variant of useUpdateAnnotationTemplate for plain field updates
// (no images / files handling): one Dexie transaction + one refresh,
// instead of N sequential updateEntity calls each re-rendering the view.
export default function useUpdateAnnotationTemplates() {
  const dispatch = useDispatch();
  const { value: userEmail } = useUserEmail();

  return async (updatesArray) => {
    if (!updatesArray?.length) return;

    await db.transaction("rw", [db.annotationTemplates], async () => {
      await Promise.all(
        // `hidden` is per-scope local state (scopeVisibility slice), never
        // written to the row.
        // eslint-disable-next-line no-unused-vars
        updatesArray.map(({ id, hidden, ...fields }) =>
          db.annotationTemplates.update(id, {
            ...fields,
            updatedBy: userEmail,
          })
        )
      );
    });

    dispatch(triggerAnnotationTemplatesUpdate());
    dispatch(triggerAnnotationsUpdate());
  };
}
