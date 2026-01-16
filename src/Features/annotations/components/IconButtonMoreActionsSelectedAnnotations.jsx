import { useState } from "react";

import useMergeAnnotations from "Features/annotations/hooks/useMergeAnnotations";

import { IconButton, Menu, MenuItem } from "@mui/material";
import { MoreVert as MoreActionsIcon } from "@mui/icons-material";

export default function IconButtonMoreActionsSelectedAnnotations({ annotations }) {

    // data

    const mergeAnnotations = useMergeAnnotations();


    // state

    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);

    // helpers

    const actions = [
        {
            label: "Fusionner",
            handler: async () => {
                console.log("merge annotations", annotations)
                await mergeAnnotations(annotations);
                setAnchorEl(null);
            }
        },
        {
            label: "Supprimer",
            handler: () => {
                console.log("Supprimer")
            }
        }
    ]

    // handlers

    const handleClick = (event) => {
        setAnchorEl(event.currentTarget);
    }

    const handleClose = () => {
        setAnchorEl(null);
    }

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
                {actions.map((action) => (
                    <MenuItem key={action.label} onClick={action.handler}>
                        {action.label}
                    </MenuItem>
                ))}
            </Menu>
        </>
    );
}