import { RemindersService } from "./src/reminders-service.mjs";
import { parseReminderRequest } from "./src/parse.mjs";

const DEFAULT_STORE_PATH = "/home/bomoha/.openclaw/workspace/data/reminders.json";
const DEFAULT_ALLOWED_USER_ID = "7295409952";
const DEFAULT_SNOOZE_MINUTES = 5;

function resolveConfig(raw) {
  const cfg = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const storePath = typeof cfg.storePath === "string" ? cfg.storePath : DEFAULT_STORE_PATH;

  let allowedUserId = DEFAULT_ALLOWED_USER_ID;
  if (typeof cfg.allowedUserId === "string") {
    allowedUserId = cfg.allowedUserId.trim() || DEFAULT_ALLOWED_USER_ID;
  } else if (typeof cfg.allowedUserId === "number" && Number.isFinite(cfg.allowedUserId)) {
    allowedUserId = String(Math.trunc(cfg.allowedUserId));
  }

  const snoozeMinutes =
    typeof cfg.snoozeMinutes === "number" && Number.isFinite(cfg.snoozeMinutes)
      ? cfg.snoozeMinutes
      : DEFAULT_SNOOZE_MINUTES;

  return { storePath, allowedUserId, snoozeMinutes };
}

function formatDueAt(ms) {
  const date = new Date(ms);
  const pad = (value) => String(value).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function buildListMessage(reminders) {
  if (!reminders.length) {
    return "No upcoming reminders.";
  }
  const lines = reminders.map(
    (reminder) => `#${reminder.id} - ${formatDueAt(reminder.dueAt)} - ${reminder.text}`,
  );
  return ["Upcoming reminders:", ...lines].join("\n");
}

const plugin = {
  id: "lisa-reminders",
  name: "Lisa Reminders",
  description: "Reminders with Telegram inline actions.",
  register(api) {
    const config = resolveConfig(api.pluginConfig);
    const sendTelegram = async (to, text, opts) => {
      return api.runtime.channel.telegram.sendMessageTelegram(to, text, opts);
    };

    const service = new RemindersService({
      storePath: config.storePath,
      logger: api.logger,
      sendTelegram,
      allowedUserId: config.allowedUserId,
      snoozeMinutes: config.snoozeMinutes,
    });

    api.registerService({
      id: "lisa-reminders",
      start: async () => {
        await service.start();
      },
      stop: async () => {
        service.stop();
      },
    });

    api.on("message_received", async (event, ctx) => {
      if (!ctx || ctx.channelId !== "telegram") return;

      const content = typeof event?.content === "string" ? event.content.trim() : "";
      if (!content) return;

      const conversationId = ctx.conversationId;
      if (!conversationId) return;

      await service.ensureLoaded();

      const actionMatch = content.match(/^reminder:(snooze|done):(\d+)$/i);
      if (actionMatch) {
        const id = Number.parseInt(actionMatch[2], 10);
        if (!Number.isFinite(id)) return;
        if (actionMatch[1].toLowerCase() === "done") {
          const reminder = await service.markDone(id);
          if (reminder) {
            await sendTelegram(conversationId, `Done. (#${id})`);
          }
          return;
        }

        const reminder = await service.snooze(id);
        if (reminder) {
          await sendTelegram(
            conversationId,
            `Snoozed 5 minutes. (#${id}) New time: ${formatDueAt(reminder.dueAt)}`,
          );
        }
        return;
      }

      if (/^list\s+reminders?$/i.test(content)) {
        const upcoming = service.listUpcoming({ nowMs: Date.now() });
        await sendTelegram(conversationId, buildListMessage(upcoming));
        return;
      }

      if (/^remind\s+me\b/i.test(content)) {
        const remainder = content.replace(/^remind\s+me\s*/i, "").trim();
        const parsed = parseReminderRequest(remainder, Date.now());
        if (parsed.question) {
          await sendTelegram(conversationId, parsed.question);
          return;
        }

        const reminder = await service.createReminder({
          text: parsed.text,
          dueAt: parsed.dueAt,
          createdBy: event?.metadata?.senderId ?? null,
          createdIn: ctx.channelId,
        });

        await sendTelegram(
          conversationId,
          `Got it. I will remind you at ${formatDueAt(reminder.dueAt)}. (#${reminder.id})`,
        );
      }
    });
  },
};

export default plugin;
