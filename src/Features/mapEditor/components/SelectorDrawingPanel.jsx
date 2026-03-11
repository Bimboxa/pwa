import { useSelector, useDispatch } from "react-redux";
import { toggleShowMapListingsPanel } from "Features/mapEditor/mapEditorSlice";
import { Paper, Box } from "@mui/material";
import { Draw as DrawIcon } from "@mui/icons-material";
import ToggleSingleSelectorGeneric from "Features/layout/components/ToggleSingleSelectorGeneric";

export default function SelectorDrawingPanel() {
    const dispatch = useDispatch();
    const showMapListingsPanel = useSelector(
        (s) => s.mapEditor.showMapListingsPanel
    );

    const options = [
        {
            key: "DRAWING_PANEL",
            label: "Repérer des annotations",
            icon: <DrawIcon />,
        },
    ];

    function handleChange() {
        dispatch(toggleShowMapListingsPanel());
    }

    return (
        <Paper
            sx={{
                borderRadius: "8px",
                transition: "all 0.2s ease",
                bgcolor: "background.paper",
                border: "none",
                display: "inline-flex",
                overflow: "hidden",
                ...(!showMapListingsPanel && {
                    "&:hover": {
                        elevation: 6,
                        transform: "translateY(-2px)",
                    },
                }),
            }}
        >
            <Box
                sx={{
                    p: 0.5,
                    "& .MuiSvgIcon-root": {
                        color: showMapListingsPanel
                            ? "primary.main"
                            : "text.secondary",
                    },
                }}
            >
                <ToggleSingleSelectorGeneric
                    options={options}
                    selectedKey={showMapListingsPanel ? "DRAWING_PANEL" : null}
                    onChange={handleChange}
                />
            </Box>
        </Paper>
    );
}
