import { useEffect } from "react";

import { useSelector, useDispatch } from "react-redux";

import { setSelectedBaseMapViewIdInEditor } from "../baseMapViewsSlice";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

export default function useAutoSelectBaseMapViewInEditor() {
  const dispatch = useDispatch();

  // data

  const id = useSelector((s) => s.baseMapViews.selectedBaseMapViewIdInEditor);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);

  const defaultViewRecord = useLiveQuery(async () => {
    const views = await db.baseMapViews
      .where("scopeId")
      .equals(scopeId)
      .toArray();
    return views?.[0];
  }, [scopeId]);

  // effect

  useEffect(() => {
    console.log("[EFFECT] setBaseMapViewId", defaultViewRecord?.name);
    dispatch(setSelectedBaseMapViewIdInEditor(defaultViewRecord?.id));
  }, [id, scopeId, defaultViewRecord?.id]);
}
