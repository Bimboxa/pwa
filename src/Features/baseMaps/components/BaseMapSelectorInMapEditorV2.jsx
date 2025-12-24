import { useState, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";

import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";
import { setShowCreateBaseMapSection } from "Features/mapEditor/mapEditorSlice";

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
    ThemeProvider
} from "@mui/material";

// Icons
import AddIcon from "@mui/icons-material/Add";
import MapIcon from "@mui/icons-material/Map";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";

// Hooks / Components simulés
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useBaseMaps from "../hooks/useBaseMaps";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import ContainerFilesSelector from "Features/files/components/ContainerFilesSelector";
import { setOpenBaseMapCreator, setPdfFile } from "Features/baseMapCreator/baseMapCreatorSlice";

import testIsPdf from "Features/pdf/utils/testIsPdf";
import testIsImage from "Features/files/utils/testIsImage";

export default function BaseMapSelectorInMapEditorV2() {
    const dispatch = useDispatch();

    // --- Data ---
    const activeBaseMap = useMainBaseMap();
    const listingId = useSelector((s) => s.mapEditor.selectedBaseMapsListingId);
    const { value: baseMaps = [] } = useBaseMaps({
        filterByListingId: listingId,
    });

    // --- State ---
    const [isHovered, setIsHovered] = useState(false);
    const [openFileSelector, setOpenFileSelector] = useState(false);

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
    const handleMouseLeave = () => setIsHovered(false);

    const handleSelectMap = (map) => {
        console.log("Sélection de la map :", map.name);
        setIsHovered(false);
        dispatch(setSelectedMainBaseMapId(map.id));
    };

    const handleEditMap = (e, map) => {
        e.stopPropagation();
        console.log("Ouverture de l'édition pour :", map.name);
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

    function handleCreateClick() {
        dispatch(setShowCreateBaseMapSection(true));
    }

    const activeBaseMapName = activeBaseMap?.name || "Sélectionner une carte";
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
                    elevation={isHovered ? 8 : 2}
                    sx={{
                        width: isHovered ? OPEN_WIDTH : "fit-content",
                        maxWidth: "90vw",
                        transition: (theme) => theme.transitions.create(
                            ['width', 'max-height', 'border-radius', 'background-color', 'border-color'],
                            { duration: 250, easing: theme.transitions.easing.easeInOut }
                        ),
                        maxHeight: isHovered ? 500 : 48,
                        borderRadius: isHovered ? 2 : 50,
                        overflow: "hidden",
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
                            display: isHovered ? "none" : "flex",
                            alignItems: "center",
                            px: 2,
                            width: "100%",
                            boxSizing: "border-box"
                        }}
                    >
                        <Typography variant="body2" fontWeight="500" noWrap color="text.primary">
                            {activeBaseMapName}
                        </Typography>
                        <ExpandMoreIcon fontSize="small" sx={{ ml: 1, opacity: 0.6, flexShrink: 0, color: "text.secondary" }} />
                    </Box>

                    {/* --- B. VUE OUVERTE --- */}
                    <Fade in={isHovered} timeout={300}>
                        <Box sx={{
                            display: isHovered ? "flex" : "none",
                            flexDirection: "column",
                            height: "100%"
                        }}>
                            <Box sx={{ p: 2, pb: 1 }}>
                                <Typography variant="caption" color="text.secondary" fontWeight="bold">
                                    Fonds de plan
                                </Typography>
                            </Box>

                            <List dense sx={{ p: 0, overflowY: "auto", flex: 1 }}>
                                {baseMaps.map((map) => {
                                    const isSelected = activeBaseMap?.id === map.id;
                                    const imageUrl = map.getUrl();

                                    return (
                                        <ListItem
                                            key={map.id}
                                            disablePadding
                                            secondaryAction={
                                                isSelected && (
                                                    <IconButton
                                                        edge="end"
                                                        aria-label="edit"
                                                        size="small"
                                                        onClick={(e) => handleEditMap(e, map)}
                                                        sx={{ color: "primary.main" }}
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
                                                    pr: isSelected ? 6 : 2,
                                                    py: 1,
                                                    "&.Mui-selected": {
                                                        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.15),
                                                        borderLeft: (theme) => `4px solid ${theme.palette.primary.main}`,
                                                        pl: 1.5,
                                                        "&:hover": {
                                                            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.25),
                                                        }
                                                    },
                                                    "&:hover": {
                                                        bgcolor: "action.hover",
                                                    }
                                                }}
                                            >
                                                {/* --- MODIFICATION ICI --- */}
                                                <ListItemIcon sx={{ minWidth: 36, display: 'flex', alignItems: 'center' }}>
                                                    {isSelected ? (
                                                        <CheckIcon fontSize="small" color="primary" />
                                                    ) : (
                                                        // Affiche l'image si elle existe, sinon un icône générique
                                                        imageUrl ? (
                                                            <Box
                                                                component="img"
                                                                src={imageUrl}
                                                                alt=""
                                                                sx={{
                                                                    width: 28,
                                                                    height: 28,
                                                                    objectFit: "cover",
                                                                    borderRadius: 1, // Petit arrondi sympa
                                                                    border: 1,
                                                                    borderColor: "divider",
                                                                    bgcolor: "background.default"
                                                                }}
                                                            />
                                                        ) : (
                                                            <MapIcon fontSize="small" sx={{ color: "text.disabled" }} />
                                                        )
                                                    )}
                                                </ListItemIcon>

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
                                            </ListItemButton>
                                        </ListItem>
                                    );
                                })}
                            </List>

                            <Box sx={{ borderTop: 1, borderColor: "divider" }}>
                                <ListItemButton onClick={handleCreateClick} sx={{ py: 1.5 }}>
                                    <ListItemIcon sx={{ minWidth: 36 }}>
                                        <AddIcon fontSize="small" color="primary" />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary="Nouveau fond de plan ..."
                                        slotProps={{ primary: { variant: "body2", color: "primary", fontWeight: 500 } }}
                                    />
                                </ListItemButton>
                            </Box>
                        </Box>
                    </Fade>
                </Paper>
            </Box>

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