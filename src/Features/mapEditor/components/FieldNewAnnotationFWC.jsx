import { useDispatch } from "react-redux";
import { useSelector } from "react-redux";

import { setNewAnnotation } from "Features/annotations/annotationsSlice";

import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop';
import ToggleSingleSelectorGeneric from "Features/layout/components/ToggleSingleSelectorGeneric";

export default function FieldNewAnnotationFWC() {

    const dispatch = useDispatch();

    // data

    const newAnnotation = useSelector((s) => s.annotations.newAnnotation);

    // const

    const options = [
        { key: "FLOOR", label: "Sol", icon: <VerticalAlignBottomIcon /> },
        { key: "WALL", label: "Mur", icon: <VerticalAlignTopIcon sx={{ transform: "rotate(90deg)" }} /> },
        { key: "CEILING", label: "Plafond", icon: <VerticalAlignTopIcon /> },
    ];

    // handlers

    const handleChange = (fwc) => {
        dispatch(setNewAnnotation({ ...newAnnotation, fwc }));
    }

    // render

    return <ToggleSingleSelectorGeneric
        options={options}
        selectedKey={newAnnotation.fwc}
        onChange={handleChange}
    />
}