import { useState, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";

import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";
import { setShowCreateBaseMapSection } from "Features/mapEditor/mapEditorSlice";
import { setOpenBaseMapCreator, setPdfFile } from "Features/baseMapCreator/baseMapCreatorSlice";
import { setSelectedBaseMapsListingId } from "Features/mapEditor/mapEditorSlice";

import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useBaseMaps from "../hooks/useBaseMaps";

import {
    Box,
    Typography,
    Paper,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    ListItemIcon,
    IconButton,
    Fade,
    alpha,
    createTheme,
    ThemeProvider,
    InputBase,
    Menu,
    MenuItem
} from "@mui/material";

// Icons
import AddIcon from "@mui/icons-material/Add";
import MapIcon from "@mui/icons-material/Map";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import MoreVertIcon from "@mui/icons-material/MoreVert"; // [NOUVEAU]

// Hooks / Components simulés
import DialogGeneric from "Features/layout/components/DialogGeneric";
import ContainerFilesSelector from "Features/files/components/ContainerFilesSelector";

import testIsPdf from "Features/pdf/utils/testIsPdf";
import testIsImage from "Features/files/utils/testIsImage";
import SelectorMapsListingVariantChips from "./SelectorMapsListingVariantChips";

export default function BaseMapSelectorInMapEditorV2() {
    const dispatch = useDispatch();

    // --- Data ---

    const activeBaseMap = useMainBaseMap();
    const listingId = useSelector((s) => s.mapEditor.selectedBaseMapsListingId);
    const projectId = useSelector(s => s.projects.selectedProjectId);
    const { value: baseMaps = [] } = useBaseMaps({
        filterByListingId: listingId,
    });
    const updateEntity = useUpdateEntity();

    // --- State ---

    const [isHovered, setIsHovered] = useState(false);
    const [openFileSelector, setOpenFileSelector] = useState(false);

    // État pour gérer l'édition du nom
    const [editingMapId, setEditingMapId] = useState(null);
    const [tempName, setTempName] = useState("");

    // [NOUVEAU] État pour le menu "Plus d'options"
    const [menuAnchorEl, setMenuAnchorEl] = useState(null);
    const isMenuOpen = Boolean(menuAnchorEl);

    // --- FORCE DARK THEME ---
    const darkTheme = useMemo(() => createTheme({
        palette: {
            mode: 'dark',
            background: {
                paper: '#1e1e1e',
            },
            primary: {
                main: '#90caf9',
            }
        },
        typography: {
            button: {
                textTransform: 'none'
            }
        },
        components: {
            MuiPaper: {
                styleOverrides: {
                    root: {
                        backgroundImage: 'none',
                    }
                }
            }
        }
    }), []);

    // --- Handlers ---
    const handleMouseEnter = () => setIsHovered(true);
    const handleMouseLeave = () => {
        // On ne ferme pas le panneau si le menu est ouvert
        if (!isMenuOpen) {
            setIsHovered(false);
        }
    };

    const handleSelectMap = (map) => {
        if (editingMapId === map.id) return;
        console.log("Sélection de la map :", map.name);
        setIsHovered(false);
        dispatch(setSelectedMainBaseMapId(map.id));
    };

    const handleEditMap = (e, map) => {
        e.stopPropagation();
        setEditingMapId(map.id);
        setTempName(map.name || "");
    };

    async function handleRenameSave(e) {
        if (e) e.stopPropagation();

        if (editingMapId && tempName.trim() !== "") {
            const options = {
                listing: {
                    id: listingId,
                    projectId,
                    table: "baseMaps"
                }
            };

            await updateEntity(editingMapId, { name: tempName }, options);
            setEditingMapId(null);
        }
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleRenameSave(e);
        } else if (e.key === 'Escape') {
            setEditingMapId(null);
        }
    };

    const handleFilesChange = (files) => {
        const file = files[0];
        if (testIsPdf(file)) {
            dispatch(setOpenBaseMapCreator(true));
            dispatch(setPdfFile(file));
        } else if (testIsImage(file)) {
            console.log("image")
        }
        setOpenFileSelector(false);
    };

    // --- Handlers Menu Creation ---

    function handleCreateClick() {
        // Action par défaut (identique à "Créer une page blanche")
        dispatch(setShowCreateBaseMapSection(true));
        dispatch(setSelectedBaseMapsListingId(activeBaseMap?.listingId));
    }

    const handleOpenMenu = (event) => {
        event.stopPropagation();
        setMenuAnchorEl(event.currentTarget);
    };

    const handleCloseMenu = () => {
        setMenuAnchorEl(null);
        // On vérifie si la souris est toujours dessus pour gérer la fermeture du panneau principal
        // (Optionnel selon UX désirée, ici on laisse handleMouseLeave gérer)
    };

    const handleOptionBlankPage = () => {
        handleCreateClick();
        handleCloseMenu();
    };

    const handleOptionSatellite = () => {
        console.log("Ajouter une image satellite");
        // TODO: Dispatcher l'action ou ouvrir la modale pour l'image satellite ici
        handleCloseMenu();
        setMenuAnchorEl(null);
        const url = `${window.location.origin}/gmap`;
        window.open(url, "_blank", "noopener");
    };

    const activeBaseMapName = activeBaseMap?.name || "Sélectionner un fond de plan";
    const OPEN_WIDTH = 320;

    return (
        <ThemeProvider theme={darkTheme}>
            <Box
                sx={{
                    position: "absolute",
                    top: 0,
                    left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 1200,
                    p: 1,
                    display: "flex",
                    justifyContent: "center"
                }}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <Paper
                    elevation={isHovered || isMenuOpen ? 8 : 2}
                    sx={{
                        width: isHovered || isMenuOpen ? OPEN_WIDTH : "fit-content",
                        maxWidth: "90vw",
                        transition: (theme) => theme.transitions.create(
                            ['width', 'max-height', 'border-radius', 'background-color', 'border-color'],
                            { duration: 250, easing: theme.transitions.easing.easeInOut }
                        ),
                        maxHeight: isHovered || isMenuOpen ? 500 : 48,
                        borderRadius: isHovered || isMenuOpen ? 2 : 50,
                        overflow: "visible", // Changed from hidden to visible allow Menu logic (though Menu is portal)
                        display: "flex",
                        flexDirection: "column",
                        whiteSpace: "nowrap",
                        bgcolor: "background.paper",
                        border: (theme) => `1px solid ${theme.palette.divider}`,
                    }}
                >
                    {/* --- A. VUE FERMÉE --- */}
                    <Box
                        sx={{
                            height: 32,
                            display: (isHovered || isMenuOpen) ? "none" : "flex",
                            alignItems: "center",
                            px: 2,
                            width: "100%",
                            boxSizing: "border-box"
                        }}
                    >
                        <Typography variant="button" noWrap color="text.primary">
                            {activeBaseMapName}
                        </Typography>
                        <ExpandMoreIcon fontSize="small" sx={{ ml: 1, opacity: 0.6, flexShrink: 0, color: "text.secondary" }} />
                    </Box>

                    {/* --- B. VUE OUVERTE --- */}
                    <Fade in={isHovered || isMenuOpen} timeout={300}>
                        <Box sx={{
                            display: (isHovered || isMenuOpen) ? "flex" : "none",
                            flexDirection: "column",
                            height: "100%",
                            overflow: "hidden" // Restore overflow hidden for the inner content
                        }}>
                            <SelectorMapsListingVariantChips />

                            <List dense sx={{ p: 0, overflowY: "auto", flex: 1 }}>
                                {baseMaps.map((map) => {
                                    const isSelected = activeBaseMap?.id === map.id;
                                    const isEditing = editingMapId === map.id;
                                    //const imageUrl = map.getUrl();
                                    const thumbnail = map.getThumbnail();

                                    return (
                                        <ListItem
                                            key={map.id}
                                            disablePadding
                                            sx={{
                                                "&:hover .edit-btn": {
                                                    opacity: 1,
                                                    visibility: "visible"
                                                }
                                            }}
                                            secondaryAction={
                                                isEditing ? (
                                                    <IconButton
                                                        edge="end"
                                                        aria-label="save"
                                                        size="small"
                                                        onClick={handleRenameSave}
                                                        sx={{ color: "success.main" }}
                                                    >
                                                        <CheckIcon fontSize="small" />
                                                    </IconButton>
                                                ) : (
                                                    <IconButton
                                                        className="edit-btn"
                                                        edge="end"
                                                        aria-label="edit"
                                                        size="small"
                                                        onClick={(e) => handleEditMap(e, map)}
                                                        sx={{
                                                            color: "text.secondary",
                                                            opacity: 0,
                                                            visibility: "hidden",
                                                            transition: "all 0.2s",
                                                            "&:hover": { color: "primary.main" }
                                                        }}
                                                    >
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                )
                                            }
                                        >
                                            <ListItemButton
                                                selected={isSelected}
                                                onClick={() => handleSelectMap(map)}
                                                sx={{
                                                    pl: 2,
                                                    pr: 6,
                                                    py: 1,
                                                    "&.Mui-selected": {
                                                        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.15),
                                                        borderLeft: (theme) => `4px solid ${theme.palette.primary.main}`,
                                                        pl: 1.5,
                                                    },
                                                    "&:hover": { bgcolor: "action.hover" }
                                                }}
                                            >
                                                <ListItemIcon sx={{ minWidth: 36, display: 'flex', alignItems: 'center' }}>
                                                    {isSelected ? (
                                                        <CheckIcon fontSize="small" color="primary" />
                                                    ) : (
                                                        thumbnail ? (
                                                            <Box
                                                                component="img"
                                                                src={thumbnail}
                                                                alt=""
                                                                sx={{
                                                                    width: 28,
                                                                    height: 28,
                                                                    objectFit: "cover",
                                                                    borderRadius: 1,
                                                                    border: 1,
                                                                    borderColor: "divider",
                                                                    bgcolor: "white"
                                                                }}
                                                            />
                                                        ) : (
                                                            <MapIcon fontSize="small" sx={{ color: "text.disabled" }} />
                                                        )
                                                    )}
                                                </ListItemIcon>

                                                {isEditing ? (
                                                    <InputBase
                                                        value={tempName}
                                                        onChange={(e) => setTempName(e.target.value)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onKeyDown={handleKeyDown}
                                                        autoFocus
                                                        fullWidth
                                                        sx={{
                                                            fontSize: '0.875rem',
                                                            fontFamily: 'inherit',
                                                            color: 'text.primary',
                                                            ml: -0.5,
                                                            borderBottom: "1px solid",
                                                            borderColor: "primary.main"
                                                        }}
                                                    />
                                                ) : (
                                                    <ListItemText
                                                        primary={map.name}
                                                        slotProps={{
                                                            primary: {
                                                                variant: "body2",
                                                                fontWeight: isSelected ? 600 : 400,
                                                                noWrap: true,
                                                                color: "text.primary"
                                                            }
                                                        }}
                                                    />
                                                )}
                                            </ListItemButton>
                                        </ListItem>
                                    );
                                })}
                            </List>

                            {/* --- SECTION BAS : BOUTON CRÉER AVEC MENU --- */}
                            <Box sx={{ borderTop: 1, borderColor: "divider" }}>
                                <ListItem
                                    disablePadding
                                    secondaryAction={
                                        <IconButton
                                            edge="end"
                                            aria-label="options"
                                            onClick={handleOpenMenu}
                                            sx={{ mr: 0.5, color: "text.secondary" }}
                                        >
                                            <MoreVertIcon fontSize="small" />
                                        </IconButton>
                                    }
                                >
                                    <ListItemButton
                                        onClick={handleCreateClick}
                                        sx={{ py: 1.5, pr: 6 }} // pr padding pour éviter le chevauchement avec l'iconButton
                                    >
                                        <ListItemIcon sx={{ minWidth: 36 }}>
                                            <AddIcon fontSize="small" color="primary" />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary="Nouveau fond de plan ..."
                                            slotProps={{ primary: { variant: "body2", color: "primary", fontWeight: 500 } }}
                                        />
                                    </ListItemButton>
                                </ListItem>
                            </Box>
                        </Box>
                    </Fade>
                </Paper>
            </Box>

            {/* --- MENU D'OPTIONS --- */}
            <Menu
                anchorEl={menuAnchorEl}
                open={isMenuOpen}
                onClose={handleCloseMenu}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                }}
                transformOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                }}
                sx={{ zIndex: 1300 }}
            >
                {/* <MenuItem onClick={handleOptionBlankPage}>
                    <ListItemIcon>
                        <AddIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Créer une page blanche</ListItemText>
                </MenuItem> */}
                <MenuItem onClick={handleOptionSatellite}>
                    <ListItemIcon>
                        <MapIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Ajouter une image satellite</ListItemText>
                </MenuItem>
            </Menu>

            <DialogGeneric open={openFileSelector} onClose={() => setOpenFileSelector(false)}>
                <Box sx={{ p: 2 }}>
                    <ContainerFilesSelector
                        onFilesChange={handleFilesChange}
                        multiple={false}
                        accept={".pdf, .png, .jpeg"}
                    />
                </Box>
            </DialogGeneric>

        </ThemeProvider >
    );
}