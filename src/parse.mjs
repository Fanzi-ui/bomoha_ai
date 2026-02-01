const MONTHS = new Map([
  ["jan", 0],
  ["january", 0],
  ["feb", 1],
  ["february", 1],
  ["mar", 2],
  ["march", 2],
  ["apr", 3],
  ["april", 3],
  ["may", 4],
  ["jun", 5],
  ["june", 5],
  ["jul", 6],
  ["july", 6],
  ["aug", 7],
  ["august", 7],
  ["sep", 8],
  ["sept", 8],
  ["september", 8],
  ["oct", 9],
  ["october", 9],
  ["nov", 10],
  ["november", 10],
  ["dec", 11],
  ["december", 11],
]);

const WEEKDAYS = new Map([
  ["sun", 0],
  ["sunday", 0],
  ["mon", 1],
  ["monday", 1],
  ["tue", 2],
  ["tues", 2],
  ["tuesday", 2],
  ["wed", 3],
  ["wednesday", 3],
  ["thu", 4],
  ["thur", 4],
  ["thurs", 4],
  ["thursday", 4],
  ["fri", 5],
  ["friday", 5],
  ["sat", 6],
  ["saturday", 6],
]);

function parseClock(hourRaw, minuteRaw, ampmRaw) {
  const hourNum = Number.parseInt(hourRaw, 10);
  if (!Number.isFinite(hourNum) || hourNum < 0 || hourNum > 23) return null;
  const minuteNum = minuteRaw ? Number.parseInt(minuteRaw, 10) : 0;
  if (!Number.isFinite(minuteNum) || minuteNum < 0 || minuteNum > 59) return null;

  let hour = hourNum;
  const ampm = ampmRaw ? ampmRaw.toLowerCase() : "";
  if (ampm === "am" || ampm === "pm") {
    if (hourNum < 1 || hourNum > 12) return null;
    hour = hourNum % 12;
    if (ampm === "pm") hour += 12;
  }

  return { hour, minute: minuteNum };
}

function parseRelative(remainder, nowMs) {
  const match = remainder.match(/\b(in)\s+((?:\d+\s*(?:weeks?|w|days?|d|hours?|hrs?|h|minutes?|mins?|m)\s*)+)/i);
  if (!match) return null;
  const parts = match[2].matchAll(/(\d+)\s*(weeks?|w|days?|d|hours?|hrs?|h|minutes?|mins?|m)/gi);
  let totalMs = 0;
  for (const part of parts) {
    const value = Number.parseInt(part[1], 10);
    if (!Number.isFinite(value)) continue;
    const unit = part[2].toLowerCase();
    if (unit.startsWith("w")) totalMs += value * 7 * 24 * 60 * 60 * 1000;
    else if (unit.startsWith("d")) totalMs += value * 24 * 60 * 60 * 1000;
    else if (unit.startsWith("h")) totalMs += value * 60 * 60 * 1000;
    else if (unit.startsWith("m")) totalMs += value * 60 * 1000;
  }
  if (totalMs <= 0) return null;

  return {
    dueAt: nowMs + totalMs,
    matchStart: match.index ?? 0,
    matchEnd: (match.index ?? 0) + match[0].length,
  };
}

function parseTodayTomorrow(remainder, nowMs) {
  const match = remainder.match(/\b(today|tomorrow)\b(?:\s+at)?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!match) {
    if (/\b(today|tomorrow)\b/i.test(remainder)) {
      return { question: "What time should I set that for?" };
    }
    return null;
  }
  const clock = parseClock(match[2], match[3], match[4]);
  if (!clock) return { question: "What time should I set that for?" };

  const now = new Date(nowMs);
  const target = new Date(now);
  if (match[1].toLowerCase() === "tomorrow") {
    target.setDate(target.getDate() + 1);
  }
  target.setHours(clock.hour, clock.minute, 0, 0);

  if (match[1].toLowerCase() === "today" && target.getTime() <= nowMs) {
    return { question: "That time has already passed today. Should I set it for tomorrow?" };
  }

  return {
    dueAt: target.getTime(),
    matchStart: match.index ?? 0,
    matchEnd: (match.index ?? 0) + match[0].length,
  };
}

