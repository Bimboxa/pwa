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

// Redux & Hooks
import { setSelectedMainBaseMapId, setSelectedBaseMapsListingId, setShowCreateBaseMapSection } from "Features/mapEditor/mapEditorSlice";
import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useBaseMaps from "../hooks/useBaseMaps";
import useDetailBaseMaps from "../hooks/useDetailBaseMaps";
import useProjectBaseMapListings from "../hooks/useProjectBaseMapListings";
import useDisabledBaseMapListingIds from "Features/baseMapEditor/hooks/useDisabledBaseMapListingIds";

export default function BaseMapSelectorInMapEditorV2({ onEdit }) {
    const dispatch = useDispatch();

    const activeBaseMap = useMainBaseMap();
    const { value: baseMaps = [] } = useBaseMaps({});
    const detailBaseMaps = useDetailBaseMaps() ?? [];
    const listings = useProjectBaseMapListings() ?? [];
    const { disabledListingIds } = useDisabledBaseMapListingIds();
    const updateEntity = useUpdateEntity();

    const showCreateBaseMapSection = useSelector((s) => s.mapEditor.showCreateBaseMapSection);

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
                <ButtonBase
                    onClick={handleOpen}
                    sx={{
                        height: 32,
                        pl: onEdit ? 0.5 : 2,
                        pr: 2,
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
                    {onEdit && (
                        <Tooltip title="Editer le fond de plan">
                            <Box
                                component="span"
                                role="button"
                                aria-label="Editer le fond de plan"
                                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                                sx={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: 24,
                                    height: 24,
                                    mr: 1,
                                    flexShrink: 0,
                                    borderRadius: "50%",
                                    bgcolor: "grey.600",
                                    color: "grey.100",
                                    transition: "0.2s",
                                    "&:hover": { bgcolor: "grey.500" },
                                }}
                            >
                                <EditIcon sx={{ fontSize: 14 }} />
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
                    <KeyboardArrowDownIcon
                        sx={{
                            fontSize: 18,
                            color: open ? "grey.500" : "rgba(255,255,255,0.7)",
                            transform: open ? 'rotate(180deg)' : 'none',
                            transition: '0.2s'
                        }}
                    />
                </ButtonBase>
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

                <Box sx={{ p: 0.5, borderTop: '1px solid', borderColor: 'grey.800', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    <ListItemButton
                        onClick={() => { dispatch(setShowCreateBaseMapSection(true)); handleClose(); }}
                        sx={{ borderRadius: 1 }}
                    >
                        <ListItemIcon sx={{ minWidth: 32 }}><AddIcon fontSize="small" sx={{ color: "grey.400" }} /></ListItemIcon>
                        <ListItemText
                            primary="Nouveau fond de plan"
                            primaryTypographyProps={{ variant: 'body2', color: "grey.300", fontWeight: 600 }}
                        />
                    </ListItemButton>
                </Box>
            </Popover>
        </ThemeProvider>
    );
}
