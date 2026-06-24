import { useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";
import { canEditRecord } from "App/db/ownership";
import getUserIdMaster from "Features/auth/utils/getUserIdMaster";

export const PERMISSION_MESSAGE =
  "Vous ne pouvez pas modifier un objet dont vous n'êtes pas le créateur";

/**
 * Shared ownership permission hook (UI layer).
 *
 * Mirrors the hard guard enforced in the DB layer (App/db/db.js) so buttons can
 * be disabled and a toast shown before the action even reaches Dexie.
 *
 * @returns {{
 *   currentUserId: string,
 *   canEditRecord: (record: object) => boolean,
 *   guardEditRecord: (record: object) => boolean // toasts + returns false if denied
 * }}
 */
export default function useCanEditRecord() {
  const dispatch = useDispatch();
  const currentUserId = useSelector((state) =>
    getUserIdMaster(state.auth.userProfile)
  );

  const canEdit = useCallback(
    (record) => canEditRecord(record, currentUserId),
    [currentUserId]
  );

  const guardEditRecord = useCallback(
    (record) => {
      if (canEditRecord(record, currentUserId)) return true;
      dispatch(setToaster({ message: PERMISSION_MESSAGE, isError: true }));
      return false;
    },
    [currentUserId, dispatch]
  );

  return { currentUserId, canEditRecord: canEdit, guardEditRecord };
}
