import { useDispatch, useSelector, useStore } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { Box, Typography } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";

import db from "App/db/db";
import appTheme from "Styles/theme";

import SectionListingProcedures from "Features/annotationsAuto/components/SectionListingProcedures";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useReadOnlyScope from "Features/scopes/hooks/useReadOnlyScope";
import { isPromptIaProcedure } from "Features/promptIa/utils/promptIaProcedure";
import ensureCommentDrawModule from "../utils/ensureCommentDrawModule";

// PROCEDURE_ACTION block of an info: the "Dessin auto" band of a listing
// (SectionListingProcedures, as in PopperMapListings) locked on one of its
// procedures — same launch / update / delete-outputs behaviour, on the
// displayed base map. The band and the dialogs it opens keep the app's light
// theme inside the dark info panel. Launching first sends the reader to a
// module that draws. `interactive: false` (editor preview), the viewer mode
// and a read-only scope keep the band inert.
export default function CommentBlockProcedureAction({
  block,
  sourceModuleKey = null,
  interactive = true,
}) {
  const dispatch = useDispatch();
  const store = useStore();

  // strings

  const missingS = "Procédure de dessin auto introuvable";

  // data

  const listingId = block.listingId ?? null;
  const procedureKey = block.procedureKey ?? null;

  const appConfig = useAppConfig();
  // undefined while loading, null when missing
  const listing = useLiveQuery(async () => {
    if (!listingId) return null;
    const row = await db.listings.get(listingId);
    return row && !row.deletedAt ? row : null;
  }, [listingId]);
  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const viewerMode = useSelector((s) => s.urlParams.viewerMode);
  const { isReadOnly } = useReadOnlyScope();

  // helpers

  const isLinked =
    Boolean(listing) &&
    Boolean(procedureKey) &&
    (isPromptIaProcedure({ key: procedureKey })
      ? Boolean(listing.promptIaEnabled)
      : (listing.procedureKeys ?? []).includes(procedureKey) &&
        (appConfig?.automatedAnnotationsProcedures ?? []).some(
          (p) => p.key === procedureKey
        ));
  const disabled = !interactive || Boolean(viewerMode || isReadOnly);

  // handlers

  function handleBeforePlay(procedure) {
    ensureCommentDrawModule({
      store,
      dispatch,
      sourceModuleKey,
      // the source is drawn, and its params dialog opened, in the 2D editor
      needs2dEditor: Boolean(procedure?.drawSourceOnLaunch),
    });
  }

  // render

  if (listing === undefined || !appConfig) return null;

  if (!isLinked) {
    return (
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        {missingS}
      </Typography>
    );
  }

  return (
    <ThemeProvider theme={appTheme}>
      <Box sx={{ color: "text.primary" }}>
        <SectionListingProcedures
          listingId={listingId}
          baseMapId={baseMapId}
          procedureKey={procedureKey}
          disabled={disabled}
          onBeforePlay={handleBeforePlay}
          sx={{ bgcolor: "transparent", px: 0, py: 0 }}
        />
      </Box>
    </ThemeProvider>
  );
}
