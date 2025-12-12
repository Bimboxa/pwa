import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop';
import ToggleSingleSelectorGeneric from "Features/layout/components/ToggleSingleSelectorGeneric";

export default function FieldToggleFWC({ value, onChange }) {

    // const

    const options = [
        { key: "FLOOR", label: "Sol", icon: <VerticalAlignBottomIcon /> },
        { key: "WALL", label: "Mur", icon: <VerticalAlignTopIcon sx={{ transform: "rotate(90deg)" }} /> },
        { key: "CEILING", label: "Plafond", icon: <VerticalAlignTopIcon /> },
    ];

    // handlers

    const handleChange = (fwc) => {
        onChange(fwc)
    }

    // render

    return <ToggleSingleSelectorGeneric
        options={options}
        selectedKey={value}
        onChange={handleChange}
    />
}