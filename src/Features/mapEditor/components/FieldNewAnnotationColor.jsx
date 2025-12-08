import { useDispatch } from "react-redux";
import { useSelector } from "react-redux";

import { setNewAnnotation } from "Features/annotations/annotationsSlice";

import FieldColorVariantToolbar from "Features/form/components/FieldColorVariantToolbar";


export default function FieldNewAnnotationColor() {

    const dispatch = useDispatch();

    // data

    const newAnnotation = useSelector((s) => s.annotations.newAnnotation);

    // strings

    const labelS = "Libellé";

    // handlers

    const handleColorChange = (color) => {
        dispatch(setNewAnnotation({ ...newAnnotation, fillColor: color, strokeColor: color }));
    }

    // render

    return <FieldColorVariantToolbar
        value={newAnnotation.fillColor || newAnnotation.strokeColor}
        onChange={handleColorChange}
    />
}