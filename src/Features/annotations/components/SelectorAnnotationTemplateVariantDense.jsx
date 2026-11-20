import { useMemo } from "react";

import {
    Box,
    Checkbox,
    Typography,
    List,
    ListItemButton,
    ListItemIcon,
    ListSubheader,
} from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import AnnotationTemplateIcon from "./AnnotationTemplateIcon";
import useAnnotationSpriteImage from "../hooks/useAnnotationSpriteImage";
import groupAnnotationTemplatesByGroupLabel from "../utils/groupAnnotationTemplatesByGroupLabel";

export default function SelectorAnnotationTemplateVariantDense({
    selectedAnnotationTemplateId,
    onChange,
    annotationTemplates,
    listings,
    title = "Bibliothèque d'annotations",
    size = 18,
    showTitle = false,
    // Optional secondary text at the right of a row (e.g. the number of
    // selected annotations a template would affect).
    getItemSuffix = null,
    // Multi-selection: when an array is given, each row shows a checkbox and
    // is selected when its id is in the array (`selectedAnnotationTemplateId`
    // is then ignored). `onChange(id)` is unchanged: the parent toggles.
    selectedAnnotationTemplateIds = null,
}) {

    // data

    const spriteImage = useAnnotationSpriteImage();

    // helpers

    const noTemplates = !annotationTemplates?.length > 0;
    const multiple = Array.isArray(selectedAnnotationTemplateIds);
    const isSelected = (id) =>
        multiple
            ? selectedAnnotationTemplateIds.includes(id)
            : id === selectedAnnotationTemplateId;

    const groups = useMemo(() => {
        if (!listings?.length || !annotationTemplates?.length) return null;

        const listingMap = new Map(listings.map((l) => [l.id, l]));
        const grouped = new Map();

        for (const t of annotationTemplates) {
            const listingId = t.listingId;
            if (!grouped.has(listingId)) {
                grouped.set(listingId, {
                    listing: listingMap.get(listingId),
                    templates: [],
                });
            }
            grouped.get(listingId).templates.push(t);
        }

        // Only return groups that have a matching listing
        return [...grouped.values()]
            .filter((g) => g.listing)
            .map((g) => ({
                ...g,
                templates: groupAnnotationTemplatesByGroupLabel(g.templates),
            }));
    }, [listings, annotationTemplates]);

    if (noTemplates)
        return (
            <Box sx={{ p: 2 }}>
                <Typography variant="body2">Aucun style prédéfini</Typography>
            </Box>
        );

    // component

    const ListItem = ({ id, selected, annotation }) => {
        const suffix = getItemSuffix?.(annotation);
        return (
            <ListItemButton
                divider
                key={id}
                selected={selected}
                size="small"
                onClick={() => onChange(id)}
            >
                {multiple && (
                    <Checkbox
                        size="small"
                        edge="start"
                        checked={selected}
                        tabIndex={-1}
                        disableRipple
                        sx={{ p: 0.25, mr: 0.5 }}
                    />
                )}
                <ListItemIcon>
                    <AnnotationTemplateIcon
                        template={annotation}
                        spriteImage={spriteImage}
                        size={size}
                    />
                </ListItemIcon>
                <Typography
                    variant="body2"
                    sx={{ ml: 0, fontWeight: selected ? "bold" : "normal" }}
                >
                    {annotation?.label}
                </Typography>
                {suffix != null && suffix !== "" && (
                    <Typography
                        variant="caption"
                        sx={{ ml: "auto", pl: 1.5, color: "text.secondary", whiteSpace: "nowrap" }}
                    >
                        {suffix}
                    </Typography>
                )}
            </ListItemButton>
        );
    };

    // Grouped by listing
    if (groups?.length) {
        return (
            <BoxFlexVStretch>
                {showTitle && <Typography sx={{ p: 2 }}>{title}</Typography>}
                <BoxFlexVStretch sx={{ overflow: "auto" }}>
                    {groups.map(({ listing, templates }) => (
                        <List
                            key={listing.id}
                            dense
                            subheader={
                                <ListSubheader
                                    sx={{
                                        lineHeight: "32px",
                                        fontWeight: 600,
                                        fontSize: "0.75rem",
                                        color: "text.secondary",
                                        bgcolor: "action.hover",
                                    }}
                                >
                                    {listing.name ?? listing.label ?? "Liste"}
                                </ListSubheader>
                            }
                        >
                            {templates.map((t) => {
                                if (t.isGroupHeader) {
                                    return (
                                        <ListSubheader
                                            key={`group-${t.groupLabel}`}
                                            sx={{
                                                lineHeight: "24px",
                                                fontSize: "0.65rem",
                                                color: "text.disabled",
                                                textTransform: "uppercase",
                                                letterSpacing: 0.5,
                                                bgcolor: "transparent",
                                            }}
                                        >
                                            {t.groupLabel}
                                        </ListSubheader>
                                    );
                                }
                                return (
                                    <ListItem
                                        key={t.id}
                                        id={t.id}
                                        annotation={t}
                                        selected={isSelected(t.id)}
                                    />
                                );
                            })}
                        </List>
                    ))}
                </BoxFlexVStretch>
            </BoxFlexVStretch>
        );
    }

    // Flat fallback (no listings provided)
    return (
        <BoxFlexVStretch>
            {showTitle && <Typography sx={{ p: 2 }}>{title}</Typography>}
            <BoxFlexVStretch sx={{ overflow: "auto" }}>
                <List dense>
                    {groupAnnotationTemplatesByGroupLabel(
                        annotationTemplates?.filter((t) => !t.isFromAnnotation)
                    ).map((item) => {
                        if (item.isGroupHeader) {
                            return (
                                <ListSubheader
                                    key={`group-${item.groupLabel}`}
                                    sx={{
                                        lineHeight: "24px",
                                        fontSize: "0.65rem",
                                        color: "text.disabled",
                                        textTransform: "uppercase",
                                        letterSpacing: 0.5,
                                        bgcolor: "transparent",
                                    }}
                                >
                                    {item.groupLabel}
                                </ListSubheader>
                            );
                        }
                        const { id } = item;
                        const selected = isSelected(id);
                        return (
                            <ListItem
                                key={id}
                                id={id}
                                annotation={item}
                                selected={selected}
                            />
                        );
                    })}
                </List>
            </BoxFlexVStretch>
        </BoxFlexVStretch>
    );
}
