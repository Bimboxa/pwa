import { useState } from "react";

import { useDispatch } from "react-redux";

import { IconButton, Menu } from "@mui/material";

import Settings from "@mui/icons-material/Settings";

import ButtonShowBgImage from "Features/bgImage/components/ButtonShowBgImage";



export default function ButtonMenuMapEditorSettings() {
    const dispatch = useDispatch();

    // state
    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);

    // handlers
    const handleClick = (event) => {
        setAnchorEl(event.currentTarget);
    };
    const handleClose = () => {
        setAnchorEl(null);
    };




    return <>

        <IconButton onClick={handleClick}>
            <Settings />
        </IconButton>

        <Menu
            anchorEl={anchorEl}
            open={open}
            onClose={handleClose}
        >
            <ButtonShowBgImage />
        </Menu>
    </>
}