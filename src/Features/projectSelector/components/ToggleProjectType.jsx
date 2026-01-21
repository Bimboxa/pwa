import { Box, ToggleButton, ToggleButtonGroup, Tooltip } from "@mui/material";

export default function ToggleProjectType({ value, valueOptions, onChange }) {

    function handleChange(e, v) {
        console.log("handleChange", v);
        onChange(v === value ? null : v);
    }


    return (
        <Box sx={{ display: "flex", justifyContent: "center", width: 1 }}>
            <ToggleButtonGroup
                onChange={handleChange}
                value={value}
                exclusive
            >
                {valueOptions?.map(({ key, label, icon }) => {
                    return (
                        <Tooltip title={label} key={key}>
                            <ToggleButton value={key} size="small">
                                {icon ?? label}
                            </ToggleButton>
                        </Tooltip>
                    );
                })}
            </ToggleButtonGroup>
        </Box>
    );

}