import fs from "node:fs/promises";
import path from "node:path";

const STATUS_VALUES = new Set(["scheduled", "done", "cancelled"]);

export function createEmptyStore() {
  return { nextId: 1, reminders: [] };
}

function normalizeReminder(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const id = Number.parseInt(raw.id, 10);
  if (!Number.isFinite(id) || id < 1) return null;
  const text = typeof raw.text === "string" ? raw.text : "";
  if (!text.trim()) return null;
  const dueAt = Number.isFinite(raw.dueAt) ? Number(raw.dueAt) : NaN;
  const createdAt = Number.isFinite(raw.createdAt) ? Number(raw.createdAt) : NaN;
  if (!Number.isFinite(dueAt) || !Number.isFinite(createdAt)) return null;
  const status = STATUS_VALUES.has(raw.status) ? raw.status : "scheduled";

  let createdBy = null;
  if (Number.isFinite(raw.createdBy)) {
    createdBy = Number(raw.createdBy);
  } else if (typeof raw.createdBy === "string") {
    const parsed = Number.parseInt(raw.createdBy, 10);
    createdBy = Number.isFinite(parsed) ? parsed : null;
  }

  const createdIn = typeof raw.createdIn === "string" ? raw.createdIn : null;
  const lastFiredAt = Number.isFinite(raw.lastFiredAt) ? Number(raw.lastFiredAt) : null;

  return {
    id,
    text,
    dueAt,
    createdAt,
    createdBy,
    createdIn,
    status,
    lastFiredAt,
  };
}

function normalizeStore(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return createEmptyStore();
  const reminders = Array.isArray(raw.reminders) ? raw.reminders : [];
  const normalized = reminders.map(normalizeReminder).filter(Boolean);
  const maxId = normalized.reduce((max, item) => Math.max(max, item.id), 0);
  const nextId = Number.isFinite(raw.nextId) ? Math.max(Number(raw.nextId), maxId + 1) : maxId + 1;

  return {
    nextId,
    reminders: normalized,
  };
}

export async function loadStore(storePath, logger) {
  try {
    const data = await fs.readFile(storePath, "utf8");
    const parsed = JSON.parse(data);
    return normalizeStore(parsed);
  } catch (err) {
    if (err && err.code === "ENOENT") {
      return createEmptyStore();
    }
    if (logger) {
      logger.warn?.(`[lisa-reminders] Failed to load store, resetting: ${String(err)}`);
    }
    return createEmptyStore();
  }
}

export async function saveStore(storePath, store) {
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  const payload = JSON.stringify(store, null, 2);
  await fs.writeFile(storePath, `${payload}\n`, "utf8");
}
