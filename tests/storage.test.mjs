import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadStore, saveStore } from "../src/storage.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("save and load reminders store", async () => {
  const tmpDir = path.join(__dirname, "tmp");
  const storePath = path.join(tmpDir, "reminders.json");
  await fs.rm(tmpDir, { recursive: true, force: true });

  const store = {
    nextId: 2,
    reminders: [
      {
        id: 1,
        text: "test reminder",
        dueAt: Date.now() + 60_000,
        createdAt: Date.now(),
        createdBy: 123,
        createdIn: "telegram",
        status: "scheduled",
        lastFiredAt: null,
      },
    ],
  };

  await saveStore(storePath, store);
  const loaded = await loadStore(storePath);

  assert.equal(loaded.nextId, 2);
  assert.equal(loaded.reminders.length, 1);
  assert.equal(loaded.reminders[0].text, "test reminder");
});
