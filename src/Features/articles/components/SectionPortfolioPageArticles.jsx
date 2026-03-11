import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import {
    Box,
    Typography,
    IconButton,
    Tooltip,
} from "@mui/material";
import { ContentCopy } from "@mui/icons-material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import usePortfolioBaseMapContainers from "Features/portfolioBaseMapContainers/hooks/usePortfolioBaseMapContainers";
import filterAnnotationsByViewBox from "Features/annotations/utils/filterAnnotationsByViewBox";
import resolveArticlesNomenclaturesWithQties from "../utils/resolveArticlesNomenclaturesWithQties";
import ArticlesTable from "./ArticlesTable";

export default function SectionPortfolioPageArticles({ page, annotations: allAnnotations }) {
    const appConfig = useAppConfig();

    // 1. Containers for this page
    const { value: containers } = usePortfolioBaseMapContainers({
        filterByPageId: page?.id,
    });

    const containersWithBaseMap = useMemo(
        () => (containers ?? []).filter((c) => c.baseMapId),
        [containers]
    );

    // 2. Filter annotations by containers' baseMapIds and viewBoxes
    const pageAnnotations = useMemo(() => {
        if (!containersWithBaseMap.length || !allAnnotations?.length) return [];

        const baseMapIds = new Set(containersWithBaseMap.map((c) => c.baseMapId));

        // Filter by baseMapIds first
        const byBaseMap = allAnnotations.filter((a) => baseMapIds.has(a.baseMapId));

        // Then filter by each container's viewBox and deduplicate
        const seen = new Set();
        const result = [];
        for (const container of containersWithBaseMap) {
            const containerAnnotations = byBaseMap.filter(
                (a) => a.baseMapId === container.baseMapId
            );
            const visible = filterAnnotationsByViewBox(containerAnnotations, container.viewBox);
            for (const a of visible) {
                if (!seen.has(a.id)) {
                    seen.add(a.id);
                    result.push(a);
                }
            }
        }
        return result;
    }, [containersWithBaseMap, allAnnotations]);

    // 3. articlesNomenclatures & mappingCategories from appConfig
    const articlesNomenclaturesObject = appConfig?.articlesNomenclaturesObject ?? {};
    const mappingCategories = appConfig?.mappingCategories ?? [];

    // 4. Resolve qtys (needs DB query for relAnnotationMappingCategory)
    const resolvedNomenclatures = useLiveQuery(async () => {
        if (!pageAnnotations?.length) return [];

        const nomenclatureValues = Object.values(articlesNomenclaturesObject);
        if (!nomenclatureValues.length) return [];

        return resolveArticlesNomenclaturesWithQties({
            annotations: pageAnnotations,
            mappingCategories,
            articlesNomenclatures: nomenclatureValues,
        });
    }, [
        pageAnnotations?.map((a) => a.id).join(","),
        Object.keys(articlesNomenclaturesObject).join(","),
    ]);

    // 5. Filter: keep only articles with a valid qty > 0, and nomenclatures with at least one
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

    // ── render ────────────────────────────────────────────────────────────────

    if (!nomenclaturesWithValidArticles.length) {
        return (
            <Box sx={{ width: 1 }}>
                <Typography variant="body2" color="text.secondary">
                    Aucun article
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ width: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            {nomenclaturesWithValidArticles.map((nomenclature) => (
                <Box key={nomenclature.key}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
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
                                        (a) => `${a.num}\t${a.label}\t${String(a.qty).replace(".", ",")}\t${a.unit}`
                                    );
                                    navigator.clipboard.writeText([header, ...rows].join("\n"));
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
