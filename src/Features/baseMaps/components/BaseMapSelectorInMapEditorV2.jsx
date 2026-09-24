import { useState, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";

// MUI
import {
    Box,
    Typography,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    ListItemIcon,
    ListSubheader,
    IconButton,
    createTheme,
    ThemeProvider,
    useTheme,
    InputBase,
    Popover,
    ButtonBase,
    Tooltip
} from "@mui/material";

// Icons
import AddIcon from "@mui/icons-material/Add";
import MapIcon from "@mui/icons-material/Map";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import LayersIcon from "@mui/icons-material/Layers";

// Redux & Hooks
import { setSelectedMainBaseMapId, setSelectedBaseMapsListingId, setShowCreateBaseMapSection } from "Features/mapEditor/mapEditorSlice";
import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useBaseMaps from "../hooks/useBaseMaps";
import useDetailBaseMaps from "../hooks/useDetailBaseMaps";
import useProjectBaseMapListings from "../hooks/useProjectBaseMapListings";
import useDisabledBaseMapListingIds from "Features/baseMapEditor/hooks/useDisabledBaseMapListingIds";
import useAnnotationsCountByBaseMapId from "Features/annotations/hooks/useAnnotationsCountByBaseMapId";
import useMainBaseMapVisibilityToggles from "../hooks/useMainBaseMapVisibilityToggles";

// Mirrors the 3D/Viewer chips band (TopBaseMapChipsThreed) for the main
// baseMap: a layers "eye" toggling the image visibility in the DISPLAYED
// editor, 2D or 3D (`showImageToggle`), the name, and a badge with its
// annotations count toggling their visibility (same shared state as the band).
// `onEdit` (Dessin module) is now reachable from the popover footer.
export default function BaseMapSelectorInMapEditorV2({ onEdit, showImageToggle = false }) {
    // strings
    const createS = "Créer un fond de plan";
    const editS = "Éditer le fond de plan";
    const hideImageS = "Masquer l'image du fond de plan";
    const showImageS = "Afficher l'image du fond de plan";
    const hideAnnotationsS = "Masquer les annotations";
    const showAnnotationsS = "Afficher les annotations";

    const dispatch = useDispatch();

    // The local dark theme below drops the app palette: read the global
    // secondary (the chips' "image on" color) before entering the provider.
    const appTheme = useTheme();
    const secondaryMain = appTheme.palette.secondary.main;
    const secondaryContrast = appTheme.palette.secondary.contrastText;

    const activeBaseMap = useMainBaseMap();
    const { value: baseMaps = [] } = useBaseMaps({});
    const detailBaseMaps = useDetailBaseMaps() ?? [];
    const listings = useProjectBaseMapListings() ?? [];
    const { disabledListingIds } = useDisabledBaseMapListingIds();
    const updateEntity = useUpdateEntity();

    const showCreateBaseMapSection = useSelector((s) => s.mapEditor.showCreateBaseMapSection);
    // Same rule as the chips band: in the BaseMaps module the drawing
    // annotations are not loaded unless the panel switch loads them.
    const hideAnnotationsBadge = useSelector(
        (s) => s.viewers.selectedViewerKey === "BASE_MAPS" && !s.baseMapEditor.showAnnotations
    );
    const annotationsCountByBaseMapId = useAnnotationsCountByBaseMapId();
    const annotationsCount = annotationsCountByBaseMapId[activeBaseMap?.id] ?? 0;
    const { imageOn, annotationsOn, toggleImage, toggleAnnotations } =
        useMainBaseMapVisibilityToggles();

    const [anchorEl, setAnchorEl] = useState(null);
    const [editingMapId, setEditingMapId] = useState(null);
    const [tempName, setTempName] = useState("");

    const open = Boolean(anchorEl);

    const darkTheme = useMemo(() => createTheme({
        palette: {
            mode: 'dark',
            background: { paper: '#1e1e1e' },
            primary: { main: '#90caf9' }
        }
    }), []);

    // --- Helpers ---

    // Filter the baseMaps (not the listings): filtering listings alone would
    // dump the disabled listings' baseMaps into the "Autres" leftover group.
    const enabledBaseMaps = useMemo(
        () => baseMaps.filter((bm) => !disabledListingIds.includes(bm?.listingId)),
        [baseMaps, disabledListingIds]
    );

    const groups = useMemo(() => {
        const byListing = new Map();
        for (const bm of enabledBaseMaps) {
            const key = bm.listingId ?? "__none__";
            if (!byListing.has(key)) byListing.set(key, []);
            byListing.get(key).push(bm);
        }
        // ordered by the project listings order, then any leftover groups
        const ordered = [];
        for (const listing of listings) {
            if (byListing.has(listing.id)) {
                ordered.push({ listing, baseMaps: byListing.get(listing.id) });
                byListing.delete(listing.id);
            }
        }
        for (const [key, bms] of byListing) {
            ordered.push({ listing: { id: key, name: "Autres" }, baseMaps: bms });
        }
        // Detail baseMaps belong to no listing: appended as their own group,
        // listed from their raw records (no BaseMap instance, no rename).
        if (detailBaseMaps.length > 0) {
            ordered.push({ listing: { id: "__DETAILS__", name: "Détails" }, baseMaps: detailBaseMaps });
        }
        return ordered;
    }, [enabledBaseMaps, listings, detailBaseMaps]);

    // --- Handlers ---
    const handleOpen = (event) => setAnchorEl(event.currentTarget);
    const handleClose = () => { setAnchorEl(null); setEditingMapId(null); };
    const handleCreate = () => dispatch(setShowCreateBaseMapSection(true));
    const handleToggleImage = (e) => {
        e.stopPropagation();
        toggleImage();
    };
    const handleToggleAnnotations = (e) => {
        e.stopPropagation();
        toggleAnnotations();
    };

    const handleSelectMap = (map) => {
        if (editingMapId === map.id) return;
        dispatch(setSelectedMainBaseMapId(map.id));
        // Keep the listing selection in sync: baseMap creation & url params
        // still read selectedBaseMapsListingId.
        if (map.listingId) dispatch(setSelectedBaseMapsListingId(map.listingId));
        handleClose();
    };

    if (showCreateBaseMapSection) return null;

    return (
        <ThemeProvider theme={darkTheme}>
            <Box sx={{ display: "flex", justifyContent: "center" }}>
                {/* Single dark pill: selector (ButtonBase) + create affordance (IconButton) */}
                <Box
                    sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        height: 32,
                        pr: 0.5,
                        borderRadius: 20,
                        // Utilisation des gris MUI
                        bgcolor: open ? "grey.800" : "#252525",
                        border: "1px solid",
                        borderColor: open ? "grey.600" : "rgba(255,255,255,0.1)",
                        transition: "all 0.2s ease",
                        "&:hover": {
                            bgcolor: open ? "grey.700" : "#333",
                            borderColor: open ? "grey.500" : "rgba(255,255,255,0.3)",
                        },
                    }}
                >
                    <ButtonBase
                        onClick={handleOpen}
                        sx={{
                            height: "100%",
                            pl: showImageToggle ? 0.5 : 2,
                            pr: 1.5,
                            borderRadius: "20px 0 0 20px",
                        }}
                    >
                        {showImageToggle && (
                            <Tooltip title={imageOn ? hideImageS : showImageS}>
                                <Box
                                    component="span"
                                    role="button"
                                    aria-label={imageOn ? hideImageS : showImageS}
                                    onClick={handleToggleImage}
                                    sx={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        width: 24,
                                        height: 24,
                                        mr: 1,
                                        flexShrink: 0,
                                        borderRadius: "50%",
                                        bgcolor: imageOn ? secondaryMain : "grey.700",
                                        color: imageOn ? secondaryContrast : "grey.400",
                                        border: "1px solid",
                                        borderColor: imageOn ? "transparent" : "rgba(255,255,255,0.25)",
                                        transition: "0.2s",
                                        "&:hover": { filter: "brightness(1.15)" },
                                    }}
                                >
                                    <LayersIcon sx={{ fontSize: 14 }} />
                                </Box>
                            </Tooltip>
                        )}
                        <Typography
                            variant="body2"
                            sx={{
                                fontWeight: 600,
                                mr: 1,
                                // Texte légèrement grisé quand ouvert pour adoucir
                                color: open ? "grey.300" : "#ffffff",
                                fontSize: "0.85rem"
                            }}
                        >
                            {activeBaseMap?.name || "Sélectionner un plan"}
                        </Typography>
                        {activeBaseMap && !hideAnnotationsBadge && (
                            <Tooltip title={annotationsOn ? hideAnnotationsS : showAnnotationsS}>
                                <Box
                                    component="span"
                                    role="button"
                                    aria-label={annotationsOn ? hideAnnotationsS : showAnnotationsS}
                                    onClick={handleToggleAnnotations}
                                    sx={{
                                        minWidth: 24,
                                        px: 0.75,
                                        py: 0.125,
                                        mr: 1,
                                        borderRadius: "8px",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        bgcolor: annotationsOn ? secondaryMain : "transparent",
                                        border: "1px solid",
                                        borderColor: annotationsOn ? "transparent" : "rgba(255,255,255,0.35)",
                                        transition: "0.2s",
                                        "&:hover": { filter: "brightness(1.15)", borderColor: "rgba(255,255,255,0.6)" },
                                    }}
                                >
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            fontWeight: 600,
                                            lineHeight: 1.4,
                                            color: annotationsOn ? secondaryContrast : "grey.500",
                                        }}
                                    >
                                        {annotationsCount}
                                    </Typography>
                                </Box>
                            </Tooltip>
                        )}
                        <KeyboardArrowDownIcon
                            sx={{
                                fontSize: 18,
                                color: open ? "grey.500" : "rgba(255,255,255,0.7)",
                                transform: open ? 'rotate(180deg)' : 'none',
                                transition: '0.2s'
                            }}
                        />
                    </ButtonBase>
                    {/* Thin vertical separator between the selector and the "+" */}
                    <Box sx={{ width: "1px", height: 16, bgcolor: "rgba(255,255,255,0.2)", flexShrink: 0 }} />
                    <Tooltip title={createS}>
                        <IconButton
                            size="small"
                            aria-label={createS}
                            onClick={handleCreate}
                            sx={{
                                ml: 0.5,
                                width: 24,
                                height: 24,
                                color: "rgba(255,255,255,0.7)",
                                transition: "0.2s",
                                "&:hover": {
                                    bgcolor: "rgba(255,255,255,0.12)",
                                    color: "#ffffff",
                                },
                            }}
                        >
                            <AddIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                transformOrigin={{ vertical: 'top', horizontal: 'center' }}
                slotProps={{
                    paper: {
                        sx: {
                            width: 320,
                            mt: 1,
                            borderRadius: 2,
                            backgroundImage: "none",
                            bgcolor: "#1e1e1e",
                            boxShadow: "0px 8px 24px rgba(0,0,0,0.6)",
                            border: "1px solid",
                            borderColor: "grey.800",
                            overflow: "hidden",
                            display: "flex",
                            flexDirection: "column",
                            // Cap the menu height (viewport-aware): the list
                            // scrolls, the footer stays visible.
                            maxHeight: "min(60vh, 480px)"
                        }
                    }
                }}
            >
                {groups.length === 0 ? (
                    <Box sx={{ p: 2 }}>
                        <Typography variant="body2" color="grey.500">
                            Aucun fond de plan dans ce projet.
                        </Typography>
                    </Box>
                ) : (
                    <List dense sx={{ flex: 1, minHeight: 0, overflowY: 'auto', py: 0 }}>
                        {groups.map(({ listing, baseMaps: groupMaps }) => {
                            // Renaming goes through the listing entity machinery —
                            // not applicable to details / leftover fake listings.
                            const canRename = Boolean(listing?.table);

                            return (
                                <li key={listing.id}>
                                    <ul style={{ padding: 0 }}>
                                        <ListSubheader
                                            sx={{
                                                bgcolor: "#1e1e1e",
                                                color: "grey.500",
                                                fontSize: "0.7rem",
                                                lineHeight: "28px",
                                                textTransform: "uppercase",
                                                letterSpacing: 0.5,
                                            }}
                                        >
                                            {listing.name}
                                        </ListSubheader>
                                        {groupMaps.map((map) => {
                                            const isSelected = activeBaseMap?.id === map.id;
                                            const thumbnail = typeof map.getThumbnail === 'function'
                                                ? map.getThumbnail()
                                                : map.image?.thumbnail ?? null;

                                            return (
                                                <ListItem
                                                    key={map.id}
                                                    disablePadding
                                                    secondaryAction={
                                                        !canRename ? undefined : editingMapId === map.id ? (
                                                            <Box sx={{ display: 'flex' }}>
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={(e) => { e.stopPropagation(); updateEntity(map.id, { name: tempName }, { listing }); setEditingMapId(null); }}
                                                                    sx={{ color: 'success.main' }}
                                                                >
                                                                    <CheckIcon fontSize="inherit" />
                                                                </IconButton>
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={(e) => { e.stopPropagation(); setEditingMapId(null); }}
                                                                    sx={{ color: 'error.main' }}
                                                                >
                                                                    <CloseIcon fontSize="inherit" />
                                                                </IconButton>
                                                            </Box>
                                                        ) : (
                                                            <IconButton
                                                                size="small"
                                                                className="edit-icon"
                                                                onClick={(e) => { e.stopPropagation(); setEditingMapId(map.id); setTempName(map.name); }}
                                                                sx={{ opacity: 0, transition: '0.2s' }}
                                                            >
                                                                <EditIcon fontSize="inherit" />
                                                            </IconButton>
                                                        )
                                                    }
                                                    sx={{
                                                        '&:hover .edit-icon': { opacity: 1 },
                                                        // Surbrillance en gris foncé au lieu de bleu
                                                        bgcolor: isSelected ? "rgba(255, 255, 255, 0.05)" : 'transparent'
                                                    }}
                                                >
                                                    <ListItemButton onClick={() => handleSelectMap(map)} sx={{ py: 1 }}>
                                                        <ListItemIcon sx={{ minWidth: 36 }}>
                                                            {isSelected ? (
                                                                <CheckIcon sx={{ color: "grey.300" }} fontSize="small" />
                                                            ) : thumbnail ? (
                                                                <Box component="img" src={thumbnail} sx={{ width: 24, height: 24, borderRadius: 0.5 }} />
                                                            ) : (
                                                                <MapIcon fontSize="small" sx={{ color: "grey.600" }} />
                                                            )}
                                                        </ListItemIcon>
                                                        {editingMapId === map.id ? (
                                                            <InputBase
                                                                value={tempName}
                                                                onChange={(e) => setTempName(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    e.stopPropagation();
                                                                    if (e.key === "Enter") {
                                                                        updateEntity(map.id, { name: tempName }, { listing });
                                                                        setEditingMapId(null);
                                                                    } else if (e.key === "Escape") {
                                                                        setEditingMapId(null);
                                                                    }
                                                                }}
                                                                onClick={(e) => e.stopPropagation()}
                                                                autoFocus
                                                                sx={{ color: "grey.100", fontSize: "0.875rem", flex: 1 }}
                                                            />
                                                        ) : (
                                                            <ListItemText
                                                                primary={map.name}
                                                                primaryTypographyProps={{
                                                                    variant: 'body2',
                                                                    color: isSelected ? "grey.100" : "grey.400",
                                                                    fontWeight: isSelected ? 600 : 400
                                                                }}
                                                            />
                                                        )}
                                                    </ListItemButton>
                                                </ListItem>
                                            );
                                        })}
                                    </ul>
                                </li>
                            );
                        })}
                    </List>
                )}

                <Box sx={{ p: 0.5, borderTop: '1px solid', borderColor: 'grey.800', display: 'flex', flexDirection: 'column', alignItems: 'stretch', flexShrink: 0 }}>
                    <ListItemButton
                        onClick={() => { handleCreate(); handleClose(); }}
                        sx={{ borderRadius: 1 }}
                    >
                        <ListItemIcon sx={{ minWidth: 32 }}><AddIcon fontSize="small" sx={{ color: "grey.400" }} /></ListItemIcon>
                        <ListItemText
                            primary="Nouveau fond de plan"
                            primaryTypographyProps={{ variant: 'body2', color: "grey.300", fontWeight: 600 }}
                        />
                    </ListItemButton>
                    {onEdit && activeBaseMap && (
                        <ListItemButton
                            onClick={() => { onEdit(); handleClose(); }}
                            sx={{ borderRadius: 1 }}
                        >
                            <ListItemIcon sx={{ minWidth: 32 }}><EditIcon fontSize="small" sx={{ color: "grey.400" }} /></ListItemIcon>
                            <ListItemText
                                primary={editS}
                                primaryTypographyProps={{ variant: 'body2', color: "grey.300", fontWeight: 600 }}
                            />
                        </ListItemButton>
                    )}
                </Box>
            </Popover>
        </ThemeProvider>
    );
}
