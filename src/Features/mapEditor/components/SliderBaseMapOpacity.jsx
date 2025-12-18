import { useSelector, useDispatch } from "react-redux";

import FieldSlider from "Features/form/components/FieldSlider";

import { setBaseMapOpacity } from "../mapEditorSlice";

export default function SliderBaseMapOpacity() {
    const dispatch = useDispatch();

    const opacity = useSelector(s => s.mapEditor.baseMapOpacity);


    const handleOpacityChange = (value) => {
        dispatch(setBaseMapOpacity(value));
    };

    return (
        <FieldSlider
            label="Opacité"
            value={opacity}
            onChange={handleOpacityChange}
            valueLabelDisplay="auto"
        />
    );
}