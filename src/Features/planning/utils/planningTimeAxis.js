import getLocalDateString from "Features/dailyScopes/utils/getLocalDateString";

import {
  DAY_START_HOUR,
  DEFAULT_HOURS_PER_DAY,
  DEFAULT_STEP_HOURS,
  MIN_COLUMNS,
  TRAILING_COLUMNS,
} from "../constants/planningDefaults";

// Pure time-axis helpers of a planning (node-testable, no date library).
//
// Storage is unified: a block is {startStep, steps} whatever the mode.
// - STEPS: abstract columns 0..n, grouped by "days" of stepsPerDay steps.
// - CALENDAR: step ↔ (working day index from startDate, slot in the day).
//   Dates are LOCAL CIVIL dates "YYYY-MM-DD"; day arithmetic goes through
//   noon-anchored Date objects + setDate (DST-proof), differences through
//   Date.UTC. Working week Monday → Friday; weekends are skipped.

const DAY_MS = 86400000;
const DOW_LABELS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

export function getStepHours(planning) {
  const v = planning?.stepHours;
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_STEP_HOURS;
}

export function getHoursPerDay(planning) {
  const v = planning?.hoursPerDay;
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_HOURS_PER_DAY;
}

// Steps in a working day (a step not dividing the day leaves the remainder
// unplanned — the UI restricts stepHours to integers 4..8).
export function getStepsPerDay(planning) {
  return Math.max(
    1,
    Math.floor(getHoursPerDay(planning) / getStepHours(planning))
  );
}

export function parseCivilDate(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str ?? ""));
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

