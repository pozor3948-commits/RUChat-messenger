const { initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");
const { getMessaging } = require("firebase-admin/messaging");
const { onValueCreated, onValueWritten } = require("firebase-functions/v2/database");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");

initializeApp();
const db = getDatabase();

const REGION = process.env.FUNCTION_REGION || "us-central1";
const MESSAGE_RATE_LIMIT_MAX = Number.parseInt(process.env.MESSAGE_RATE_LIMIT_MAX || "12", 10);
const MESSAGE_RATE_LIMIT_WINDOW_MS = Number.parseInt(process.env.MESSAGE_RATE_LIMIT_WINDOW_MS || "5000", 10);
const FRIEND_REQUEST_RATE_LIMIT_MAX = Number.parseInt(process.env.FRIEND_REQUEST_RATE_LIMIT_MAX || "8", 10);
const FRIEND_REQUEST_RATE_LIMIT_WINDOW_MS = Number.parseInt(process.env.FRIEND_REQUEST_RATE_LIMIT_WINDOW_MS || "60000", 10);
const MEDIA_FIELD_MAX_LENGTH = Number.parseInt(process.env.MEDIA_FIELD_MAX_LENGTH || "15000000", 10);
const TEXT_MAX_LENGTH = Number.parseInt(process.env.TEXT_MAX_LENGTH || "4000", 10);
const PUSH_ENABLED = (process.env.PUSH_ENABLED || "true") !== "false";

function isString(value, maxLen) {
  return typeof value === "string" && value.length > 0 && value.length <= maxLen;
}

function sanitizeText(value, maxLen = TEXT_MAX_LENGTH) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, maxLen);
}

function sanitizeOptionalText(value, maxLen) {
  if (typeof value !== "string") return "";
  return sanitizeText(value, maxLen);
}

