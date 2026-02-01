import { loadStore, saveStore, createEmptyStore } from "./storage.mjs";

function resolveCreatedBy(raw) {
  if (!raw) return null;
  const parsed = Number.parseInt(String(raw), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export class RemindersService {
  constructor({ storePath, logger, sendTelegram, allowedUserId, snoozeMinutes }) {
    this.storePath = storePath;
    this.logger = logger;
    this.sendTelegram = sendTelegram;
    this.allowedUserId = allowedUserId;
    this.snoozeMs = Math.max(1, snoozeMinutes) * 60 * 1000;
    this.store = createEmptyStore();
    this.timers = new Map();
    this.loading = null;
    this.ready = false;
  }

  async start() {
    await this.ensureLoaded();
    this.scheduleAll();
  }

  stop() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.ready = false;
  }

  async ensureLoaded() {
    if (this.ready) return;
    if (!this.loading) {
      this.loading = loadStore(this.storePath, this.logger).then((store) => {
        this.store = store;
        this.ready = true;
      });
    }
    await this.loading;
  }

  async persist() {
    await saveStore(this.storePath, this.store);
  }

  scheduleAll() {
    for (const reminder of this.store.reminders) {
      this.scheduleReminder(reminder);
    }
  }

  scheduleReminder(reminder) {
    const existing = this.timers.get(reminder.id);
    if (existing) {
      clearTimeout(existing);
      this.timers.delete(reminder.id);
    }

    if (reminder.status !== "scheduled") return;
    if (reminder.lastFiredAt && reminder.dueAt <= reminder.lastFiredAt) return;

    const delay = Math.max(0, reminder.dueAt - Date.now());
    const timer = setTimeout(() => {
      void this.fireReminder(reminder.id);
    }, delay);
    this.timers.set(reminder.id, timer);
  }

  async fireReminder(id) {
    await this.ensureLoaded();
    const reminder = this.store.reminders.find((entry) => entry.id === id);
    if (!reminder || reminder.status !== "scheduled") return;
    if (reminder.lastFiredAt && reminder.dueAt <= reminder.lastFiredAt) return;

    reminder.lastFiredAt = Date.now();
    await this.persist();

    if (this.allowedUserId) {
      const text = `\uD83D\uDD14 Reminder: ${reminder.text}`;
      const buttons = [
        [
          { text: "Snooze 5m", callback_data: `reminder:snooze:${reminder.id}` },
          { text: "Done", callback_data: `reminder:done:${reminder.id}` },
        ],
      ];

      try {
        await this.sendTelegram(this.allowedUserId, text, { buttons });
      } catch (err) {
        this.logger.error?.(`[lisa-reminders] Failed to send reminder ${id}: ${String(err)}`);
      }
    }
  }

  async createReminder({ text, dueAt, createdBy, createdIn }) {
    await this.ensureLoaded();
    const id = this.store.nextId;
    this.store.nextId += 1;

    const reminder = {
      id,
      text,
      dueAt,
      createdAt: Date.now(),
      createdBy: resolveCreatedBy(createdBy),
      createdIn: createdIn ?? null,
      status: "scheduled",
      lastFiredAt: null,
    };

    this.store.reminders.push(reminder);
    await this.persist();
    this.scheduleReminder(reminder);
    return reminder;
  }

  listUpcoming({ nowMs, limit = 20 }) {
    return this.store.reminders
      .filter((reminder) => reminder.status === "scheduled" && reminder.dueAt > nowMs)
      .sort((a, b) => a.dueAt - b.dueAt)
      .slice(0, limit);
  }

  async markDone(id) {
    await this.ensureLoaded();
    const reminder = this.store.reminders.find((entry) => entry.id === id);
    if (!reminder) return null;
    reminder.status = "done";
    await this.persist();
    this.scheduleReminder(reminder);
    return reminder;
  }

  async snooze(id) {
    await this.ensureLoaded();
    const reminder = this.store.reminders.find((entry) => entry.id === id);
    if (!reminder) return null;
    const base = Math.max(reminder.dueAt, Date.now());
    reminder.dueAt = base + this.snoozeMs;
    reminder.status = "scheduled";
    await this.persist();
    this.scheduleReminder(reminder);
    return reminder;
  }
}
