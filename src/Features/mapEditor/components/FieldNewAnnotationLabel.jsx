import { useDispatch } from "react-redux";
import { useSelector } from "react-redux";

import { setNewAnnotation } from "Features/annotations/annotationsSlice";

import FieldTextV2 from "Features/form/components/FieldTextV2";


export default function FieldNewAnnotationLabel() {

    const dispatch = useDispatch();

    // data

    const newAnnotation = useSelector((s) => s.annotations.newAnnotation);

    // strings

    const labelS = "Libellé";

    // handlers

    const handleLabelChange = (label) => {
        dispatch(setNewAnnotation({ ...newAnnotation, label }));
    }

    // render

    return <FieldTextV2
        value={newAnnotation.label}
        onChange={handleLabelChange}
        label={labelS}

        options={{
            fullWidth: true,
            placeholder: labelS
        }}
    />
}