function isValidMediaValue(value) {
  if (typeof value !== "string") return false;
  if (!value.length || value.length > MEDIA_FIELD_MAX_LENGTH) return false;
  return value.startsWith("data:") || value.startsWith("https://") || value.startsWith("http://") || value.startsWith("blob:");
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeMessage(raw, messageId) {
  const from = sanitizeOptionalText(raw.from, 64);
  const normalized = {
    from,
    time: isFiniteNumber(raw.time) ? raw.time : Date.now(),
    clientMessageId: isString(raw.clientMessageId, 120) ? raw.clientMessageId : messageId,
    sent: true,
    delivered: false,
    read: false,
    status: "sent"
  };

  if (raw.status === "error") normalized.status = "error";

  const text = sanitizeOptionalText(raw.text, TEXT_MAX_LENGTH);
  if (text) normalized.text = text;

  if (isValidMediaValue(raw.photo)) normalized.photo = raw.photo;
  if (isValidMediaValue(raw.video)) normalized.video = raw.video;
  if (isValidMediaValue(raw.audio)) normalized.audio = raw.audio;
  if (isValidMediaValue(raw.document)) normalized.document = raw.document;
  if (isValidMediaValue(raw.sticker)) normalized.sticker = raw.sticker;

  if (typeof raw.filename === "string") normalized.filename = sanitizeOptionalText(raw.filename, 256);
  if (isFiniteNumber(raw.filesize) && raw.filesize >= 0) normalized.filesize = Math.floor(raw.filesize);
  if (typeof raw.type === "string") normalized.type = sanitizeOptionalText(raw.type, 40);
  if (isFiniteNumber(raw.duration) && raw.duration >= 0) normalized.duration = Math.floor(raw.duration);
  if (typeof raw.stickerEmoji === "string") normalized.stickerEmoji = sanitizeOptionalText(raw.stickerEmoji, 12);
  if (typeof raw.forwardedFrom === "string") normalized.forwardedFrom = sanitizeOptionalText(raw.forwardedFrom, 64);
  if (isFiniteNumber(raw.expiresAt)) normalized.expiresAt = raw.expiresAt;
  if (raw.isTest === true) normalized.isTest = true;

  if (raw.replyTo && typeof raw.replyTo === "object") {
    const replyId = sanitizeOptionalText(raw.replyTo.id, 120);
    const replyFrom = sanitizeOptionalText(raw.replyTo.from, 64);
    const replyText = sanitizeOptionalText(raw.replyTo.text, 300);
    if (replyId && replyFrom) {
      normalized.replyTo = { id: replyId, from: replyFrom, text: replyText };
    }
  }

  normalized._hasPayload = Boolean(
    normalized.text ||
    normalized.photo ||
    normalized.video ||
    normalized.audio ||
    normalized.document ||
    normalized.sticker
  );

  return normalized;
}

function messagePreview(msg) {
  const text = sanitizeOptionalText(msg.text, 160);
  if (text) return text;
  if (isValidMediaValue(msg.photo)) return "[Фото]";
  if (isValidMediaValue(msg.video)) return "[Видео]";
  if (isValidMediaValue(msg.audio)) return "[Голосовое]";
  if (isValidMediaValue(msg.document)) return "[Файл]";
  if (isValidMediaValue(msg.sticker)) return "[Стикер]";
  return "Сообщение";
}

async function sendPushToUser(toUser, notification, data) {
  if (!PUSH_ENABLED) return;
  if (!isString(toUser, 64)) return;

  // Only notify when the user is not online (prevents spam while chat is open).
  try {
    const statusSnap = await db.ref(`userStatus/${toUser}`).get();
    const status = statusSnap.exists() ? (statusSnap.val() || {}) : {};
    if (status.online === true) return;
  } catch (_) {
    // If status cannot be read, continue best-effort.
  }

  const devicesSnap = await db.ref(`accounts/${toUser}/devices`).get();
  if (!devicesSnap.exists()) return;

  const tokens = [];
  const tokenToDevice = {};
  devicesSnap.forEach((child) => {
    const v = child.val() || {};
    const t = typeof v.fcmToken === "string" ? v.fcmToken.trim() : "";
    if (!t) return;
    tokens.push(t);
    tokenToDevice[t] = child.key;
  });

  if (!tokens.length) return;

  try {
    const resp = await getMessaging().sendEachForMulticast({
      tokens,
      notification,
      data,
      android: { priority: "high" }
    });

    const cleanup = {};
    resp.responses.forEach((r, idx) => {
      if (r.success) return;
      const token = tokens[idx];
      const code = r.error && r.error.code ? String(r.error.code) : "";
      const deviceKey = tokenToDevice[token];
      if (!deviceKey) return;
      // Remove dead tokens to keep DB clean.
      if (
        code.includes("registration-token-not-registered") ||
        code.includes("invalid-argument") ||
        code.includes("invalid-registration-token")
      ) {
        cleanup[`accounts/${toUser}/devices/${deviceKey}/fcmToken`] = null;
      }
    });
    if (Object.keys(cleanup).length) {
      await db.ref().update(cleanup);
    }
  } catch (e) {
    logger.warn("Push send failed", { toUser, error: e && e.message ? e.message : String(e) });
  }
}

function isPrivateChatParticipant(chatId, username) {
  if (!isString(chatId, 200) || !isString(username, 64)) return false;
  const parts = chatId.split("_");
  return parts.includes(username);
}

async function isGroupMember(groupId, username) {
  if (!isString(groupId, 200) || !isString(username, 64)) return false;
  const snap = await db.ref(`groups/${groupId}/members/${username}`).get();
  return snap.exists() && snap.val() === true;
}

async function applyRateLimit(bucketPath, maxCount, windowMs) {
  const ref = db.ref(`rateLimits/${bucketPath}`);
  const now = Date.now();
  const tx = await ref.transaction((current) => {
    if (!current || typeof current !== "object") {
      return { windowStart: now, count: 1, updatedAt: now };
    }
    const windowStart = isFiniteNumber(current.windowStart) ? current.windowStart : now;
    const count = Number.isInteger(current.count) ? current.count : 0;
    if ((now - windowStart) > windowMs) {
      return { windowStart: now, count: 1, updatedAt: now };
    }
    return { windowStart, count: count + 1, updatedAt: now };
  });

  if (!tx.committed || !tx.snapshot.exists()) return { allowed: true, count: 1 };
  const state = tx.snapshot.val() || {};
  const count = Number.isInteger(state.count) ? state.count : 1;
  return { allowed: count <= maxCount, count };
}

async function moderateMessageCreate(event, isGroupChat) {
  if (!event.data.exists()) return;
  const raw = event.data.val() || {};
  const messageId = event.params.messageId;
  const chatId = isGroupChat ? event.params.groupId : event.params.chatId;
  const from = sanitizeOptionalText(raw.from, 64);

  if (!from) {
    await event.data.ref.remove();
    return;
  }

  if (isGroupChat) {
    const member = await isGroupMember(chatId, from);
    if (!member) {
      await event.data.ref.remove();
      logger.warn("Removed non-member group message", { groupId: chatId, from, messageId });
      return;
    }
  } else if (!isPrivateChatParticipant(chatId, from)) {
    await event.data.ref.remove();
    logger.warn("Removed forged private message", { chatId, from, messageId });
    return;
  }

  const limit = await applyRateLimit(`messages/${from}`, MESSAGE_RATE_LIMIT_MAX, MESSAGE_RATE_LIMIT_WINDOW_MS);
  if (!limit.allowed) {
    await event.data.ref.remove();
    await db.ref(`accounts/${from}/system/lastRateLimitedAt`).set(Date.now());
    logger.warn("Rate limit exceeded, message dropped", { from, count: limit.count });
    return;
  }

  const normalized = normalizeMessage(raw, messageId);
  const hasPayload = normalized._hasPayload;
  delete normalized._hasPayload;

  if (!hasPayload) {
    await event.data.ref.remove();
    logger.warn("Removed empty message", { from, messageId });
    return;
  }

  const same = JSON.stringify(raw) === JSON.stringify(normalized);
  if (!same) {
    await event.data.ref.set(normalized);
  }
}

exports.onPrivateMessageCreated = onValueCreated(
  {
    ref: "/privateChats/{chatId}/{messageId}",
    region: REGION
  },
  async (event) => {
    await moderateMessageCreate(event, false);

    const snap = await event.data.ref.get();
    if (!snap.exists()) return;
    const msg = snap.val() || {};
    if (msg.isTest === true) return;
    const type = typeof msg.type === "string" ? msg.type : "";
    if (type.startsWith("meta_")) return;

    const from = sanitizeOptionalText(msg.from, 64);
    if (!from) return;

    const chatId = event.params.chatId;
    const parts = isString(chatId, 200) ? chatId.split("_") : [];
    const toUser = parts.find((p) => p && p !== from);
    if (!toUser) return;

    const notification = {
      title: `RuChat • ${from}`,
      body: messagePreview(msg)
    };
    const data = {
      kind: "private_message",
      chatId: String(chatId),
      from,
      messageId: String(event.params.messageId || "")
    };

    await sendPushToUser(toUser, notification, data);
  }
);

exports.onGroupMessageCreated = onValueCreated(
  {
    ref: "/groupChats/{groupId}/{messageId}",
    region: REGION
  },
  async (event) => {
    await moderateMessageCreate(event, true);

    const snap = await event.data.ref.get();
    if (!snap.exists()) return;
    const msg = snap.val() || {};
    if (msg.isTest === true) return;
    const type = typeof msg.type === "string" ? msg.type : "";
    if (type.startsWith("meta_")) return;

    const from = sanitizeOptionalText(msg.from, 64);
    if (!from) return;

    const groupId = event.params.groupId;
    if (!isString(groupId, 200)) return;
    const membersSnap = await db.ref(`groups/${groupId}/members`).get();
    if (!membersSnap.exists()) return;

    const notification = {
      title: `RuChat • ${from}`,
      body: messagePreview(msg)
    };
    const data = {
      kind: "group_message",
      groupId: String(groupId),
      from,
      messageId: String(event.params.messageId || "")
    };

    const promises = [];
    membersSnap.forEach((child) => {
      const member = child.key;
      if (!member || member === from) return;
      if (child.val() !== true) return;
      promises.push(sendPushToUser(member, notification, data));
    });
    await Promise.all(promises);
  }
);

exports.onFriendRequestCreated = onValueCreated(
  {
    ref: "/accounts/{toUser}/friendRequests/incoming/{fromUser}",
    region: REGION
  },
  async (event) => {
    const toUser = event.params.toUser;
    const fromUser = event.params.fromUser;
    if (!isString(toUser, 64) || !isString(fromUser, 64)) {
      await event.data.ref.remove();
      return;
    }
    if (toUser === fromUser) {
      await event.data.ref.remove();
      await db.ref(`accounts/${fromUser}/friendRequests/outgoing/${toUser}`).remove();
      return;
    }

    const [blockedByFrom, blockedByTo] = await Promise.all([
      db.ref(`accounts/${fromUser}/blocked/${toUser}`).get(),
      db.ref(`accounts/${toUser}/blocked/${fromUser}`).get()
    ]);

    if (blockedByFrom.exists() || blockedByTo.exists()) {
      await event.data.ref.remove();
      await db.ref(`accounts/${fromUser}/friendRequests/outgoing/${toUser}`).remove();
      return;
    }

    const limit = await applyRateLimit(
      `friendRequests/${fromUser}`,
      FRIEND_REQUEST_RATE_LIMIT_MAX,
      FRIEND_REQUEST_RATE_LIMIT_WINDOW_MS
    );
    if (!limit.allowed) {
      await event.data.ref.remove();
      await db.ref(`accounts/${fromUser}/friendRequests/outgoing/${toUser}`).remove();
      await db.ref(`accounts/${fromUser}/system/lastFriendRequestRateLimitedAt`).set(Date.now());
      logger.warn("Friend request rate limit exceeded", { fromUser, count: limit.count });
      return;
    }

    await sendPushToUser(
      toUser,
      {
        title: "RuChat • Заявка в друзья",
        body: `${fromUser} хочет добавить вас в друзья`
      },
      { kind: "friend_request", from: fromUser }
    );
  }
);

exports.syncUsersGroupsIndex = onValueWritten(
  {
    ref: "/groups/{groupId}",
    region: REGION
  },
  async (event) => {
    const groupId = event.params.groupId;
    const before = event.data.before.exists() ? (event.data.before.val() || {}) : {};
    const after = event.data.after.exists() ? (event.data.after.val() || {}) : null;
    const beforeMembers = before.members || {};
    const afterMembers = after ? (after.members || {}) : {};
    const updates = {};

    Object.keys(beforeMembers).forEach((member) => {
      if (!afterMembers[member]) {
        updates[`usersGroups/${member}/${groupId}`] = null;
      }
    });
    Object.keys(afterMembers).forEach((member) => {
      if (afterMembers[member] === true) {
        updates[`usersGroups/${member}/${groupId}`] = true;
      }
    });

    if (Object.keys(updates).length) {
      await db.ref().update(updates);
    }

    if (!after) return;

    const rolePatch = {};
    const roles = after.roles || {};
    const createdBy = sanitizeOptionalText(after.createdBy, 64);
    if (createdBy && !roles[createdBy]) {
      rolePatch[createdBy] = "owner";
    }
    Object.keys(afterMembers).forEach((member) => {
      if (afterMembers[member] === true && !roles[member]) {
        rolePatch[member] = member === createdBy ? "owner" : "member";
      }
    });
    if (Object.keys(rolePatch).length) {
      await db.ref(`groups/${groupId}/roles`).update(rolePatch);
    }

    const permissions = after.permissions || {};
    if (!permissions.canInvite || !permissions.canPin || !permissions.canChangeInfo) {
      await db.ref(`groups/${groupId}/permissions`).update({
        canInvite: permissions.canInvite || "owner_admin",
        canPin: permissions.canPin || "owner_admin",
        canChangeInfo: permissions.canChangeInfo || "owner_admin"
      });
    }
  }
);

async function cleanupRateLimitBucket(bucketName, maxAgeMs) {
  const ref = db.ref(`rateLimits/${bucketName}`);
  const snap = await ref.get();
  if (!snap.exists()) return 0;
  const now = Date.now();
  const updates = {};
  let removed = 0;
  snap.forEach((child) => {
    const val = child.val() || {};
    const updatedAt = isFiniteNumber(val.updatedAt) ? val.updatedAt : 0;
    if ((now - updatedAt) > maxAgeMs) {
      updates[child.key] = null;
      removed++;
    }
  });
  if (removed) await ref.update(updates);
  return removed;
}

async function rebuildUsersGroupsIndex() {
  const groupsSnap = await db.ref("groups").get();
  const index = {};
  if (groupsSnap.exists()) {
    groupsSnap.forEach((groupNode) => {
      const groupId = groupNode.key;
      const groupData = groupNode.val() || {};
      const members = groupData.members || {};
      Object.keys(members).forEach((member) => {
        if (members[member] !== true) return;
        if (!index[member]) index[member] = {};
        index[member][groupId] = true;
      });
    });
  }
  await db.ref("usersGroups").set(index);
}

exports.dailyMaintenance = onSchedule(
  {
    schedule: "every 24 hours",
    region: REGION
  },
  async () => {
    const removedMessages = await cleanupRateLimitBucket("messages", MESSAGE_RATE_LIMIT_WINDOW_MS * 6);
    const removedFriends = await cleanupRateLimitBucket("friendRequests", FRIEND_REQUEST_RATE_LIMIT_WINDOW_MS * 6);
    await rebuildUsersGroupsIndex();
    logger.info("Daily maintenance complete", {
      removedMessageRateLimits: removedMessages,
      removedFriendRequestRateLimits: removedFriends
    });
  }
);
