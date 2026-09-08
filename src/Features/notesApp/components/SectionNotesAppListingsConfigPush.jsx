import { useState } from "react";

import { Box, Typography } from "@mui/material";

import ButtonInPanel from "Features/layout/components/ButtonInPanel";
import useBusinessObjectListings from "Features/businessObjects/hooks/useBusinessObjectListings";

import useNotesAppScopeLink from "../hooks/useNotesAppScopeLink";
import usePushNotesAppListingsConfig from "../hooks/usePushNotesAppListingsConfig";
import { isListingConfigDirty } from "../utils/getNotesAppListingConfigSignature";

// Sync panel section: the scope's business-object listings with their link
// status and one button pushing the configuration of the unlinked or
// locally-modified ones to Krnet (entity model, settings, state models).
export default function SectionNotesAppListingsConfigPush({
  appName = "Krnet",
}) {
  // strings

  const titleS = `Configuration des listes → ${appName}`;
  const helperS = "Envoie les champs, listes d'état et codification";
  const emptyS = "Aucune liste d'ouvrages dans la mission.";
  const linkedS = "Lié";
  const notLinkedS = "Non lié";
  const dirtyS = "À envoyer";
  const pushS = "Envoyer la configuration";
  const upToDateS = "Configuration à jour";
  const lastPullS = "Dernière récupération";
  const adviceS =
    "Synchronisez d'abord pour ne pas écraser des modifications faites dans l'application mobile.";

  // data

  const { link } = useNotesAppScopeLink();
  const listings = (useBusinessObjectListings() ?? []).filter(
    (l) => !l.deletedAt
  );
  const pushConfig = usePushNotesAppListingsConfig();

  // state

  const [pushing, setPushing] = useState(false);

  // helpers

  const toPush = listings.filter((l) => !l.idMaster || isListingConfigDirty(l));
  const lastSyncAtS = link?.lastSyncAt
    ? new Date(link.lastSyncAt).toLocaleString("fr-FR")
    : null;

  function statusOf(l) {
    if (!l.idMaster) return notLinkedS;
    if (isListingConfigDirty(l)) return dirtyS;
    return linkedS;
  }

  // handlers

  async function handlePush() {
    if (pushing) return;
    setPushing(true);
    try {
      await pushConfig({});
    } finally {
      setPushing(false);
    }
  }

  // render

  if (!link?.projectId) return null;

  return (
    <Box sx={{ p: 1 }}>
      <Typography variant="body2" sx={{ fontWeight: "bold" }}>
        {titleS}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mb: 1 }}
      >
        {helperS}
      </Typography>
      {listings.length === 0 ? (
        <Typography variant="caption" color="text.disabled">
          {emptyS}
        </Typography>
      ) : (
        listings.map((l) => (
          <Box
            key={l.id}
            sx={{
              display: "flex",
              justifyContent: "space-between",
              gap: 1,
              py: 0.25,
            }}
          >
            <Typography variant="body2" noWrap>
              {l.name}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color:
                  statusOf(l) === dirtyS ? "warning.main" : "text.secondary",
                flexShrink: 0,
              }}
            >
              {statusOf(l)}
            </Typography>
          </Box>
        ))
      )}
      {lastSyncAtS && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 1 }}
        >
          {`${lastPullS} : ${lastSyncAtS}`}
        </Typography>
      )}
      {toPush.length > 0 && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block" }}
        >
          {adviceS}
        </Typography>
      )}
      <ButtonInPanel
        label={toPush.length > 0 ? `${pushS} (${toPush.length})` : upToDateS}
        onClick={handlePush}
        loading={pushing}
        disabled={pushing || toPush.length === 0}
      />
    </Box>
  );
}
