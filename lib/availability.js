import { APPOINTMENT_LEAD_STATUSES, toDate } from "@/lib/whatsappAutomation";

export const WEEK_DAYS = [
  { key: 0, label: "ראשון" },
  { key: 1, label: "שני" },
  { key: 2, label: "שלישי" },
  { key: 3, label: "רביעי" },
  { key: 4, label: "חמישי" },
  { key: 5, label: "שישי" },
  { key: 6, label: "שבת" },
];

export function getDefaultAvailability() {
  return {
    timezone: "Asia/Jerusalem",
    slotDurationMinutes: 20,
    bufferMinutes: 5,
    days: {
      0: { enabled: true, windows: [{ start: "09:00", end: "16:00" }] },
      1: { enabled: true, windows: [{ start: "09:00", end: "20:00" }] },
      2: { enabled: true, windows: [{ start: "09:00", end: "20:00" }] },
      3: { enabled: true, windows: [{ start: "09:00", end: "20:00" }] },
      4: { enabled: true, windows: [{ start: "09:00", end: "20:00" }] },
      5: { enabled: true, windows: [{ start: "09:00", end: "14:00" }] },
      6: { enabled: false, windows: [{ start: "09:00", end: "20:00" }] },
    },
  };
}

function normalizeDayConfig(dayInput, fallbackDayConfig) {
  const enabled = Boolean(dayInput?.enabled);
  const inputWindows = Array.isArray(dayInput?.windows)
    ? dayInput.windows
    : dayInput?.start && dayInput?.end
      ? [{ start: dayInput.start, end: dayInput.end }]
      : fallbackDayConfig.windows;
  const windows = inputWindows
    .map((window) => ({
      start: String(window?.start || "09:00"),
      end: String(window?.end || "18:00"),
    }))
    .filter((window) => window.start < window.end);
  return {
    enabled,
    windows: windows.length > 0 ? windows : fallbackDayConfig.windows,
  };
}

export function normalizeAvailability(input) {
  const base = getDefaultAvailability();
  const normalizedDays = {};
  Object.keys(base.days).forEach((dayKey) => {
    normalizedDays[dayKey] = normalizeDayConfig(input?.days?.[dayKey], base.days[dayKey]);
  });

  return {
    timezone: input?.timezone || base.timezone,
    slotDurationMinutes: Math.max(10, Number(input?.slotDurationMinutes) || base.slotDurationMinutes),
    bufferMinutes: Math.max(0, Number(input?.bufferMinutes) || base.bufferMinutes),
    days: normalizedDays,
  };
}

export function parseDayTime(date, hhmm) {
  const [hours, minutes] = String(hhmm || "00:00")
    .split(":")
    .map((value) => Number(value) || 0);
  const copy = new Date(date);
  copy.setHours(hours, minutes, 0, 0);
  return copy;
}

export function overlaps(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

export function collectConflicts(tasks = [], leads = [], staffId = null) {
  const conflicts = [];
  tasks.forEach((task) => {
    if (staffId && task.assignedStaffId && task.assignedStaffId !== staffId) return;
    const start = toDate(task.dueDate);
    if (!start) return;
    const durationMinutes = Number(task.durationMinutes) || 20;
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    conflicts.push({ start, end });
  });

  leads.forEach((lead) => {
    if (!APPOINTMENT_LEAD_STATUSES.includes(lead.status)) return;
    if (staffId && lead.assignedStaffId && lead.assignedStaffId !== staffId) return;
    const start = toDate(lead.appointmentDateTime);
    if (!start) return;
    const durationMinutes = Number(lead.meetingDurationMinutes) || 20;
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    conflicts.push({ start, end });
  });
  return conflicts;
}

export function generateSlotsForDate({
  date,
  availability,
  durationMinutes,
  conflicts,
}) {
  const normalized = normalizeAvailability(availability);
  const selectedDate = new Date(date);
  if (Number.isNaN(selectedDate.getTime())) return [];

  const dayConfig = normalized.days[selectedDate.getDay()];
  if (!dayConfig?.enabled) return [];

  const meetingMinutes =
    Math.max(10, Number(durationMinutes) || 0) || normalized.slotDurationMinutes;
  const bufferMinutes = Math.max(0, Number(normalized.bufferMinutes) || 0);
  const windows = Array.isArray(dayConfig.windows) ? dayConfig.windows : [];
  const slots = [];

  windows.forEach((window) => {
    const openTime = parseDayTime(selectedDate, window.start);
    const closeTime = parseDayTime(selectedDate, window.end);
    for (
      let cursor = new Date(openTime);
      cursor.getTime() + meetingMinutes * 60 * 1000 <= closeTime.getTime();
      cursor = new Date(cursor.getTime() + (meetingMinutes + bufferMinutes) * 60 * 1000)
    ) {
      const slotStart = new Date(cursor);
      const slotEnd = new Date(slotStart.getTime() + meetingMinutes * 60 * 1000);
      const blocked = conflicts.some((conflict) =>
        overlaps(slotStart, slotEnd, conflict.start, conflict.end)
      );
      if (!blocked) {
        slots.push({
          startAt: slotStart.toISOString(),
          endAt: slotEnd.toISOString(),
        });
      }
    }
  });

  slots.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  return slots;
}

