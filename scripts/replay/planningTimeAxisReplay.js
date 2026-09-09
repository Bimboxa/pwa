// Node replay of the planning time-axis utils (CALENDAR working days ↔
// steps, DST, weekends, "now" position).
//
// Run from the repo root:
//   node_modules/.bin/esbuild scripts/replay/planningTimeAxisReplay.js \
//     --bundle --format=esm --platform=node \
//     --alias:Features=./src/Features --alias:App=./src/App \
//     --outfile=/tmp/planningTimeAxisReplay.mjs && node /tmp/planningTimeAxisReplay.mjs
//
// Exits 1 on any failure.

import {
  getStepsPerDay,
  normalizeStartDate,
  workingDayIndexToDate,
  dateToWorkingDayIndex,
  stepToDate,
  dateToStep,
  getNowStep,
  getTimeAxisColumns,
  getPlanningColumnCount,
} from "Features/planning/utils/planningTimeAxis";
import getWorkPackagePlayStatusById, {
  PLAY_STATUS,
} from "Features/planning/utils/getWorkPackagePlayStatusById";

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(
    `${ok ? "PASS" : "FAIL"} ${label}${ok ? "" : ` → got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`
  );
}

// steps per day
check("4h → 2 steps/day", getStepsPerDay({ stepHours: 4, hoursPerDay: 8 }), 2);
check("5h → 1 step/day", getStepsPerDay({ stepHours: 5, hoursPerDay: 8 }), 1);
check("8h → 1 step/day", getStepsPerDay({ stepHours: 8, hoursPerDay: 8 }), 1);

// weekend start normalization (2026-09-12 = Saturday, 2026-09-13 = Sunday)
check(
  "Saturday start → Monday",
  normalizeStartDate("2026-09-12"),
  "2026-09-14"
);
check("Sunday start → Monday", normalizeStartDate("2026-09-13"), "2026-09-14");
check("Wednesday start kept", normalizeStartDate("2026-09-09"), "2026-09-09");

// Friday + 1 working day → Monday (2026-09-11 = Friday)
check("Fri+1 → Mon", workingDayIndexToDate("2026-09-11", 1), "2026-09-14");
check("Wed+3 → Mon", workingDayIndexToDate("2026-09-09", 3), "2026-09-14");
check("index 0 = start", workingDayIndexToDate("2026-09-09", 0), "2026-09-09");

// round trips across DST changes (2026-03-29 spring, 2026-10-25 autumn)
for (const start of ["2026-03-23", "2026-10-19", "2026-09-09"]) {
  let ok = true;
  for (let i = 0; i <= 60; i++) {
    const date = workingDayIndexToDate(start, i);
    const back = dateToWorkingDayIndex(start, date);
    if (!back || back.dayIndex !== i || back.isWeekend) {
      ok = false;
      console.log(
        `  mismatch start=${start} i=${i} date=${date} back=${JSON.stringify(back)}`
      );
    }
  }
  check(`round trip 0..60 from ${start}`, ok, true);
}

// weekend date → previous Friday + isWeekend
check(
  "Saturday → Friday index",
  dateToWorkingDayIndex("2026-09-07", "2026-09-12"),
  { dayIndex: 4, isWeekend: true }
);
check(
  "Sunday → Friday index",
  dateToWorkingDayIndex("2026-09-07", "2026-09-13"),
  { dayIndex: 4, isWeekend: true }
);
check(
  "before start → null",
  dateToWorkingDayIndex("2026-09-07", "2026-09-04"),
  null
);
check("next Monday → 5", dateToWorkingDayIndex("2026-09-07", "2026-09-14"), {
  dayIndex: 5,
  isWeekend: false,
});

// step ↔ date
const cal = {
  timeAxisMode: "CALENDAR",
  stepHours: 4,
  hoursPerDay: 8,
  startDate: "2026-09-07",
};
check("step 3 → day 1 slot 1", stepToDate(cal, 3), {
  dayIndex: 1,
  slotIndex: 1,
  dateStr: "2026-09-08",
  startHour: 12,
});
check("dateToStep Wed slot 0 → 4", dateToStep(cal, "2026-09-09", 0), 4);

// now position
const at = (d, h, m = 0) => {
  const [y, mo, da] = d.split("-").map(Number);
  return new Date(y, mo - 1, da, h, m);
};
check("now before start → null", getNowStep(cal, at("2026-09-04", 10)), null);
check("Sunday → end of Friday", getNowStep(cal, at("2026-09-13", 10)), 10);
check("Tue 08:00 → 2", getNowStep(cal, at("2026-09-08", 8)), 2);
check("Tue 12:00 → 3", getNowStep(cal, at("2026-09-08", 12)), 3);
check("Tue 17:00 → 4", getNowStep(cal, at("2026-09-08", 17)), 4);
check("Tue 10:00 → 2.5", getNowStep(cal, at("2026-09-08", 10)), 2.5);
check(
  "STEPS mode → currentStep",
  getNowStep({ timeAxisMode: "STEPS", currentStep: 3.5 }),
  3.5
);

// columns
const cols = getTimeAxisColumns(cal, 4);
check(
  "columns day labels",
  cols.map((c) => c.dayLabel),
  ["lun. 07/09", "lun. 07/09", "mar. 08/09", "mar. 08/09"]
);
check(
  "columns sub labels",
  cols.map((c) => c.subLabel),
  ["8h", "12h", "8h", "12h"]
);
check(
  "week start flags",
  cols.map((c) => c.isWeekStart),
  [true, false, false, false]
);
const stepsCols = getTimeAxisColumns(
  { timeAxisMode: "STEPS", stepHours: 4, hoursPerDay: 8 },
  3
);
check(
  "STEPS labels",
  stepsCols.map((c) => [c.dayLabel, c.subLabel]),
  [
    ["J1", "1"],
    ["J1", "2"],
    ["J2", "3"],
  ]
);

// column count: whole days, trailing margin
check("column count min", getPlanningColumnCount(cal, [], null), 40);
check(
  "column count from slots",
  getPlanningColumnCount(cal, [{ startStep: 50, steps: 3 }], null),
  64
);

// play status at a step
const zones = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
const playSlots = [
  { workPackageId: "a", startStep: 0, steps: 2 }, // done from step 2
  { workPackageId: "b", startStep: 2, steps: 3 }, // in progress 2..4
  { workPackageId: "c", startStep: 6, steps: 1 }, // later
  { workPackageId: "d", startStep: 0, steps: 1 }, // two blocks: done + later
  { workPackageId: "d", startStep: 8, steps: 1 },
];
check(
  "play status at step 3",
  getWorkPackagePlayStatusById(zones, playSlots, 3),
  {
    a: PLAY_STATUS.DONE,
    b: PLAY_STATUS.IN_PROGRESS,
    c: PLAY_STATUS.TODO,
    d: PLAY_STATUS.TODO,
  }
);
check(
  "play status at step 0",
  getWorkPackagePlayStatusById(zones, playSlots, 0),
  {
    a: PLAY_STATUS.IN_PROGRESS,
    b: PLAY_STATUS.TODO,
    c: PLAY_STATUS.TODO,
    d: PLAY_STATUS.IN_PROGRESS,
  }
);
check(
  "play status at step 9",
  getWorkPackagePlayStatusById(zones, playSlots, 9),
  {
    a: PLAY_STATUS.DONE,
    b: PLAY_STATUS.DONE,
    c: PLAY_STATUS.DONE,
    d: PLAY_STATUS.DONE,
  }
);

if (failures > 0) {
  console.log(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nall passed");
