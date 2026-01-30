import { useSelector, useDispatch } from "react-redux";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Box, Stepper, Step, StepButton } from "@mui/material";

import { setStepKey } from "../scopeCreatorSlice";

export default function SectionStepper() {
    const dispatch = useDispatch();

    // data

    const appConfig = useAppConfig();
    const stepKey = useSelector((s) => s.scopeCreator.stepKey);
    const projectId = useSelector(s => s.projects.selectedProjectId);

    // helpers - steps

    const projectS = appConfig?.strings?.project?.nameSingular ?? "Projet";
    const scopeS = appConfig?.strings?.scope?.nameSingular ?? "Dossier";

    const allSteps = [
        { key: "SEARCH_PROJECT", label: projectS },
        { key: "SELECT_PRESET_SCOPE", label: scopeS },
        { key: "CREATE_SCOPE", label: "Créer" },
    ];

    const steps = !projectId ? allSteps : allSteps.slice(1);


    // helper - activeStep

    const activeStepIndex = (steps.findIndex(({ key }) => key === stepKey) ?? 0);

    if (stepKey === "CREATE_PROJECT") return null


    return <Box sx={{ p: 1, py: 3 }}>
        <Stepper activeStep={activeStepIndex} alternativeLabel >
            {steps.map(({ key, label }) => (
                <Step key={label} >
                    <StepButton
                        onClick={() => dispatch(setStepKey(key))}
                        sx={{
                            '& .MuiStepLabel-label.Mui-active': {
                                color: 'secondary.main',
                            },
                            '& .MuiStepIcon-root.Mui-active': {
                                color: 'secondary.main',
                            },
                            '& .MuiStepIcon-root.Mui-completed': {
                                color: 'secondary.main',
                            },
                        }}
                    >
                        {label}
                    </StepButton>
                </Step>
            ))}
        </Stepper>
    </Box>;
}