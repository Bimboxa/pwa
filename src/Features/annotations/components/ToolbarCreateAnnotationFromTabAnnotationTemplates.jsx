import { useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";
import { setNewAnnotation } from "../annotationsSlice";

import { Paper } from "@mui/material";


import ToolbarEnabledDrawingMode from "Features/mapEditor/components/ToolbarEnabledDrawingMode";

import getNewAnnotationPropsFromAnnotationTemplate from "../utils/getNewAnnotationPropsFromAnnotationTemplate";

export default function ToolbarCreateAnnotationFromTabAnnotationTemplates({ annotationTemplate }) {

    const dispatch = useDispatch();

    // effect

    useEffect(() => {
        if (annotationTemplate) {
            dispatch(setNewAnnotation(getNewAnnotationPropsFromAnnotationTemplate(annotationTemplate)))
        }

    }, [annotationTemplate?.id])

    // handlers



    return <ToolbarEnabledDrawingMode />
}