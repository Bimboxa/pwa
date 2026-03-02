import { Box, Typography, IconButton, InputBase } from "@mui/material";
import { useState, useRef, useEffect } from "react";
import { Refresh, Add, Remove } from "@mui/icons-material";
import WhiteSectionGeneric from "./WhiteSectionGeneric";

// Composant interne pour l'auto-resize du champ de saisie
function AutoResizeInput({ value, onChange, placeholder }) {
    const [width, setWidth] = useState(30);
    const spanRef = useRef(null);

    useEffect(() => {
        if (spanRef.current) {
            setWidth(Math.max(24, spanRef.current.offsetWidth + 4));
        }
    }, [value, placeholder]);

    return (
        <Box sx={{ display: "inline-flex", alignItems: "center", position: "relative" }}>
            <span
                ref={spanRef}
                style={{
                    position: "absolute",
                    visibility: "hidden",
                    whiteSpace: "pre",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    fontFamily: "inherit",
                }}
            >
                {value || placeholder}
            </span>
            <InputBase
                value={value ?? ""}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value.replace(",", "."))}
                sx={{
                    width: width,
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    "& input": {
                        textAlign: "center",
                        p: 0,
                        "&::placeholder": { color: "text.disabled", opacity: 1 },
                    },
                }}
            />
        </Box>
    );
}

export default function FieldRotation({ value, onChange }) {
    const rotation = value?.rotation ?? "";

    // Local state for immediate feedback while typing (debounced commit)
    const [localValue, setLocalValue] = useState(rotation);
    const debounceTimer = useRef(null);

    useEffect(() => {
        setLocalValue(value?.rotation ?? "");
    }, [value?.rotation]);

    const processValue = (inputValue) => {
        let valStr = String(inputValue).replace(",", ".");
        if (valStr.endsWith(".")) return valStr;
        const numberVal = parseFloat(valStr);
        return !isNaN(numberVal) ? numberVal : valStr;
    };

    function commitChange(raw) {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            onChange({ ...value, rotation: processValue(raw) });
        }, 400);
    }

    function handleInputChange(raw) {
        setLocalValue(raw);
        commitChange(raw);
    }

    function handleStep(delta) {
        const current = parseFloat(localValue) || 0;
        const next = current + delta;
        setLocalValue(String(next));
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        onChange({ ...value, rotation: next });
    }

    function handleReset() {
        setLocalValue("0");
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        onChange({ ...value, rotation: 0 });
    }

    return (
        <WhiteSectionGeneric>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>

                {/* Header : Titre + Reset */}
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Typography variant="body2" sx={{ fontWeight: "bold", color: "text.primary" }}>
                        Rotation
                    </Typography>

                    <IconButton size="small" onClick={handleReset} sx={{ p: 0.5 }}>
                        <Refresh sx={{ fontSize: 18 }} />
                    </IconButton>
                </Box>

                {/* Bloc principal */}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        bgcolor: "action.hover",
                        borderRadius: 2,
                        py: 0.75,
                        px: 1,
                        minHeight: 40,
                        justifyContent: "center",
                        gap: 0.5,
                    }}
                >
                    {/* Bouton − */}
                    <IconButton
                        size="small"
                        onClick={() => handleStep(-1)}
                        sx={{ p: 0.25, color: "text.secondary", "&:hover": { color: "primary.main" } }}
                    >
                        <Remove sx={{ fontSize: 16 }} />
                    </IconButton>

                    {/* Champ de saisie */}
                    <AutoResizeInput
                        value={localValue}
                        onChange={handleInputChange}
                        placeholder="0"
                    />

                    {/* Unité ° */}
                    <Typography
                        sx={{
                            color: localValue === "" ? "text.disabled" : "text.secondary",
                            fontWeight: "bold",
                            fontSize: "0.8125rem",
                            lineHeight: 1,
                        }}
                    >
                        °
                    </Typography>

                    {/* Bouton + */}
                    <IconButton
                        size="small"
                        onClick={() => handleStep(1)}
                        sx={{ p: 0.25, color: "text.secondary", "&:hover": { color: "primary.main" } }}
                    >
                        <Add sx={{ fontSize: 16 }} />
                    </IconButton>
                </Box>

            </Box>
        </WhiteSectionGeneric>
    );
}
