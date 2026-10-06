import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import hatchedIllustrationSx from "../utils/hatchedIllustrationSx";

/*
 * Right side of the recap: the annotation templates panel (left, like the
 * app's Dessin panel — libraries removable, empty listings addable) and the
 * configuration's illustration (right). The image url is resolved lazily by
 * the parent; while it loads (or when the configuration has none) the slot
 * shows the hatched placeholder with the configuration code.
 */
export default function SectionKrtoPreview({
  libraries,
  onRemoveLibrary,
  extraAnnotationListings,
  onExtraAnnotationListingsChange,
  onAddListingClick,
  imageUrl,
  imageLoading,
  imageAlt,
  code,
}) {
  // strings

  const titleS = "Modèles d'annotations";
  const helperS =
    "Ces listes seront ajoutées au Krto, prêtes à annoter. Vous pourrez en retirer ensuite.";
  const noLibrariesS = "Aucun modèle";
  const addListingS = "+ Ajouter";
  const newListingPlaceholderS = "Nom de la liste";

  // helpers

  const _extraListings = extraAnnotationListings ?? [];

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
                onChange={(e) =>
                  handleExtraListingChange(index, e.target.value)
                }
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
        </Box>

        {/* illustration — right, one image per configuration */}
        <Box
          sx={{
            flexGrow: 1,
            m: 2,
            ml: 0,
            minWidth: 0,
            minHeight: 0,
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            ...(!imageUrl && hatchedIllustrationSx),
          }}
        >
          {imageUrl ? (
            <Box
              component="img"
              src={imageUrl}
              alt={imageAlt ?? ""}
              loading="lazy"
              decoding="async"
              sx={{ width: 1, height: 1, objectFit: "contain" }}
            />
          ) : imageLoading ? (
            <CircularProgress size={20} color="secondary" />
          ) : (
            code && (
              <Typography
                sx={{
                  fontFamily: "monospace",
                  fontSize: 13,
                  letterSpacing: "0.2em",
                  color: "text.secondary",
                }}
              >
                {code}
              </Typography>
            )
          )}
        </Box>
      </Box>
    </Box>
  );
}
