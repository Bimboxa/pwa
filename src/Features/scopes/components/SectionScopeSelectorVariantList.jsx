import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";

import useScopes from "Features/scopes/hooks/useScopes";
import useUpdateScope from "Features/scopes/hooks/useUpdateScope";

import { setSelectedScopeId } from "../scopesSlice";
import { setSelectedListingId } from "Features/listings/listingsSlice";

import {
    List,
    ListItemText,
    MenuItem,
    IconButton,
    InputBase,
    Box,
    ListItemIcon // Import ajouté
} from "@mui/material";

// Icons
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";

export default function SectionScopeSelectorVariantList({ onSelect }) {
    const dispatch = useDispatch();

    // --- Data ---
    const projectId = useSelector((s) => s.projects.selectedProjectId);
    const { value: scopes } = useScopes({ filterByProjectId: projectId });
    const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);


    // --- Rename Logic ---
    const updateScope = useUpdateScope();
    const [editingScopeId, setEditingScopeId] = useState(null);
    const [tempName, setTempName] = useState("");

    // --- Handlers ---

    function handleSelect(id) {
        if (editingScopeId === id) return;

        dispatch(setSelectedScopeId(id));
        const scope = scopes.find(s => s.id === id);
        const listings = scope?.sortedListings;

        const id0 = listings?.[0]?.id;
        console.log("debug_3012 [scope] selected listing", id0);
        dispatch(setSelectedListingId(id0));

        if (onSelect) onSelect();
    }

    const handleEditStart = (e, scope) => {
        e.stopPropagation();
        setEditingScopeId(scope.id);
        setTempName(scope.name || "");
    };

    async function handleRenameSave(e) {
        if (e) e.stopPropagation();

        if (editingScopeId && tempName.trim() !== "") {
            await updateScope({
                id: editingScopeId,
                name: tempName
            });
            setEditingScopeId(null);
        }
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleRenameSave(e);
        } else if (e.key === 'Escape') {
            setEditingScopeId(null);
        }
    };

    return (
        <List dense>
            {scopes?.map(scope => {
                const selected = scope.id === selectedScopeId;
                const isEditing = editingScopeId === scope.id;

                return (
                    <MenuItem
                        key={scope.id}
                        selected={selected}
                        onClick={() => handleSelect(scope.id)}
                        sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            "&:hover .edit-btn": {
                                opacity: 1,
                                visibility: "visible"
                            }
                        }}
                    >
                        {/* --- AJOUT: Icon Check si sélectionné --- */}
                        <ListItemIcon sx={{ minWidth: 36, display: 'flex', alignItems: 'center' }}>
                            {selected && <CheckIcon fontSize="small" color="primary" />}
                        </ListItemIcon>

                        {/* Zone de contenu (Texte ou Input) */}
                        <Box sx={{ flex: 1, mr: 1, overflow: "hidden" }}>
                            {isEditing ? (
                                <InputBase
                                    value={tempName}
                                    onChange={(e) => setTempName(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={handleKeyDown}
                                    autoFocus
                                    fullWidth
                                    sx={{
                                        fontSize: 'inherit',
                                        fontFamily: 'inherit',
                                        borderBottom: "1px solid",
                                        borderColor: "primary.main"
                                    }}
                                />
                            ) : (
                                <ListItemText
                                    primary={scope.name}
                                    primaryTypographyProps={{ noWrap: true }}
                                />
                            )}
                        </Box>

                        {/* Zone d'action (Bouton Edit ou Save) */}
                        {isEditing ? (
                            <IconButton
                                edge="end"
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
                                size="small"
                                onClick={(e) => handleEditStart(e, scope)}
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
                        )}
                    </MenuItem>
                );
            })}
        </List>
    );
}