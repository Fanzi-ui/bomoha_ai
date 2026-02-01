import test from "node:test";
import assert from "node:assert/strict";
import { parseReminderRequest } from "../src/parse.mjs";

const now = new Date(2026, 1, 1, 9, 0, 0, 0).getTime();

test("parse relative reminders", () => {
  const parsed = parseReminderRequest("call mom in 10m", now);
  assert.equal(parsed.question, undefined);
  assert.equal(parsed.text, "call mom");
  assert.equal(parsed.dueAt, now + 10 * 60 * 1000);
});

test("parse today time", () => {
  const parsed = parseReminderRequest("submit report today 14:30", now);
  const expected = new Date(2026, 1, 1, 14, 30, 0, 0).getTime();
  assert.equal(parsed.text, "submit report");
  assert.equal(parsed.dueAt, expected);
});

test("parse tomorrow time", () => {
  const parsed = parseReminderRequest("check flights tomorrow 7", now);
  const expected = new Date(2026, 1, 2, 7, 0, 0, 0).getTime();
  assert.equal(parsed.text, "check flights");
  assert.equal(parsed.dueAt, expected);
});

test("parse date time", () => {
  const parsed = parseReminderRequest("pay rent 5 Mar 14:00", now);
  const expected = new Date(2026, 2, 5, 14, 0, 0, 0).getTime();
  assert.equal(parsed.text, "pay rent");
  assert.equal(parsed.dueAt, expected);
});

test("asks when time missing", () => {
  const parsed = parseReminderRequest("tomorrow", now);
  assert.ok(parsed.question);
});
