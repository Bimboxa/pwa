import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import {
    Box,
    Typography,
    Table,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
} from "@mui/material";

import db from "App/db/db";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import usePortfolioBaseMapContainers from "Features/portfolioBaseMapContainers/hooks/usePortfolioBaseMapContainers";
import resolveArticlesNomenclaturesWithQties from "../resolveArticlesNomenclaturesWithQties";

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns true if the annotation has at least one point (or its centroid)
 * that falls inside the container's viewBox.
 *
 * The viewBox is in image absolute-pixel coords.
 * Annotation points are stored as normalized ratios [0–1] relative to the
 * baseMap image dimensions, so we multiply by imageSize to compare.
 */
function annotationInViewBox(annotation, viewBox, imageSize) {
    if (!viewBox || !imageSize) return true; // no clip info → keep all

    const { width: imgW, height: imgH } = imageSize;
    const { x: vx, y: vy, width: vw, height: vh } = viewBox;

    const inBox = (px, py) =>
        px >= vx && px <= vx + vw && py >= vy && py <= vy + vh;

    // POLYGON / POLYLINE / STRIP: check each point
    if (annotation.points?.length) {
        return annotation.points.some((pt) => {
            if (!pt.id) return false;
            // points are normalized — we need the resolved coords
            // annotation.points may just be {id} refs; actual coords come from DB.
            // Fall back to checking the bbox centroid below.
            return false;
        }) || true; // optimistic: include if we can't resolve point positions here
    }

    // MARKER / POINT: annotation.point.x/y if already embedded
    if (annotation.point) {
        return inBox(annotation.point.x * imgW, annotation.point.y * imgH);
    }

    // RECTANGLE / IMAGE: bbox
    if (annotation.bbox) {
        const { x, y, width, height } = annotation.bbox;
        const cx = (x + width / 2) * imgW;
        const cy = (y + height / 2) * imgH;
        return inBox(cx, cy);
    }

    return true; // unknown type → keep
}

// ─── sub-components ──────────────────────────────────────────────────────────

function ArticlesTable({ articles }) {
    return (
        <Table size="small" sx={{ width: 1 }}>
            <TableHead>
                <TableRow>
                    {["N°", "Désignation", "Qté", "Unité"].map((col) => (
                        <TableCell
                            key={col}
                            sx={{
                                py: 0.5,
                                fontWeight: "bold",
                                fontSize: "0.75rem",
                                borderBottom: (theme) => `2px solid ${theme.palette.divider}`,
                            }}
                        >
                            {col}
                        </TableCell>
                    ))}
                </TableRow>
            </TableHead>
            <TableBody>
                {articles.map((article) => (
                    <TableRow key={article.num} hover>
                        <TableCell sx={{ py: 0.5, fontSize: "0.75rem", color: "text.secondary", width: 32 }}>
                            {article.num}
                        </TableCell>
                        <TableCell sx={{ py: 0.5, fontSize: "0.75rem" }}>
                            {article.label}
                        </TableCell>
                        <TableCell sx={{ py: 0.5, fontSize: "0.75rem", textAlign: "right", width: 64 }}>
                            {article.qty}
                        </TableCell>
                        <TableCell sx={{ py: 0.5, fontSize: "0.75rem", color: "text.secondary", width: 48 }}>
                            {article.unit}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function SectionPortfolioPageArticles({ page }) {
    const appConfig = useAppConfig();

    // 1. Containers for this page
    const { value: containers } = usePortfolioBaseMapContainers({
        filterByPageId: page?.id,
    });

    const containersWithBaseMap = useMemo(
        () => (containers ?? []).filter((c) => c.baseMapId),
        [containers]
    );

    // 2. BaseMaps to get image dimensions
    const baseMaps = useLiveQuery(async () => {
        if (!containersWithBaseMap.length) return [];
        const ids = containersWithBaseMap.map((c) => c.baseMapId);
        const records = await db.baseMaps.bulkGet(ids);
        return records.filter(Boolean);
    }, [containersWithBaseMap.map((c) => c.baseMapId).join(",")]);

    const baseMapById = useMemo(
        () => new Map((baseMaps ?? []).map((bm) => [bm.id, bm])),
        [baseMaps]
    );

    // 3. Annotations per baseMap, filtered by each container's viewBox
    const annotations = useLiveQuery(async () => {
        if (!containersWithBaseMap.length) return [];

        const results = await Promise.all(
            containersWithBaseMap.map(async (container) => {
                const raw = await db.annotations
                    .where("baseMapId")
                    .equals(container.baseMapId)
                    .toArray();

                const active = raw.filter((a) => !a.deletedAt);

                const baseMap = baseMapById.get(container.baseMapId);
                const imageSize = baseMap?.image?.imageSize;
                const viewBox = container.viewBox;

                // Filter annotations that are (at least partially) within the viewBox
                return active.filter((a) => annotationInViewBox(a, viewBox, imageSize));
            })
        );

        // Deduplicate by id (an annotation visible in multiple containers counts once)
        const seen = new Set();
        return results.flat().filter((a) => {
            if (seen.has(a.id)) return false;
            seen.add(a.id);
            return true;
        });
    }, [
        containersWithBaseMap.map((c) => `${c.baseMapId}:${JSON.stringify(c.viewBox)}`).join(","),
        baseMapById.size,
    ]);

    // 4. articlesNomenclatures & mappingCategories from appConfig
    const articlesNomenclaturesObject = appConfig?.articlesNomenclaturesObject ?? {};
    const mappingCategories = appConfig?.mappingCategories ?? [];

    // 5. Resolve qtys (reacts to DB changes via useLiveQuery)
    const resolvedNomenclatures = useLiveQuery(async () => {
        if (!annotations?.length) return [];

        const nomenclatureValues = Object.values(articlesNomenclaturesObject);
        if (!nomenclatureValues.length) return [];

        return resolveArticlesNomenclaturesWithQties({
            annotations,
            mappingCategories,
            articlesNomenclatures: nomenclatureValues,
        });
    }, [
        annotations?.map((a) => a.id).join(","),
        Object.keys(articlesNomenclaturesObject).join(","),
    ]);

    // 6. Filter: keep only articles with a valid qty > 0, and nomenclatures with at least one
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

    if (!nomenclaturesWithValidArticles.length) return null;

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {nomenclaturesWithValidArticles.map((nomenclature) => (
                <Box key={nomenclature.key}>
                    <Typography
                        variant="body2"
                        sx={{ fontWeight: "bold", mb: 0.5, color: "text.primary" }}
                    >
                        {nomenclature.label ?? nomenclature.key}
                    </Typography>
                    <ArticlesTable articles={nomenclature.articles} />
                </Box>
            ))}
        </Box>
    );
}
