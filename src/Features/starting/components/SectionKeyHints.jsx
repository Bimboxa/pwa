import { Fragment } from "react";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Box, Typography } from "@mui/material";
import HighlightAlt from "@mui/icons-material/HighlightAlt";
import IconRightClickShortcut from "Features/icons/IconRightClickShortcut";

import WhiteSectionTitle from "Features/form/components/WhiteSectionTitle";
import KeyCap from "./KeyCap";

import { KEY_HINTS } from "../data/startingKeyHints";
import getStartingVocabulary from "../utils/getStartingVocabulary";

const ICONS = {
  ICON_LASSO: HighlightAlt,
  ICON_RIGHT_CLICK: IconRightClickShortcut,
};

// « Les touches clés »: keys / gestures on the left, what they do on the right.
export default function SectionKeyHints() {
  // strings

  const titleS = "Les touches clés";
  const introS =
    "Les raccourcis à connaître dans les éditeurs 2D et 3D. La barre de commandes et la barre d'outils affichent la lettre de chaque commande.";

  // data

  const appConfig = useAppConfig();

  // helpers

  const vocabulary = getStartingVocabulary(appConfig);

  // render

  function renderKeys(item) {
    const keys = item.keys ?? [];
    const Icon = item.icon ? ICONS[item.icon] : null;
    const plus = (
      <Typography component="span" variant="body2" sx={{ mx: 0.5 }}>
        +
      </Typography>
    );
    return (
      <>
        {keys.map((k, i) => (
          <Fragment key={k}>
            {i > 0 && plus}
            <KeyCap>{k}</KeyCap>
          </Fragment>
        ))}
        {Icon && (
          <>
            {keys.length > 0 && plus}
            <Icon sx={{ fontSize: 26, color: "text.primary" }} />
          </>
        )}
      </>
    );
  }

  return (
    <Box
      sx={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 3,
      }}
    >
      <Box
        sx={{
          width: 1,
          maxWidth: 760,
          bgcolor: "white",
          borderRadius: 1,
          border: (theme) => `1px solid ${theme.palette.divider}`,
          p: 2,
        }}
      >
        <WhiteSectionTitle sx={{ pb: 0.5 }}>{titleS}</WhiteSectionTitle>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
          {introS}
        </Typography>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "180px 1fr",
            alignItems: "center",
            rowGap: 1.5,
            columnGap: 2,
          }}
        >
          {KEY_HINTS.map((item) => (
            <Fragment key={item.key}>
              <Box sx={{ display: "flex", alignItems: "center" }}>
                {renderKeys(item)}
              </Box>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {item.label}
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  {typeof item.hint === "function"
                    ? item.hint(vocabulary)
                    : item.hint}
                </Typography>
              </Box>
            </Fragment>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
