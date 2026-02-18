import { useSelector, useDispatch } from "react-redux"
import { setMapEditorMode } from "Features/mapEditor/mapEditorSlice"
import { Paper, Box } from "@mui/material"
import { AdsClick as QUICK_POINTS_CHANGE } from "@mui/icons-material"
import ToggleSingleSelectorGeneric from "Features/layout/components/ToggleSingleSelectorGeneric"

export default function SelectorMapEditorMode() {
    const dispatch = useDispatch()
    const mapEditorMode = useSelector(s => s.mapEditor.mapEditorMode)

    const isActive = mapEditorMode === "QUICK_POINTS_CHANGE"

    const options = [
        {
            key: "QUICK_POINTS_CHANGE",
            label: "Modification rapide des points",
            icon: <QUICK_POINTS_CHANGE />
        },
    ]

    function handleChangeMode(mode) {
        // Toggle : si on clique sur le mode déjà actif, on le désactive (null)
        const newMode = isActive ? null : mode
        dispatch(setMapEditorMode(newMode))
    }

    return (
        <Paper
            //elevation={isActive ? 1 : 3}
            sx={{
                borderRadius: '8px',
                transition: "all 0.2s ease",
                bgcolor: 'background.paper', // Fond opaque pour masquer le plan dessous
                border: 'none', // Suppression du border
                display: 'inline-flex',
                overflow: 'hidden',

                // --- ÉTAT ACTIF (Enfoncé) ---
                // ...(isActive && {
                //     boxShadow: (theme) => `inset 0px 2px 5px rgba(0,0,0,0.2)`,
                //     transform: 'scale(0.97)',
                // }),

                // --- ÉTAT INACTIF (Surélevé) ---
                ...(!isActive && {
                    '&:hover': {
                        elevation: 6,
                        transform: 'translateY(-2px)',
                    }
                })
            }}
        >
            <Box sx={{
                p: 0.5,
                // On force la couleur de l'icône à l'intérieur du Toggle quand il est actif
                '& .MuiSvgIcon-root': {
                    color: isActive ? 'primary.main' : 'text.secondary',
                }
            }}>
                <ToggleSingleSelectorGeneric
                    options={options}
                    selectedKey={mapEditorMode}
                    onChange={handleChangeMode}
                />
            </Box>
        </Paper>
    )
}