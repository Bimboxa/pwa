import { useState, useEffect } from "react";

import useUpdateAnnotation from "../hooks/useUpdateAnnotation";
import FieldSizeAndUnit from "../../form/components/FieldSizeAndUnit";

export default function FieldAnnotationSizeAndUnit({ annotation }) {

    // data

    const updateAnnotation = useUpdateAnnotation();

    // local state — optimistic copy so successive changes always merge against
    // the latest value, not a stale annotation prop from the DB.

    const [localValue, setLocalValue] = useState({
        size: annotation?.size ?? null,
        sizeUnit: annotation?.sizeUnit ?? "PX",
    });

    // Sync when a different annotation is selected (tracked by id)
    useEffect(() => {
        setLocalValue({
            size: annotation?.size ?? null,
            sizeUnit: annotation?.sizeUnit ?? "PX",
        });
    }, [annotation?.id]);

    // handlers

    async function handleChange(newValue) {
        console.log("debug_0203_field_annotation_size_and_unit", newValue);
        // 1. Update local state immediately → next change merges against this
        setLocalValue(newValue);
        // 2. Persist to DB
        const updates = { id: annotation.id, ...newValue };
        await updateAnnotation(updates);
    }

    // render

    return <FieldSizeAndUnit value={localValue} onChange={handleChange} />;
}
