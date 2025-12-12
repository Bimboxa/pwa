import { useSelector, useDispatch } from "react-redux";

import { setShowedFWC } from "../fwcSlice";

import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";

import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import { VerticalAlignBottom as FloorIcon, VerticalAlignTop as CeilingIcon, } from "@mui/icons-material";

export default function SectionShowedFWC() {

    const dispatch = useDispatch();

    // strings

    const title = "Sol, mur, plafond";

    // data

    const showedFWC = useSelector((state) => state.fwc.showedFWC);
    const annotations = useAnnotationsV2({ withEntity: true });

    // helpers

    const entities = annotations.map(a => a.entity);
    const fwcCountMap = entities.reduce((ac, cur) => {
        if (cur?.fwc) {
            ac[cur.fwc] = (ac[cur.fwc] || 0) + 1;
        }
        return ac;
    }, {})

    // helpers

    const items = [
        {
            key: "CEILING",
            label: "Plafond",
            enabled: showedFWC.includes("CEILING"),
            icon: <CeilingIcon fontSize="small" sx={{ color: "inherit" }} />,
            count: fwcCountMap?.CEILING
        },
        {
            key: "WALL",
            label: "Mur",
            enabled: showedFWC.includes("WALL"),
            icon: <FloorIcon sx={{ transform: "rotate(90deg)", color: "inherit" }} fontSize="small" />,
            count: fwcCountMap?.WALL
        },
        {
            key: "FLOOR",
            label: "Sol",
            enabled: showedFWC.includes("FLOOR"),
            icon: <FloorIcon fontSize="small" sx={{ color: "inherit" }} />,
            count: fwcCountMap?.FLOOR
        }

    ]

    // handlers

    const handleClick = (key) => {
        if (showedFWC.includes(key)) {
            dispatch(setShowedFWC(showedFWC.filter((item) => item !== key)));
        } else {
            dispatch(setShowedFWC([...showedFWC, key]));
        }
    };

    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography sx={{ fontSize: 12 }}>{title}</Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {items.filter(item => item.count).map((item) => (
                    <Tooltip title={item.label} key={item.key} >
                        <Box sx={{
                            bgcolor: item.enabled ? "white" : "transparent",
                            color: item.enabled ? "text.secondary" : "action.disabled",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "24px",
                            height: "24px",
                            borderRadius: "50%",
                            border: theme => `1px solid ${theme.palette.divider}`,

                        }}>
                            <IconButton size="small" onClick={() => handleClick(item.key)} color="inherit">
                                {item.icon}
                            </IconButton>

                        </Box>
                    </Tooltip>
                ))}
            </Box>
        </Box>
    );
}