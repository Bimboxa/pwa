import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Box, Link, Typography } from "@mui/material";
import OpenInNew from "@mui/icons-material/OpenInNew";

import WhiteSectionTitle from "Features/form/components/WhiteSectionTitle";

import resolveVideoEmbed from "Features/documentation/utils/resolveVideoEmbed";

// « Vidéo de prise en main »: the getting-started video of the org
// (appConfig.features.starting.videoUrl — YouTube, Drive or Vimeo share
// link) embedded in a 16:9 player, with a link to open it in a new tab.
export default function SectionVideo() {
  // strings

  const titleS = "Vidéo de prise en main";
  const openLinkS = "Ouvrir la vidéo";
  const noVideoS = "Aucune vidéo configurée pour le moment.";
  const invalidS = "Le lien vidéo configuré n'est pas reconnu.";

  // data

  const appConfig = useAppConfig();

  // helpers

  const url = appConfig?.features?.starting?.videoUrl?.trim();
  const embed = url ? resolveVideoEmbed(url) : null;

  // render

  return (
    <Box sx={{ p: 3, maxWidth: 1000 }}>
      <WhiteSectionTitle sx={{ pb: 1 }}>{titleS}</WhiteSectionTitle>
      {!url && (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {noVideoS}
        </Typography>
      )}
      {url && !embed && (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {invalidS}{" "}
          <Link href={url} target="_blank" rel="noopener">
            {url}
          </Link>
        </Typography>
      )}
      {embed && (
        <>
          <Box
            sx={{
              position: "relative",
              width: 1,
              aspectRatio: "16 / 9",
              borderRadius: 2,
              overflow: "hidden",
              bgcolor: "common.black",
            }}
          >
            <Box
              component="iframe"
              src={embed.embedSrc}
              title={titleS}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              sx={{
                position: "absolute",
                inset: 0,
                width: 1,
                height: 1,
                border: 0,
              }}
            />
          </Box>
          <Link
            href={url}
            target="_blank"
            rel="noopener"
            sx={{
              mt: 1.5,
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
            }}
          >
            {openLinkS}
            <OpenInNew sx={{ fontSize: 16 }} />
          </Link>
        </>
      )}
    </Box>
  );
}
