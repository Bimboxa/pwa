import FieldColorVariantToolbar from "Features/form/components/FieldColorVariantToolbar";

export default function FieldAnnotationColor({ annotation, onChange }) {

    // helper

    const color = annotation.type === "POLYLINE" ? annotation.strokeColor : annotation.fillColor;

    // handlers

    function handleChange(color) {
        if (annotation.type === "POLYLINE") {
            onChange({ ...annotation, strokeColor: color });
        } else {
            console.log("change annotation color", color);
            onChange({ ...annotation, fillColor: color });
        }
    }

    return (
        <FieldColorVariantToolbar value={color} onChange={handleChange} />
    );
}