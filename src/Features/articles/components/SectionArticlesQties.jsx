import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { Box, Typography, IconButton, Tooltip } from "@mui/material";
import { ContentCopy } from "@mui/icons-material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import resolveArticlesNomenclaturesWithQties from "../utils/resolveArticlesNomenclaturesWithQties";
import ArticlesTable from "./ArticlesTable";

export default function SectionArticlesQties({ annotations }) {
  // data

  const appConfig = useAppConfig();
  const articlesNomenclaturesObject =
    appConfig?.articlesNomenclaturesObject ?? {};
  const mappingCategories = appConfig?.mappingCategories ?? [];

  // helpers

  const resolvedNomenclatures = useLiveQuery(
    async () => {
      if (!annotations?.length) return [];

      const nomenclatureValues = Object.values(articlesNomenclaturesObject);
      if (!nomenclatureValues.length) return [];

      return resolveArticlesNomenclaturesWithQties({
        annotations,
        mappingCategories,
        articlesNomenclatures: nomenclatureValues,
      });
    },
    [
      annotations?.map((a) => a.id).join(","),
      Object.keys(articlesNomenclaturesObject).join(","),
    ]
  );

  const nomenclaturesWithValidArticles = useMemo(() => {
    if (!resolvedNomenclatures?.length) return [];
    return resolvedNomenclatures
      .map((nom) => ({
        ...nom,
        articles: (nom.articles ?? []).filter(
          (a) => a.qty !== null && a.qty !== undefined && a.qty > 0
        ),
      }))
      .filter((nom) => nom.articles.length > 0);
  }, [resolvedNomenclatures]);

  // render

  if (!nomenclaturesWithValidArticles.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        Aucun article
      </Typography>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {nomenclaturesWithValidArticles.map((nomenclature) => (
        <Box key={nomenclature.key}>
          <Box
            sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}
          >
            <Typography
              variant="body2"
              sx={{ fontWeight: "bold", color: "text.primary" }}
            >
              {nomenclature.label ?? nomenclature.key}
            </Typography>
            <Tooltip title="Copier pour Excel">
              <IconButton
                size="small"
                onClick={() => {
                  const header = "N°\tDésignation\tQté\tUnité";
                  const rows = nomenclature.articles.map(
                    (a) =>
                      `${a.num}\t${a.label}\t${String(a.qty).replace(".", ",")}\t${a.unit}`
                  );
                  navigator.clipboard.writeText(
                    [header, ...rows].join("\n")
                  );
                }}
              >
                <ContentCopy sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          </Box>
          <ArticlesTable articles={nomenclature.articles} />
        </Box>
      ))}
    </Box>
  );
}
