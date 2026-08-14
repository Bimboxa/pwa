import { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";

import useScopes from "Features/scopes/hooks/useScopes";
import useUpdateScope from "Features/scopes/hooks/useUpdateScope";

import { setSelectedScopeId } from "../scopesSlice";
import { setSelectedListingId } from "Features/listings/listingsSlice";

import db from "App/db/db";

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
import CloseIcon from "@mui/icons-material/Close";

export default function SectionScopeSelectorVariantList({
    onSelect,
    onEditingChange
}) {
    const dispatch = useDispatch();

    // --- Data ---
    const projectId = useSelector((s) => s.projects.selectedProjectId);
    const { value: scopes } = useScopes({ filterByProjectId: projectId });
    const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);


    // --- Rename Logic ---
    const updateScope = useUpdateScope();
    const [editingScopeId, setEditingScopeId] = useState(null);
    const [tempName, setTempName] = useState("");

    // Le parent verrouille la fermeture du menu tant qu'un renommage est en cours.
    // Le cleanup est nécessaire car le Menu MUI démonte ses enfants à la fermeture.
    useEffect(() => {
        onEditingChange?.(Boolean(editingScopeId));
        return () => onEditingChange?.(false);
    }, [editingScopeId, onEditingChange]);

    // --- Handlers ---

    async function handleSelect(id) {
        if (editingScopeId) return;

        dispatch(setSelectedScopeId(id));
        const scopeListings = await db.listings
            .where("scopeId")
            .equals(id)
            .toArray();
        const id0 = scopeListings?.[0]?.id;
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

    function handleRenameCancel(e) {
        if (e) e.stopPropagation();

        setEditingScopeId(null);
        setTempName("");
    }

    // --- Helpers ---

    // Alphabetical order; scope.name may be null → treated as empty string.
    const sortedScopes = [...(scopes ?? [])].sort((a, b) =>
        (a.name ?? "").localeCompare(b.name ?? "", undefined, {
            numeric: true,
            sensitivity: "base"
        })
    );

    const handleKeyDown = (e) => {
        // Empêche la frappe de remonter au Menu (navigation clavier par lettre, Echap)
        e.stopPropagation();

        if (e.key === 'Enter') {
            handleRenameSave(e);
        } else if (e.key === 'Escape') {
            handleRenameCancel(e);
        }
    };

    return (
        <List dense>
            {sortedScopes.map(scope => {
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

                        {/* Zone d'action (Bouton Edit ou Save / Cancel) */}
                        {isEditing ? (
                            <Box sx={{ display: "flex" }}>
                                <IconButton
                                    size="small"
                                    onClick={handleRenameSave}
                                    sx={{ color: "success.main" }}
                                >
                                    <CheckIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                    edge="end"
                                    size="small"
                                    onClick={handleRenameCancel}
                                    sx={{ color: "error.main" }}
                                >
                                    <CloseIcon fontSize="small" />
                                </IconButton>
                            </Box>
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