// Noon-anchored local Date: adding days with setDate never crosses a DST
// change at midnight.
export function toLocalDate({ y, m, d }) {
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function addCalendarDays(dateStr, days) {
  const parsed = parseCivilDate(dateStr);
  if (!parsed) return null;
  const date = toLocalDate(parsed);
  date.setDate(date.getDate() + days);
  return getLocalDateString(date);
}

// 0 = Monday … 6 = Sunday
function getWeekdayIndex(dateStr) {
  const parsed = parseCivilDate(dateStr);
  if (!parsed) return null;
  return (toLocalDate(parsed).getDay() + 6) % 7;
}

// Saturday → next Monday, Sunday → next Monday; invalid → today (normalized).
export function normalizeStartDate(startDate) {
  const str = parseCivilDate(startDate) ? startDate : getLocalDateString();
  const w = getWeekdayIndex(str);
  if (w === 5) return addCalendarDays(str, 2);
  if (w === 6) return addCalendarDays(str, 1);
  return str;
}

// Civil date of the working day `dayIndex` (0 = start day). O(1).
export function workingDayIndexToDate(startDate, dayIndex) {
  const start = normalizeStartDate(startDate);
  const idx = Math.max(0, Math.floor(dayIndex ?? 0));
  const w = getWeekdayIndex(start); // 0..4
  const weeks = Math.floor((w + idx) / 5);
  const dowIdx = (w + idx) % 5;
  const calendarDays = weeks * 7 + dowIdx - w;
  return addCalendarDays(start, calendarDays);
}

// Working day index of a civil date, null before the start. A weekend date
// maps to the previous Friday with isWeekend: true.
export function dateToWorkingDayIndex(startDate, dateStr) {
  const start = normalizeStartDate(startDate);
  const s = parseCivilDate(start);
  const t = parseCivilDate(dateStr);
  if (!s || !t) return null;
  const calendarDays = Math.round(
    (Date.UTC(t.y, t.m - 1, t.d) - Date.UTC(s.y, s.m - 1, s.d)) / DAY_MS
  );
  if (calendarDays < 0) return null;
  const w = getWeekdayIndex(start); // 0..4
  const weeks = Math.floor(calendarDays / 7);
  const rem = calendarDays % 7;
  let count = 0;
  for (let i = 1; i <= rem; i++) {
    if ((w + i) % 7 < 5) count += 1;
  }
  const isWeekend = (w + rem) % 7 >= 5;
  return { dayIndex: weeks * 5 + count, isWeekend };
}

export function stepToDate(planning, step) {
  const spd = getStepsPerDay(planning);
  const s = Math.max(0, Math.floor(step ?? 0));
  const dayIndex = Math.floor(s / spd);
  const slotIndex = s - dayIndex * spd;
  const startHour = DAY_START_HOUR + slotIndex * getStepHours(planning);
  const dateStr =
    planning?.timeAxisMode === "CALENDAR"
      ? workingDayIndexToDate(planning.startDate, dayIndex)
      : null;
  return { dayIndex, slotIndex, dateStr, startHour };
}

export function dateToStep(planning, dateStr, slotIndex = 0) {
  const r = dateToWorkingDayIndex(planning?.startDate, dateStr);
  if (!r) return null;
  return r.dayIndex * getStepsPerDay(planning) + slotIndex;
}

// Position (float, in steps) of "now" on the axis: CALENDAR from the clock
// (null before the start; weekends = end of Friday), STEPS from the stored
// cursor.
export function getNowStep(planning, now = new Date()) {
  if (!planning) return null;
  if (planning.timeAxisMode !== "CALENDAR") {
    const c = planning.currentStep;
    return Number.isFinite(c) ? Math.max(0, c) : 0;
  }
  const spd = getStepsPerDay(planning);
  const r = dateToWorkingDayIndex(planning.startDate, getLocalDateString(now));
  if (!r) return null;
  if (r.isWeekend) return (r.dayIndex + 1) * spd;
  const hours = now.getHours() + now.getMinutes() / 60;
  const frac = Math.min(
    Math.max((hours - DAY_START_HOUR) / getStepHours(planning), 0),
    spd
  );
  return r.dayIndex * spd + frac;
}

// "lun. 09/09"
export function formatDayLabel(dateStr) {
  const parsed = parseCivilDate(dateStr);
  if (!parsed) return "";
  const date = toLocalDate(parsed);
  const dd = String(parsed.d).padStart(2, "0");
  const mm = String(parsed.m).padStart(2, "0");
  return `${DOW_LABELS[date.getDay()]} ${dd}/${mm}`;
}

// Columns of the grid: one per step.
export function getTimeAxisColumns(planning, columnCount) {
  const spd = getStepsPerDay(planning);
  const stepHours = getStepHours(planning);
  const isCalendar = planning?.timeAxisMode === "CALENDAR";
  const columns = [];
  for (let step = 0; step < columnCount; step++) {
    const dayIndex = Math.floor(step / spd);
    const slotIndex = step - dayIndex * spd;
    const dateStr = isCalendar
      ? workingDayIndexToDate(planning.startDate, dayIndex)
      : null;
    const isWeekStart =
      slotIndex === 0 &&
      (isCalendar ? getWeekdayIndex(dateStr) === 0 : dayIndex % 5 === 0);
    columns.push({
      step,
      dayIndex,
      slotIndex,
      isDayStart: slotIndex === 0,
      isWeekStart,
      dateStr,
      dayLabel: isCalendar ? formatDayLabel(dateStr) : `J${dayIndex + 1}`,
      subLabel: isCalendar
        ? `${DAY_START_HOUR + slotIndex * stepHours}h`
        : String(step + 1),
    });
  }
  return columns;
}

// Enough columns for the blocks and the now line, whole days.
export function getPlanningColumnCount(planning, slots, nowStep) {
  const spd = getStepsPerDay(planning);
  const maxEnd = (slots ?? []).reduce(
    (m, s) => Math.max(m, (s.startStep ?? 0) + (s.steps ?? 1)),
    0
  );
  const raw = Math.max(
    MIN_COLUMNS,
    maxEnd + TRAILING_COLUMNS,
    (Number.isFinite(nowStep) ? Math.ceil(nowStep) : 0) + TRAILING_COLUMNS
  );
  return Math.ceil(raw / spd) * spd;
}
