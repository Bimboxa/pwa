
import { useSelector } from "react-redux";

import ToolbarNewLabel from "Features/labels/components/ToolbarNewLabel";

export default function ToolbarNewAnnotation() {

    const newAnnotation = useSelector(s => s.annotations.newAnnotation);
    const type = newAnnotation?.type;

    return <>
        {type === "LABEL" && <ToolbarNewLabel />}
    </>
}