import { useSelector, useDispatch } from "react-redux";

import { setShowedFWC } from "../fwcSlice";

import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";

import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import { VerticalAlignBottom as FloorIcon, VerticalAlignTop as CeilingIcon, FilterAlt as FilterAltIcon } from "@mui/icons-material";

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

    // helpers - show
    const show = Object.values(fwcCountMap).some(count => count > 0);

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

    // --- MODIFICATION ICI ---
    const handleClick = (key, e) => {
        e.stopPropagation();

        // CAS 1 : SHIFT est pressé -> Mode "Add/Remove" (Multi-select)
        if (e.shiftKey) {
            if (showedFWC.includes(key)) {
                // On retire uniquement cet item
                dispatch(setShowedFWC(showedFWC.filter((item) => item !== key)));
            } else {
                // On ajoute cet item aux existants
                dispatch(setShowedFWC([...showedFWC, key]));
            }
        }
        // CAS 2 : Pas de SHIFT -> Mode "Single Select"
        else {
            // Est-ce que cet item est DÉJÀ sélectionné et est-il le SEUL ?
            const isOnlySelected = showedFWC.length === 1 && showedFWC[0] === key;

            if (isOnlySelected) {
                // Si c'est le seul sélectionné et qu'on reclique dessus -> On désélectionne tout
                dispatch(setShowedFWC([]));
            } else {
                // Sinon (soit il n'était pas sélectionné, soit il y en avait d'autres) -> On ne sélectionne QUE lui
                dispatch(setShowedFWC([key]));
            }
        }
    };

    if (!show) return null;

    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <FilterAltIcon sx={{ fontSize: 12 }} color="action" />
            <Typography sx={{ fontSize: 12 }}>{title}</Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {items.filter(item => item.count).map((item) => (
                    <Tooltip
                        // Optionnel : Indiquer le raccourci dans le tooltip
                        title={`${item.label} (Shift+Click pour ajouter)`}
                        key={item.key}
                    >
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
                            // Petit ajout UX : changer le curseur si clickable
                            cursor: "pointer"
                        }}>
                            <IconButton size="small" onClick={(e) => handleClick(item.key, e)} color="inherit">
                                {item.icon}
                            </IconButton>

                        </Box>
                    </Tooltip>
                ))}
            </Box>
        </Box>
    );
}