import { useEffect, useState } from "react";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Box } from "@mui/material";

// Step « 0 » of the countdown, over the dialog backdrop: the words of
// appConfig.features.starting.goWords (default ["GO"]; edx: GO, KRTO…) take
// turns, blinking, with a stereoscopic (anaglyph) red / cyan fringe.
const WORD_MS = 900;
const DEFAULT_WORDS = ["GO"];

export default function SectionGo() {
  // data

  const appConfig = useAppConfig();

  // helpers

  const configWords = appConfig?.features?.starting?.goWords;
  const words =
    Array.isArray(configWords) && configWords.length
      ? configWords.map(String)
      : DEFAULT_WORDS;

  // state

  // `tick` keys the word element so the blink restarts at every beat, even
  // with a single word.
  const [tick, setTick] = useState(0);
  const word = words[tick % words.length];

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), WORD_MS);
    return () => clearInterval(timer);
  }, []);

  // render

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      <Box
        key={tick}
        data-word={word}
        sx={{
          position: "relative",
          color: "primary.main",
          fontWeight: 900,
          fontSize: "clamp(96px, 22vw, 320px)",
          lineHeight: 1,
          letterSpacing: "0.06em",
          animation: `startingGoBlink ${WORD_MS}ms steps(1, end) 1`,
          "@keyframes startingGoBlink": {
            "0%": { opacity: 1 },
            "55%": { opacity: 1 },
            "62%": { opacity: 0 },
            "70%": { opacity: 1 },
            "80%": { opacity: 0 },
            "88%": { opacity: 1 },
            "100%": { opacity: 1 },
          },
          // anaglyph fringes: a red copy to the left, a cyan one to the right
          "&::before, &::after": {
            content: "attr(data-word)",
            position: "absolute",
            top: 0,
            left: 0,
            mixBlendMode: "multiply",
            opacity: 0.85,
            animation: "startingGoShift 1.8s ease-in-out infinite",
          },
          "&::before": {
            color: "#ff2a2a",
            "--shift": "-1",
          },
          "&::after": {
            color: "#00c8ff",
            "--shift": "1",
            animationDelay: "-0.9s",
          },
          "@keyframes startingGoShift": {
            "0%, 100%": {
              transform: "translateX(calc(var(--shift) * 0.03em))",
            },
            "50%": { transform: "translateX(calc(var(--shift) * 0.09em))" },
          },
        }}
      >
        {word}
      </Box>
    </Box>
  );
}
