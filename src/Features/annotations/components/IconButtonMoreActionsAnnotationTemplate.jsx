import { useState } from "react";

import { useDispatch } from "react-redux";

import useDeleteAnnotationTemplate from "../hooks/useDeleteAnnotationTemplate";
import useCreateAnnotationTemplate from "../hooks/useCreateAnnotationTemplate";

import { setSelectedItem } from "Features/selection/selectionSlice";

import { IconButton, Menu, MenuItem, Divider } from "@mui/material";
import { MoreVert as MoreActionsIcon } from "@mui/icons-material";
import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";


export default function IconButtonMoreActionsAnnotationTemplate({ annotationTemplate }) {

    const dispatch = useDispatch();

    // data

    const deleteAnnotationTemplate = useDeleteAnnotationTemplate();
    const createAnnotationTemplate = useCreateAnnotationTemplate();

    // state

    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);

    // handlers

    const handleClick = (event) => {
        event.stopPropagation();
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleDuplicate = async () => {
        const newTemplate = {
            ...annotationTemplate,
            label: annotationTemplate.label + " (copie)",
        }
        await createAnnotationTemplate(newTemplate);
        setAnchorEl(null);
    };

    const [openDelete, setOpenDelete] = useState(false);

    const handleDelete = () => {
        setAnchorEl(null);
        setOpenDelete(true);
    };

    return (
        <>
            <IconButton onClick={handleClick}>
                <MoreActionsIcon />
            </IconButton>

            <Menu
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
            >
                <MenuItem onClick={handleDuplicate}>Dupliquer</MenuItem>
                <Divider />
                <MenuItem onClick={handleDelete}>Supprimer</MenuItem>
            </Menu>

            <DialogDeleteRessource
                open={openDelete}
                onClose={() => setOpenDelete(false)}
                onConfirmAsync={async () => {
                    await deleteAnnotationTemplate(annotationTemplate.id);
                    dispatch(setSelectedItem({}))
                    setOpenDelete(false);
                }}
            />
        </>
    );
}