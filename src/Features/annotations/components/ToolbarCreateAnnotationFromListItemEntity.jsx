import { useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";
import { setNewAnnotation } from "../annotationsSlice";

import { Paper } from "@mui/material";

import ButtonDrawPolygon from "Features/mapEditor/components/ButtonDrawPolygon";
import ButtonDrawPolyline from "Features/mapEditor/components/ButtonDrawPolyline";
import FieldNewAnnotationLabel from "Features/mapEditor/components/FieldNewAnnotationLabel";
import FieldNewAnnotationColor from "Features/mapEditor/components/FieldNewAnnotationColor";

export default function ToolbarCreateAnnotationFromListItemEntity({ entityId }) {

    const dispatch = useDispatch();

    // data

    const newAnnotation = useSelector(s => s.annotations.newAnnotation);

    // effect

    useEffect(() => {
        dispatch(setNewAnnotation({
            ...newAnnotation,
            entityId,
        }))
    }, [entityId])

    return <Paper elevation={6} sx={{ p: 1, display: "flex", gap: 1 }}>

        <FieldNewAnnotationColor />
        <ButtonDrawPolygon />
        <ButtonDrawPolyline />
    </Paper>
}