import { ToggleButton } from "@mui/material";
import IconEraser from "Features/icons/IconEraser";

export default function FieldAnnotationIsEraser({ annotation, onChange }) {


    // helpers

    const isEraser = annotation.isEraser;

    // handlers

    function handleChange() {
        onChange({ ...annotation, isEraser: !isEraser });
    }

    return (
        <ToggleButton size="small" selected={isEraser} onChange={handleChange}>
            <IconEraser />
        </ToggleButton>
    );
}