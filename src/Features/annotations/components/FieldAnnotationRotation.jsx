import useUpdateAnnotation from "../hooks/useUpdateAnnotation";

import FieldRotation from "../../form/components/FieldRotation";

export default function FieldAnnotationRotation({ annotation }) {

    // data

    const updateAnnotation = useUpdateAnnotation();

    // helpers

    const value = {
        rotation: annotation?.rotation,
    };

    // handlers

    async function handleChange(newValue) {
        const updates = { id: annotation.id, ...newValue };
        await updateAnnotation(updates);
    }

    // render

    return <FieldRotation value={value} onChange={handleChange} />;
}
