import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setPendingProcedureLaunch } from "Features/annotationsAuto/annotationsAutoSlice";
import { setToaster } from "Features/layout/layoutSlice";

import {
  Box,
  Button,
  ButtonBase,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Switch,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { AutoFixHigh, Bolt } from "@mui/icons-material";

import useObjectsLibrary from "Features/objectsLibrary/hooks/useObjectsLibrary";
import useObjectsTargetListings from "Features/objectsLibrary/hooks/useObjectsTargetListings";
import useSystemDefinition from "Features/objectsLibrary/hooks/useSystemDefinition";
import SelectorListingForObjects from "Features/objectsLibrary/components/SelectorListingForObjects";

// "Associer un système à l'axe": picker of the systems (château d'eau,
// réservoir…) a plan REVOLUTION_AXIS can still be associated to — one
// selectable row per system, resolved from the objects library "Systèmes"
// entry carrying the procedure key (thumbnail, label) with the registry entry
// as fallback. The first system is pre-selected.
//
// Destination of the generated templates: by default a NEW listing named by
// the procedure (registry `targetListingName`, e.g. "Repérage Château
// d'eau") — reused when the scope already holds a listing of that name —
// or, with the "listing existant" switch on, a listing of the scope picked
// in the selector.
//
// "Associer" WRITES NOTHING: it arms the system's params dialog on the axis
// (pendingProcedureLaunch → ProcedureAutoLaunchDialogOutlet) with the
// destination as `systemSetup` (library object, generated templates, listing
// id or name to create). The listing (if new) and the missing templates are
// created by the outlet on "Lancer" only — right before the run, which
// resolves its pieces listing through them. Confirming that dialog persists
// the cotes on the axis (procedureParams[procedureKey]) — the association
// mark — and runs the procedure; cancelling it leaves the axis unassociated
// and the scope untouched (no listing, no templates).
//
// Mount only while open (the library manifest loads on mount).

// strings

const TITLE = "Associer un système à l'axe";
const DESCRIPTION =
  "Choisissez le système à générer autour de cet axe. Ses cotes sont saisies à l'étape suivante.";
const NO_SYSTEM = "Aucun système disponible pour cet axe.";
const DESTINATION_TITLE = "Modèles d'annotations";
const NEW_LISTING_TEXT = (name) =>
  `Les modèles d'annotations seront créés dans un nouveau listing « ${name} ».`;
const REUSED_LISTING_TEXT = (name) =>
  `Les modèles d'annotations seront créés dans le listing existant « ${name} ».`;
const USE_EXISTING_LABEL = "Créer les annotations dans un listing existant";
const NO_TARGET_WARNING = "Sélectionnez d'abord une liste de destination.";
const TARGET_HINT =
  "Les modèles générés par le système seront rangés dans cette liste.";
const GENERATED_COUNT = (n) => `${n} modèle${n > 1 ? "s" : ""}`;
const DEFAULT_LISTING_PREFIX = "Repérage ";
const CANCEL = "Annuler";
const CONFIRM = "Associer";

// helpers

function getTargetListingName(procedure, object) {
  const fromRegistry = procedure?.targetListingName?.trim();
  if (fromRegistry) return fromRegistry;
  return `${DEFAULT_LISTING_PREFIX}${object?.label ?? procedure?.label ?? ""}`.trim();
}

// One selectable system row: thumbnail + label + description + generated
// templates count. Resolves its own definition (hook per row) and reports it
// up once loaded so the confirm can create the templates of the selected one.
function RowSystemForAxis({ object, selected, onSelect, onResolved }) {
  // data

  const { procedure, generatedTemplates, loading } =
    useSystemDefinition(object);

  useEffect(() => {
    if (loading) return;
    onResolved(object.procedureKey, generatedTemplates);
    // report once per load completion; generatedTemplates is recomputed each
    // render from the same loaded library
  }, [loading, object.procedureKey]);

  // helpers

  const description = procedure?.description ?? object.description ?? "";
  const count = generatedTemplates.length;

  // render

  return (
    <ButtonBase
      onClick={() => onSelect(object.procedureKey)}
      sx={{
        width: "100%",
        display: "flex",
        alignItems: "stretch",
        gap: 1.5,
        p: 1.5,
        textAlign: "left",
        border: "1px solid",
        borderColor: selected ? "primary.main" : "divider",
        borderRadius: 2,
        bgcolor: (theme) =>
          selected ? alpha(theme.palette.primary.main, 0.06) : "transparent",
        transition: "box-shadow 0.15s, border-color 0.15s",
        "&:hover": { boxShadow: 3, borderColor: "primary.main" },
      }}
    >
      <Box
        sx={{
          width: 72,
          height: 72,
          flex: "none",
          borderRadius: 1.5,
          bgcolor: "action.hover",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {object.thumbnailUrl ? (
          <Box
            component="img"
            src={object.thumbnailUrl}
            alt={object.label}
            sx={{ width: "75%", height: "75%", objectFit: "contain" }}
          />
        ) : (
          <AutoFixHigh sx={{ fontSize: 32, color: "text.disabled" }} />
        )}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography
            variant="body1"
            noWrap
            sx={{ fontWeight: "bold", lineHeight: 1.25 }}
          >
            {object.label}
          </Typography>
          {loading ? (
            <CircularProgress size={12} />
          ) : (
            count > 0 && (
              <Chip
                size="small"
                label={GENERATED_COUNT(count)}
                sx={{ height: 20 }}
              />
            )
          )}
        </Box>
        {object.labelVariant && (
          <Typography variant="caption" color="text.secondary" noWrap>
            {object.labelVariant}
          </Typography>
        )}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            whiteSpace: "pre-line",
            mt: 0.5,
          }}
        >
          {description}
        </Typography>
      </Box>
    </ButtonBase>
  );
}

export default function DialogAssociateSystemToAxis({
  axis,
  procedures,
  onClose,
}) {
  const dispatch = useDispatch();

  // data

  const { objects, loading } = useObjectsLibrary();
  const candidateListings = useObjectsTargetListings();
  const selectedListingId = useSelector((s) => s.listings.selectedListingId);

  // state

  const [selectedKey, setSelectedKey] = useState(null);
  const [templatesByKey, setTemplatesByKey] = useState({});
  const [useExistingListing, setUseExistingListing] = useState(false);
  const [targetListingId, setTargetListingId] = useState(selectedListingId);

  // helpers

  // One selectable object per available procedure: the library "Systèmes"
  // entry bound to it (thumbnail, variant, template library), else a
  // registry-only stand-in (no generated templates to pre-create).
  const systems = useMemo(
    () =>
      (procedures ?? []).map((procedure) => {
        const object = (objects ?? []).find(
          (o) => o.tab === "SYSTEMS" && o.procedureKey === procedure.key
        );
        return (
          object ?? {
            id: procedure.key,
            label: procedure.label,
            description: procedure.description,
            procedureKey: procedure.key,
          }
        );
      }),
    [procedures, objects]
  );

  // First system pre-selected (the common case is a single one left).
  useEffect(() => {
    if (loading || systems.length === 0) return;
    setSelectedKey((prev) =>
      prev && systems.some((s) => s.procedureKey === prev)
        ? prev
        : systems[0].procedureKey
    );
  }, [loading, systems]);

  const selectedObject =
    systems.find((s) => s.procedureKey === selectedKey) ?? null;
  const selectedProcedure =
    (procedures ?? []).find((p) => p.key === selectedKey) ?? null;
  const selectedTemplatesLoaded = selectedKey
    ? Object.prototype.hasOwnProperty.call(templatesByKey, selectedKey)
    : false;

  // Default destination: the registry-named listing, reused when the scope
  // already holds one of that exact name.
  const targetListingName = getTargetListingName(
    selectedProcedure,
    selectedObject
  );
  const namedListing = useMemo(
    () =>
      candidateListings.find(
        (l) => (l.name ?? "").trim() === targetListingName
      ) ?? null,
    [candidateListings, targetListingName]
  );

  const hasValidTarget = candidateListings.some(
    (l) => l.id === targetListingId
  );

  // Existing-listing default: the selected listing when it can hold
  // annotations, else the first candidate — without clobbering a valid
  // user choice.
  useEffect(() => {
    setTargetListingId((prev) => {
      if (prev && candidateListings.some((l) => l.id === prev)) return prev;
      if (candidateListings.some((l) => l.id === selectedListingId))
        return selectedListingId;
      return candidateListings[0]?.id ?? null;
    });
  }, [candidateListings, selectedListingId]);

  const canConfirm =
    Boolean(axis?.id) &&
    Boolean(selectedObject?.procedureKey) &&
    selectedTemplatesLoaded &&
    (!useExistingListing || hasValidTarget);

  // handlers

  function handleResolved(procedureKey, generatedTemplates) {
    setTemplatesByKey((prev) =>
      prev[procedureKey] === generatedTemplates
        ? prev
        : { ...prev, [procedureKey]: generatedTemplates }
    );
  }

  // Nothing is written here: the destination travels with the pending
  // launch and is materialized by the outlet on "Lancer" (see header).
  function handleConfirm() {
    if (!canConfirm) return;
    if (useExistingListing && !hasValidTarget) {
      dispatch(setToaster({ message: NO_TARGET_WARNING, severity: "warning" }));
      return;
    }
    const listing = useExistingListing
      ? { id: targetListingId }
      : namedListing
        ? { id: namedListing.id }
        : { name: targetListingName };
    // Serializable subset of the library object: the modelIdMaster drives
    // the template dedup, the rest is display only.
    const { id, modelIdMaster, label, procedureKey } = selectedObject;
    onClose?.();
    dispatch(
      setPendingProcedureLaunch({
        procedureKey,
        sourceAnnotationId: axis.id,
        systemSetup: {
          object: { id, modelIdMaster, label, procedureKey },
          templates: templatesByKey[selectedKey] ?? [],
          listing,
        },
      })
    );
  }

  // render

  const showTargetWarning = useExistingListing && !hasValidTarget;

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{TITLE}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {DESCRIPTION}
        </Typography>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : systems.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {NO_SYSTEM}
          </Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {systems.map((object) => (
              <RowSystemForAxis
                key={object.procedureKey}
                object={object}
                selected={object.procedureKey === selectedKey}
                onSelect={setSelectedKey}
                onResolved={handleResolved}
              />
            ))}
          </Box>
        )}

        {/* destination listing of the generated templates: new named
            listing by default, existing listing of the scope on demand */}
        {selectedObject && (
          <Box
            sx={{
              mt: 2.5,
              p: 1.5,
              borderRadius: 2,
              border: (theme) =>
                `1px solid ${
                  showTargetWarning
                    ? theme.palette.warning.main
                    : theme.palette.divider
                }`,
              bgcolor: (theme) =>
                showTargetWarning
                  ? alpha(theme.palette.warning.main, 0.12)
                  : "transparent",
              transition: "background-color 0.2s",
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
              {DESTINATION_TITLE}
            </Typography>

            {!useExistingListing && (
              <Typography variant="body2" color="text.secondary">
                {namedListing
                  ? REUSED_LISTING_TEXT(targetListingName)
                  : NEW_LISTING_TEXT(targetListingName)}
              </Typography>
            )}

            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={useExistingListing}
                  onChange={(e) => setUseExistingListing(e.target.checked)}
                />
              }
              label={
                <Typography variant="body2" color="text.secondary">
                  {USE_EXISTING_LABEL}
                </Typography>
              }
              sx={{ mt: 0.5, ml: 0 }}
            />

            {useExistingListing && (
              <Box sx={{ mt: 1 }}>
                <SelectorListingForObjects
                  value={targetListingId}
                  onChange={setTargetListingId}
                />
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    mt: 1,
                  }}
                >
                  <Bolt
                    fontSize="small"
                    sx={{
                      color: hasValidTarget ? "text.disabled" : "warning.main",
                    }}
                  />
                  <Typography
                    variant="caption"
                    color={hasValidTarget ? "text.secondary" : "warning.main"}
                  >
                    {hasValidTarget ? TARGET_HINT : NO_TARGET_WARNING}
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{CANCEL}</Button>
        <Button
          variant="contained"
          disabled={!canConfirm}
          onClick={handleConfirm}
        >
          {CONFIRM}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
