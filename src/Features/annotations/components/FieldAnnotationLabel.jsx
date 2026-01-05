import FieldTextV2 from "Features/form/components/FieldTextV2";

export default function FieldAnnotationLabel({ annotation, onChange }) {

    // helper

    const label = annotation.label ?? "";

    // handlers

    function handleChange(label) {
        onChange({ ...annotation, label });
    }

    return (
        <FieldTextV2 value={label} onChange={handleChange} />
    );
}