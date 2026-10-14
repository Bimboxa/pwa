import { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";

import {
    DndContext,
    closestCenter,
    PointerSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    SortableContext,
    useSortable,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import useScopes from "Features/scopes/hooks/useScopes";
import useUpdateScope from "Features/scopes/hooks/useUpdateScope";
import useReorderScopes from "Features/scopes/hooks/useReorderScopes";

import { setSelectedScopeId } from "../scopesSlice";

import {
    List,
    ListItemText,
    MenuItem,
    IconButton,
    InputBase,
    Box,
    ListItemIcon,
    Tooltip
} from "@mui/material";

// Icons
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import DragIndicator from "@mui/icons-material/DragIndicator";

// ---------------------------------------------------------------------------
// Sortable row: the drag handle (shown on hover) is the only drag source, so a
// plain click still selects the scope and the edit button still works. The
// row is not sortable while it is being renamed.
// ---------------------------------------------------------------------------

function SortableMenuItemScope({
    scope,
    selected,
    isEditing,
    tempName,
    onSelect,
    onTempNameChange,
    onKeyDown,
    onEditStart,
    onRenameSave,
    onRenameCancel
}) {
    // strings

    const dragS = "Glisser pour réordonner";

    // data

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: scope.id, disabled: isEditing });

    // render

    return (
        <MenuItem
            ref={setNodeRef}
            selected={selected}
            onClick={() => onSelect(scope.id)}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
                zIndex: isDragging ? 1200 : "auto",
                opacity: isDragging ? 0.8 : 1
            }}
            sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                pl: 0.5,
                "&:hover .edit-btn": {
                    opacity: 1,
                    visibility: "visible"
                },
                // Opacity only (never visibility: hidden) so the handle keeps
                // its pointer events — a touch device has no hover.
                "&:hover .scopeDragHandle": { opacity: isEditing ? 0 : 1 }
            }}
        >
            <Tooltip title={isEditing ? "" : dragS} arrow placement="left">
                <Box
                    component="span"
                    className="scopeDragHandle"
                    {...(isEditing ? {} : attributes)}
                    {...(isEditing ? {} : listeners)}
                    onClick={(e) => e.stopPropagation()}
                    sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        flexShrink: 0,
                        mr: 0.5,
                        color: "text.secondary",
                        cursor: isEditing ? "default" : "grab",
                        touchAction: "none",
                        opacity: isDragging ? 1 : 0,
                        transition: "opacity 0.15s ease",
                        "&:active": { cursor: isEditing ? "default" : "grabbing" }
                    }}
                >
                    <DragIndicator sx={{ fontSize: 16 }} />
                </Box>
            </Tooltip>

            {/* Check icon when selected */}
            <ListItemIcon sx={{ minWidth: 36, display: 'flex', alignItems: 'center' }}>
                {selected && <CheckIcon fontSize="small" color="primary" />}
            </ListItemIcon>

            {/* Content (text or rename input) */}
            <Box sx={{ flex: 1, mr: 1, overflow: "hidden" }}>
                {isEditing ? (
                    <InputBase
                        value={tempName}
                        onChange={(e) => onTempNameChange(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={onKeyDown}
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

            {/* Actions (edit, or save / cancel) */}
            {isEditing ? (
                <Box sx={{ display: "flex" }}>
                    <IconButton
                        size="small"
                        onClick={onRenameSave}
                        sx={{ color: "success.main" }}
                    >
                        <CheckIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                        edge="end"
                        size="small"
                        onClick={onRenameCancel}
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
                    onClick={(e) => onEditStart(e, scope)}
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
}

export default function SectionScopeSelectorVariantList({
    onSelect,
    onEditingChange
}) {
    const dispatch = useDispatch();

    // --- Data ---
    const projectId = useSelector((s) => s.projects.selectedProjectId);
    // Already in display order (sortIndex, then name) — see sortScopes.
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

    // --- Drag & drop reorder ---
    const reorderScopes = useReorderScopes();

    const sensors = useSensors(
        // 5px activation distance keeps plain clicks (select / edit) working.
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates
        })
    );

    const scopeIds = (scopes ?? []).map((s) => s.id);

    // --- Handlers ---

    // The current module is kept (useLandingViewerModuleOnScopeOpen lands only
    // on scope open). The selected listing follows the scope through
    // useAutoSelectListing: a listing of the previous scope is dropped and the
    // first annotation listing of the new one is selected.
    function handleSelect(id) {
        if (editingScopeId) return;

        dispatch(setSelectedScopeId(id));

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

    const handleDragEnd = (event) => reorderScopes(event, scopes);

    // --- Helpers ---

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
        <DndContext
            id="scope-selector-dnd"
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <SortableContext
                items={scopeIds}
                strategy={verticalListSortingStrategy}
            >
                <List dense>
                    {(scopes ?? []).map(scope => (
                        <SortableMenuItemScope
                            key={scope.id}
                            scope={scope}
                            selected={scope.id === selectedScopeId}
                            isEditing={editingScopeId === scope.id}
                            tempName={tempName}
                            onSelect={handleSelect}
                            onTempNameChange={setTempName}
                            onKeyDown={handleKeyDown}
                            onEditStart={handleEditStart}
                            onRenameSave={handleRenameSave}
                            onRenameCancel={handleRenameCancel}
                        />
                    ))}
                </List>
            </SortableContext>
        </DndContext>
    );
}
