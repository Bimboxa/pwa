import {
  Box,
  Button,
  Chip,
  IconButton,
  TextField,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";

const ORIENTATION_LABELS = {
  LANDSCAPE: "paysage",
  PORTRAIT: "portrait",
  SQUARE: "carré",
};

// page aspect ratio (width / height) of the blank-page mock
function getPageAspectRatio(item) {
  switch (item?.pageOrientation) {
    case "PORTRAIT":
      return 1 / 1.414;
    case "SQUARE":
      return 1;
    case "LANDSCAPE":
    default:
      return 1.414;
  }
}

function getPageLabel(item) {
  if (item.type === "ASSET") return "Image";
  const orientation = ORIENTATION_LABELS[item.pageOrientation] ?? "paysage";
  const format = item.pageFormat ?? "A3";
  const scale = item.scale ? ` · 1/${item.scale}` : "";
  return `${format} ${orientation}${scale}`;
}

const pageSx = {
  position: "relative",
  width: 260,
  maxWidth: "80%",
  bgcolor: "#fff",
  border: "1px solid",
  borderColor: "divider",
  boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 0.5,
  px: 1,
  textAlign: "center",
};

const removeButtonSx = {
  position: "absolute",
  top: 4,
  right: 4,
  color: "text.secondary",
};

/*
 * Preview of the Krto, mirroring the app's spatial layout so the user builds
 * the right mental image: the annotation templates panel on the LEFT, the
 * plan (drawing surface) on the RIGHT. Every element to be created can be
 * removed (close buttons), and new empty annotation listings / blank pages
 * can be added.
 */
export default function SectionKrtoPreview({
  panelTopContent,
  panelBottomContent,
  libraries,
  onRemoveLibrary,
  pages,
  onRemovePage,
  extraAnnotationListings,
  onExtraAnnotationListingsChange,
  onAddListingClick,
  extraPages,
  onExtraPagesChange,
  defaultPageListingName,
}) {
  // strings

  const titleS = "Modèles d'annotations";
  const helperS =
    "Ces listes seront ajoutées au Krto, prêtes à annoter. Vous pourrez en retirer ensuite.";
  const noLibrariesS = "Aucun modèle";
  const emptyPlanS = "Fonds de plan à importer";
  const listingPrefixS = "Dossier : ";
  const addListingS = "+ Ajouter";
  const addPageS = "+ Fond de plan";
  const bannerS =
    "Les fonds de plan et les modèles d'annotations pourront être paramétrés plus tard";
  const newListingPlaceholderS = "Nom de la liste";
  const newPageNamePlaceholderS = "Nom du fond de plan";

  // helpers

  const _pages = pages ?? [];
  const _extraListings = extraAnnotationListings ?? [];
  const _extraPages = extraPages ?? [];

  // handlers

  function handleExtraListingChange(index, value) {
    onExtraAnnotationListingsChange(
      _extraListings.map((l, i) => (i === index ? { ...l, name: value } : l))
    );
  }

  function handleRemoveExtraListing(index) {
    onExtraAnnotationListingsChange(
      _extraListings.filter((l, i) => i !== index)
    );
  }

  function handleAddPage() {
    onExtraPagesChange([
      ..._extraPages,
      {
        name: `Fond de plan ${_pages.length + _extraPages.length + 1}`,
        listingName: defaultPageListingName,
        pageFormat: "A3",
        pageOrientation: "LANDSCAPE",
        scale: 50,
      },
    ]);
  }

  function handleExtraPageNameChange(index, value) {
    onExtraPagesChange(
      _extraPages.map((p, i) => (i === index ? { ...p, name: value } : p))
    );
  }

  function handleRemoveExtraPage(index) {
    onExtraPagesChange(_extraPages.filter((p, i) => i !== index));
  }

  // render

  return (
    <Box
      sx={{
        flexGrow: 1,
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        minHeight: 0,
      }}
    >
      {/* full-width banner */}
      <Box
        sx={{
          px: 2,
          py: 1,
          bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.08),
        }}
      >
        <Typography variant="caption" sx={{ color: "secondary.main" }}>
          {bannerS}
        </Typography>
      </Box>

      <Box sx={{ display: "flex", flexGrow: 1, minWidth: 0, minHeight: 0 }}>
      {/* templates panel — left, like the app's Dessin panel */}
      <Box
        sx={{
          width: 300,
          flexShrink: 0,
          p: 2,
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
        }}
      >
        {panelTopContent}

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography variant="body1" sx={{ fontWeight: 700 }}>
            {titleS}
          </Typography>
          <Button
            size="small"
            color="secondary"
            onClick={onAddListingClick}
            sx={{ minWidth: 0 }}
          >
            {addListingS}
          </Button>
        </Box>

        {(libraries ?? []).length === 0 && _extraListings.length === 0 ? (
          <Box
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              bgcolor: "background.paper",
              py: 2,
              textAlign: "center",
            }}
          >
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {noLibrariesS}
            </Typography>
          </Box>
        ) : (
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {helperS}
          </Typography>
        )}

        {(libraries ?? []).map((library) => (
          <Box
            key={library.key}
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              bgcolor: "background.paper",
              p: 1.5,
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mb: 0.5,
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {library.name}
              </Typography>
              <IconButton
                size="small"
                onClick={() => onRemoveLibrary(library.key)}
                sx={{ color: "text.secondary", p: 0.25 }}
              >
                <CloseIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
            {library.templates.map((template, index) => (
              <Box
                key={index}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  py: 0.5,
                }}
              >
                <AnnotationTemplateIcon template={template} size={16} />
                <Typography variant="body2" noWrap>
                  {template.label}
                </Typography>
              </Box>
            ))}
          </Box>
        ))}

        {_extraListings.map((listing, index) => (
          <Box
            key={index}
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              bgcolor: "background.paper",
              p: 1.5,
              display: "flex",
              alignItems: "center",
              gap: 0.5,
            }}
          >
            <TextField
              value={listing.name}
              onChange={(e) => handleExtraListingChange(index, e.target.value)}
              placeholder={newListingPlaceholderS}
              size="small"
              fullWidth
            />
            <IconButton
              size="small"
              onClick={() => handleRemoveExtraListing(index)}
              sx={{ color: "text.secondary", p: 0.25 }}
            >
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
        ))}

        {panelBottomContent}
      </Box>

      {/* plan area — right, like the app's drawing surface: one "page" per
          new baseMap item, tagged with its destination listing */}
      <Box
        sx={{
          flexGrow: 1,
          m: 2,
          ml: 0,
          borderRadius: 2,
          bgcolor: "grey.100",
          border: "1px solid",
          borderColor: "divider",
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
          minWidth: 0,
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "center", pt: 2 }}>
          <Chip
            label={addPageS}
            clickable
            onClick={handleAddPage}
            sx={{
              bgcolor: "background.paper",
              color: "secondary.main",
              fontWeight: 500,
              border: "1px solid",
              borderColor: "divider",
              "&:hover": { bgcolor: "background.paper" },
            }}
          />
        </Box>

        <Box
          sx={{
            flexGrow: 1,
            p: 3,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            alignContent: "center",
            justifyContent: "center",
            gap: 3,
          }}
        >
        {_pages.length === 0 && _extraPages.length === 0 && (
          <Box
            sx={{
              width: "70%",
              maxHeight: "80%",
              aspectRatio: "1.414",
              border: "1px dashed",
              borderColor: "grey.400",
              borderRadius: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {emptyPlanS}
            </Typography>
          </Box>
        )}

        {_pages.map((page) => (
          <Box
            key={page.pageKey}
            sx={{ ...pageSx, aspectRatio: String(getPageAspectRatio(page)) }}
          >
            <IconButton
              size="small"
              onClick={() => onRemovePage(page.pageKey)}
              sx={removeButtonSx}
            >
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {page.name}
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {getPageLabel(page)}
            </Typography>
            {page.listingName && (
              <Typography variant="caption" sx={{ color: "secondary.main" }}>
                {listingPrefixS}
                {page.listingName}
              </Typography>
            )}
          </Box>
        ))}

        {_extraPages.map((page, index) => (
          <Box
            key={index}
            sx={{ ...pageSx, aspectRatio: String(getPageAspectRatio(page)) }}
          >
            <IconButton
              size="small"
              onClick={() => handleRemoveExtraPage(index)}
              sx={removeButtonSx}
            >
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
            <TextField
              value={page.name}
              onChange={(e) => handleExtraPageNameChange(index, e.target.value)}
              placeholder={newPageNamePlaceholderS}
              size="small"
              variant="standard"
              sx={{ width: "80%" }}
              inputProps={{ style: { textAlign: "center" } }}
            />
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {getPageLabel(page)}
            </Typography>
            {page.listingName && (
              <Typography variant="caption" sx={{ color: "secondary.main" }}>
                {listingPrefixS}
                {page.listingName}
              </Typography>
            )}
          </Box>
        ))}

        </Box>
      </Box>
      </Box>
    </Box>
  );
}