function parseWeekday(remainder, nowMs) {
  const match = remainder.match(/\b(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)\b(?:\s+at)?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!match) {
    if (/\b(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)\b/i.test(remainder)) {
      return { question: "What time should I set that for?" };
    }
    return null;
  }

  const weekday = WEEKDAYS.get(match[1].toLowerCase());
  const clock = parseClock(match[2], match[3], match[4]);
  if (weekday == null || !clock) return { question: "What time should I set that for?" };

  const now = new Date(nowMs);
  const target = new Date(now);
  const currentDay = target.getDay();
  let daysAhead = (weekday - currentDay + 7) % 7;
  if (daysAhead === 0) {
    const candidate = new Date(now);
    candidate.setHours(clock.hour, clock.minute, 0, 0);
    if (candidate.getTime() <= nowMs) {
      daysAhead = 7;
    }
  }

  target.setDate(target.getDate() + daysAhead);
  target.setHours(clock.hour, clock.minute, 0, 0);

  return {
    dueAt: target.getTime(),
    matchStart: match.index ?? 0,
    matchEnd: (match.index ?? 0) + match[0].length,
  };
}

function parseDate(remainder, nowMs) {
  const match = remainder.match(/\b(\d{1,2})\s*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b(?:\s*(\d{2,4}))?(?:\s+at)?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!match) {
    if (/\b(\d{1,2})\s*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i.test(remainder)) {
      return { question: "What time should I set that for?" };
    }
    return null;
  }

  const day = Number.parseInt(match[1], 10);
  const month = MONTHS.get(match[2].toLowerCase());
  const clock = parseClock(match[4], match[5], match[6]);
  if (!Number.isFinite(day) || month == null || !clock) {
    return { question: "What time should I set that for?" };
  }

  const now = new Date(nowMs);
  let year = now.getFullYear();
  if (match[3]) {
    const rawYear = Number.parseInt(match[3], 10);
    year = rawYear < 100 ? 2000 + rawYear : rawYear;
  }

  const target = new Date(now);
  target.setFullYear(year, month, day);
  target.setHours(clock.hour, clock.minute, 0, 0);

  if (!match[3] && target.getTime() <= nowMs) {
    target.setFullYear(year + 1);
  } else if (match[3] && target.getTime() <= nowMs) {
    return { question: "That date is in the past. What time should I use instead?" };
  }

  return {
    dueAt: target.getTime(),
    matchStart: match.index ?? 0,
    matchEnd: (match.index ?? 0) + match[0].length,
  };
}

function stripTimeExpression(text, matchStart, matchEnd) {
  const without = `${text.slice(0, matchStart)}${text.slice(matchEnd)}`;
  return without.replace(/\s+/g, " ").trim();
}

function cleanupReminderText(text) {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^to\s+/i, "");
  cleaned = cleaned.replace(/^that\s+/i, "");
  cleaned = cleaned.replace(/^please\s+/i, "");
  return cleaned.trim();
}

export function parseReminderRequest(input, nowMs = Date.now()) {
  const remainder = input.trim();
  if (!remainder) {
    return { question: "What should I remind you about?" };
  }

  const strategies = [parseRelative, parseTodayTomorrow, parseWeekday, parseDate];
  for (const strategy of strategies) {
    const result = strategy(remainder, nowMs);
    if (!result) continue;
    if (result.question) return { question: result.question };
    const text = cleanupReminderText(stripTimeExpression(remainder, result.matchStart, result.matchEnd));
    if (!text) {
      return { question: "What should I remind you about?" };
    }
    return { dueAt: result.dueAt, text };
  }

  return { question: "When should I remind you?" };
}
