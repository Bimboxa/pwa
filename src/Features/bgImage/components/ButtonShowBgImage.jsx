import { useDispatch, useSelector } from "react-redux";

import { setShowBgImageInMapEditor } from "../bgImageSlice";

import FieldCheck from "Features/form/components/FieldCheck";


export default function ButtonShowBgImage() {
    const dispatch = useDispatch();
    const showBgImage = useSelector((s) => s.bgImage.showBgImageInMapEditor);
    return (
        <FieldCheck
            label="Afficher le gabarit"
            value={showBgImage}
            onChange={(value) => dispatch(setShowBgImageInMapEditor(value))}
            options={{
                type: "switch"
            }}
        />
    );
}