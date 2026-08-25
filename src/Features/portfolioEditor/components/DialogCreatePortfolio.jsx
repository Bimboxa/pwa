import { useState, useEffect, useMemo } from "react";

import {
  DialogTitle,
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Checkbox,
  Typography,
} from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import FieldTextV2 from "Features/form/components/FieldTextV2";
import FieldCheck from "Features/form/components/FieldCheck";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";

import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";

export default function DialogCreatePortfolio({ open, onClose, onCreate }) {
  // strings

  const titleS = "Nouveau carnet de plans";
  const labelS = "Nom";
  const createS = "Créer";
  const detailsPortfolioS = "Carnet de détails";
  const noFolioS = "Aucun folio";
  const noDetailsS = "Aucun détail dans le scope";
  const detailS = "Détail";
  const pageS = "Page";

  // state

  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDetailsPortfolio, setIsDetailsPortfolio] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // data

  const annotations = useAnnotationsV2({
    caller: "DialogCreatePortfolio",
    filterBySelectedScope: true,
    enabled: open && isDetailsPortfolio,
  });

  const details = useMemo(() => {
    const list = annotations?.filter((a) => a.type === "DETAIL") ?? [];
    return list.sort((a, b) =>
      (a.label || "").localeCompare(b.label || "", undefined, {
        numeric: true,
      })
    );
  }, [annotations]);

  // effects - check all details by default

  const detailIdsSignature = details.map((d) => d.id).join(",");

  useEffect(() => {
    if (!isDetailsPortfolio) return;
    setSelectedIds(new Set(details.filter((d) => d.folio).map((d) => d.id)));
  }, [isDetailsPortfolio, detailIdsSignature]);

  // helpers

  const disabled = !name.trim();

  // handlers

  function handleToggleDetail(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreate() {
    if (loading || disabled) return;
    setLoading(true);
    const selectedDetails = details.filter((d) => selectedIds.has(d.id));
    await onCreate({
      title: name.trim(),
      isDetailsPortfolio,
      selectedDetails,
    });
    setName("");
    setIsDetailsPortfolio(false);
    setLoading(false);
    onClose();
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !disabled) {
      handleCreate();
    }
  }

  // render

  if (!open) return null;

  return (
    <DialogGeneric
      open={open}
      onClose={onClose}
      width={isDetailsPortfolio ? "460px" : "350px"}
    >
      <DialogTitle>{titleS}</DialogTitle>
      <BoxFlexVStretch>
        <Box sx={{ px: 1 }} onKeyDown={handleKeyDown}>
          <FieldTextV2
            label={labelS}
            value={name}
            onChange={(e) => setName(e)}
            options={{ fullWidth: true, showLabel: true, autoFocus: true }}
          />
        </Box>

        <FieldCheck
          value={isDetailsPortfolio}
          onChange={setIsDetailsPortfolio}
          label={detailsPortfolioS}
          options={{ showAsInline: true }}
        />

        {isDetailsPortfolio && (
          <Box sx={{ maxHeight: "40vh", overflow: "auto", px: 1 }}>
            {details.length === 0 ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ p: 1, textAlign: "center" }}
              >
                {noDetailsS}
              </Typography>
            ) : (
              <List dense disablePadding>
                {details.map((detail) => {
                  const hasFolio = Boolean(detail.folio);
                  return (
                    <ListItemButton
                      key={detail.id}
                      dense
                      disabled={!hasFolio}
                      onClick={() => handleToggleDetail(detail.id)}
                    >
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <Checkbox
                          edge="start"
                          size="small"
                          checked={selectedIds.has(detail.id)}
                          tabIndex={-1}
                          disableRipple
                        />
                      </ListItemIcon>
                      {detail.folio?.thumbnail ? (
                        <Box
                          component="img"
                          src={detail.folio.thumbnail}
                          alt=""
                          sx={{
                            width: 40,
                            height: 40,
                            objectFit: "cover",
                            objectPosition: "top",
                            borderRadius: 0.5,
                            border: (theme) =>
                              `1px solid ${theme.palette.divider}`,
                            mr: 1,
                          }}
                        />
                      ) : (
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            bgcolor: "action.hover",
                            borderRadius: 0.5,
                            mr: 1,
                          }}
                        >
                          <Typography variant="caption" fontWeight="bold">
                            {detail.label || "?"}
                          </Typography>
                        </Box>
                      )}
                      <ListItemText
                        primary={`${detailS} ${detail.label || ""}`.trim()}
                        secondary={
                          hasFolio
                            ? `${pageS} ${detail.folio.pageNumber}`
                            : noFolioS
                        }
                        primaryTypographyProps={{ variant: "body2" }}
                        secondaryTypographyProps={{ variant: "caption" }}
                      />
                    </ListItemButton>
                  );
                })}
              </List>
            )}
          </Box>
        )}
      </BoxFlexVStretch>
      <ButtonInPanelV2
        label={createS}
        onClick={handleCreate}
        variant="contained"
        loading={loading}
        disabled={disabled}
      />
    </DialogGeneric>
  );
}
