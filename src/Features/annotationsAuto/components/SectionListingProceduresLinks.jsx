import { useDispatch } from "react-redux";

import { setSelectedItem } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import getProcedureSelectedItem from "../utils/getProcedureSelectedItem";

import { List, ListItemButton, ListItemText } from "@mui/material";
import { AutoFixHigh, ChevronRight } from "@mui/icons-material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import WhiteSectionTitle from "Features/form/components/WhiteSectionTitle";

/**
 * Listing properties: list of the procedures linked to the listing
 * (listing.procedureKeys). A row opens the procedure properties
 * (PanelProcedureProperties), whose back arrow returns to the listing.
 *
 * Renders nothing when the listing links no procedure.
 */
export default function SectionListingProceduresLinks({ listing }) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Procédures auto";

  // data

  const appConfig = useAppConfig();
  const procedures = appConfig?.automatedAnnotationsProcedures ?? [];

  // helpers

  const linkedProcedures = (listing?.procedureKeys ?? [])
    .map((key) => procedures.find((p) => p.key === key))
    .filter(Boolean);

  // handlers

  function handleSelect(procedure) {
    dispatch(
      setSelectedItem(
        getProcedureSelectedItem({
          procedureKey: procedure.key,
          listingId: listing.id,
        })
      )
    );
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
  }

  // render

  if (linkedProcedures.length === 0) return null;

  return (
    <WhiteSectionGeneric>
      <WhiteSectionTitle sx={{ mb: 0.5 }}>{titleS}</WhiteSectionTitle>
      <List dense disablePadding>
        {linkedProcedures.map((procedure) => (
          <ListItemButton
            key={procedure.key}
            onClick={() => handleSelect(procedure)}
            sx={{ borderRadius: 1, py: 0.5, px: 1, gap: 0.75 }}
          >
            <AutoFixHigh sx={{ fontSize: 16, color: "text.secondary" }} />
            <ListItemText
              primary={procedure.label}
              primaryTypographyProps={{ variant: "body2", noWrap: true }}
            />
            <ChevronRight sx={{ fontSize: 18, color: "text.secondary" }} />
          </ListItemButton>
        ))}
      </List>
    </WhiteSectionGeneric>
  );
}
