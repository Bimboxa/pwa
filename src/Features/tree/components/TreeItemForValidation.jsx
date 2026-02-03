import * as React from "react";
import { Typography, IconButton, Stack, Chip, TextField } from "@mui/material";
import {
    CheckCircleOutline as Check,
    HighlightOff as Close,
    EditOutlined as Edit,
    SaveOutlined as Save,
} from "@mui/icons-material";

// Tout est regroupé ici pour éviter les erreurs de résolution de fichiers
import {
    useTreeItem,
    TreeItemRoot,
    TreeItemContent,
    TreeItemIconContainer,
    TreeItemLabel,
    TreeItemCheckbox,
    TreeItemGroupTransition,
    TreeItemIcon,
    TreeItemProvider
} from '@mui/x-tree-view-pro';
import { useTreeItemModel } from '@mui/x-tree-view/hooks';

const TreeItemForValidation = React.forwardRef(function TreeItemForValidation(props, ref) {
    const { id, itemId, label, disabled, children, onAccept, onIgnore, onEdit } = props;

    // useTreeItemModel remplace useTreeViewApiContext().getItem() en v8
    const itemData = useTreeItemModel(itemId);

    const [isEditing, setIsEditing] = React.useState(false);
    const [editValue, setEditValue] = React.useState(label);

    const {
        getContextProviderProps,
        getRootProps,
        getContentProps,
        getIconContainerProps,
        getCheckboxProps,
        getGroupTransitionProps,
        status,
    } = useTreeItem({ id, itemId, children, label, disabled, rootRef: ref });

    const mod = itemData?.agentModification;
    const isNew = mod === "CREATE";
    const isDeleted = mod === "DELETE";
    const isUpdated = mod === "UPDATE";
    const hasMod = mod && mod !== "NONE";

    const handleSave = (e) => {
        if (e) e.stopPropagation();
        onEdit?.(itemId, editValue);
        setIsEditing(false);
    };

    return (
        <TreeItemProvider {...getContextProviderProps()}>
            <TreeItemRoot {...getRootProps()}>
                <TreeItemContent
                    {...getContentProps()}
                    sx={{
                        py: 0.5,
                        backgroundColor: isNew ? "#e8f5e9 !important" : isUpdated ? "#fff3e0 !important" : isDeleted ? "#ffebee !important" : "transparent",
                    }}
                >
                    <TreeItemIconContainer {...getIconContainerProps()}>
                        <TreeItemIcon status={status} />
                    </TreeItemIconContainer>

                    <TreeItemCheckbox {...getCheckboxProps()} />

                    <TreeItemLabel sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', minWidth: 0 }}>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ flexGrow: 1, minWidth: 0 }}>
                            {isEditing ? (
                                <TextField
                                    size="small"
                                    variant="standard"
                                    value={editValue}
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={handleSave}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSave(e)}
                                    sx={{ flexGrow: 1 }}
                                />
                            ) : (
                                <Typography
                                    variant="body2"
                                    noWrap
                                    sx={{
                                        textDecoration: isDeleted ? "line-through !important" : "none",
                                        fontWeight: hasMod ? 700 : 400,
                                        color: isDeleted ? "error.main" : isUpdated ? "warning.main" : "text.primary",
                                        opacity: isDeleted ? 0.6 : 1,
                                    }}
                                >
                                    {label}
                                </Typography>
                            )}
                            {isNew && <Chip label="IA" size="small" color="success" sx={{ height: 18, fontSize: 10 }} />}
                        </Stack>

                        <Stack direction="row" spacing={0} sx={{ ml: 1, flexShrink: 0 }}>
                            {isEditing ? (
                                <IconButton size="small" color="primary" onClick={handleSave}><Save fontSize="small" /></IconButton>
                            ) : (
                                <>
                                    {hasMod && (
                                        <>
                                            <IconButton size="small" color="success" onClick={(e) => { e.stopPropagation(); onAccept?.(itemId); }}>
                                                <Check fontSize="small" />
                                            </IconButton>
                                            <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); onIgnore?.(itemId); }}>
                                                <Close fontSize="small" />
                                            </IconButton>
                                        </>
                                    )}
                                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}>
                                        <Edit fontSize="small" />
                                    </IconButton>
                                </>
                            )}
                        </Stack>
                    </TreeItemLabel>
                </TreeItemContent>
                {children && <TreeItemGroupTransition {...getGroupTransitionProps()} />}
            </TreeItemRoot>
        </TreeItemProvider>
    );
});

export default TreeItemForValidation;