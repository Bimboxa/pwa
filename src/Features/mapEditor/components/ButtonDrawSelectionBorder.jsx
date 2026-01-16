import { IconButton } from "@mui/material";
import { SelectAll } from "@mui/icons-material";

export default function ButtonDrawSelectionBorder({ allAnnotations }) {

    // data

    const nodes = useSelector((s) => s.mapEditor.selectedNodes);

    // helper

    const multiSelect = nodes?.length > 1;

    // render

    if (!multiSelect) return null;

    return (
        <IconButton>
            <SelectAll />
        </IconButton>
    );
}