import { useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";
import { setNewAnnotation } from "../annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";

import { Box } from "@mui/material";

import ToggleSingleSelectorGeneric from "Features/layout/components/ToggleSingleSelectorGeneric";

import { getDrawingToolsByShape, getDrawingToolByKey } from "Features/mapEditor/constants/drawingTools.jsx";
import { resolveShapeCategory } from "Features/annotations/constants/drawingShapes.jsx";
import { resolveDrawingShape } from "Features/annotations/constants/drawingShapeConfig";
import getNewAnnotationPropsFromAnnotationTemplate from "../utils/getNewAnnotationPropsFromAnnotationTemplate";

export default function ToolbarCreateAnnotationFromTabAnnotationTemplates({ annotationTemplate }) {

    const dispatch = useDispatch();

    // data

    const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
    const drawingShape = resolveDrawingShape(annotationTemplate);

    // helpers

    const shapeCategory = resolveShapeCategory(drawingShape);
    const iconColor = shapeCategory === "polyline"
        ? (annotationTemplate?.strokeColor ?? annotationTemplate?.fillColor ?? "inherit")
        : (annotationTemplate?.fillColor ?? annotationTemplate?.strokeColor ?? "inherit");

    const tools = getDrawingToolsByShape(drawingShape);
    const options = tools.map(({ key, label, Icon }) => ({
        key,
        label,
        icon: <Icon sx={{ color: iconColor }} />,
    }));

    // effect - sync newAnnotation type with the current tool when template changes
    // NOTE: Do NOT dispatch setEnabledDrawingMode here, as this component mounts
    // on hover (Popper). Auto-selecting a tool on hover would be premature.

    useEffect(() => {
        if (!annotationTemplate) return;

        const baseProps = getNewAnnotationPropsFromAnnotationTemplate(annotationTemplate);

        // If a drawing tool is already active and valid for this shape, use its annotationType
        const availableTools = getDrawingToolsByShape(drawingShape);
        const currentTool = getDrawingToolByKey(enabledDrawingMode);
        const isCurrentToolValid = availableTools.some((t) => t.key === enabledDrawingMode);

        if (isCurrentToolValid && currentTool?.annotationType) {
            dispatch(setNewAnnotation({ ...baseProps, type: currentTool.annotationType }));
        } else {
            dispatch(setNewAnnotation(baseProps));
        }
    }, [annotationTemplate?.id])

    // handlers

    function handleChange(mode) {
        // Update the drawing mode
        dispatch(setEnabledDrawingMode(mode));

        // If the tool defines an annotationType, override newAnnotation.type
        const tool = getDrawingToolByKey(mode);
        if (tool?.annotationType && annotationTemplate) {
            const baseProps = getNewAnnotationPropsFromAnnotationTemplate(annotationTemplate);
            dispatch(setNewAnnotation({ ...baseProps, type: tool.annotationType }));
        }
    }

    // render

    if (options.length === 0) return null;

    return (
        <Box sx={{ display: "flex", alignItems: "center", p: 1 }}>
            <ToggleSingleSelectorGeneric
                options={options}
                selectedKey={enabledDrawingMode}
                onChange={handleChange}
            />
        </Box>
    );
}
