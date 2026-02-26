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
    IconButton,
    alpha,
    createTheme,
    ThemeProvider,
    InputBase,
    Menu,
    MenuItem,
    Popover,
    ButtonBase
} from "@mui/material";

// Icons
import AddIcon from "@mui/icons-material/Add";
import MapIcon from "@mui/icons-material/Map";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import MoreVertIcon from "@mui/icons-material/MoreVert";

// Redux & Hooks (inchangés)
import { setSelectedMainBaseMapId, setShowCreateBaseMapSection } from "Features/mapEditor/mapEditorSlice";
import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useBaseMaps from "../hooks/useBaseMaps";
import useListingById from "Features/listings/hooks/useListingById";
import SelectorMapsListingVariantChips from "./SelectorMapsListingVariantChips";

export default function BaseMapSelectorInMapEditorV2() {
    const dispatch = useDispatch();

    const activeBaseMap = useMainBaseMap();
    const listingId = useSelector((s) => s.mapEditor.selectedBaseMapsListingId);
    const projectId = useSelector(s => s.projects.selectedProjectId);
    const { value: baseMaps = [] } = useBaseMaps({ filterByListingId: listingId });
    const baseMapsListing = useListingById(listingId);
    const updateEntity = useUpdateEntity();

    const [anchorEl, setAnchorEl] = useState(null);
    const [moreMenuAnchor, setMoreMenuAnchor] = useState(null);
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

    // --- Handlers ---
    const handleOpen = (event) => setAnchorEl(event.currentTarget);
    const handleClose = () => { setAnchorEl(null); setEditingMapId(null); };
    const handleOpenMoreMenu = (e) => { e.stopPropagation(); setMoreMenuAnchor(e.currentTarget); };
    const handleCloseMoreMenu = () => setMoreMenuAnchor(null);

    const handleSelectMap = (map) => {
        if (editingMapId === map.id) return;
        dispatch(setSelectedMainBaseMapId(map.id));
        handleClose();
    };

    return (
        <ThemeProvider theme={darkTheme}>
            <Box sx={{ display: "flex", justifyContent: "center" }}>
                <ButtonBase
                    onClick={handleOpen}
                    sx={{
                        height: 32,
                        px: 2,
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
                            overflow: "hidden"
                        }
                    }
                }}
            >
                <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'grey.800' }}>
                    <SelectorMapsListingVariantChips />
                </Box>

                <List dense sx={{ maxHeight: 350, overflowY: 'auto', py: 0 }}>
                    {baseMaps.map((map) => {
                        const isSelected = activeBaseMap?.id === map.id;
                        const thumbnail = typeof map.getThumbnail === 'function' ? map.getThumbnail() : null;

                        return (
                            <ListItem
                                key={map.id}
                                disablePadding
                                secondaryAction={
                                    editingMapId === map.id ? (
                                        <Box sx={{ display: 'flex' }}>
                                            <IconButton
                                                size="small"
                                                onClick={(e) => { e.stopPropagation(); updateEntity(map.id, { name: tempName }, { listing: baseMapsListing }); setEditingMapId(null); }}
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
                                                    updateEntity(map.id, { name: tempName }, { listing: baseMapsListing });
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
                </List>

                <Box sx={{ p: 0.5, borderTop: '1px solid', borderColor: 'grey.800', display: 'flex', alignItems: 'center' }}>
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
                    <IconButton size="small" onClick={handleOpenMoreMenu} sx={{ mr: 1, color: "grey.500" }}>
                        <MoreVertIcon fontSize="small" />
                    </IconButton>
                </Box>
            </Popover>

            <Menu
                anchorEl={moreMenuAnchor}
                open={Boolean(moreMenuAnchor)}
                onClose={handleCloseMoreMenu}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <MenuItem onClick={() => { window.open('/gmap', '_blank'); handleCloseMoreMenu(); handleClose(); }}>
                    <ListItemIcon><MapIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Image satellite</ListItemText>
                </MenuItem>
            </Menu>
        </ThemeProvider>
    );
}