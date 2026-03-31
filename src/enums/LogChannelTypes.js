const LogChannelTypes = {
    CONNECTION: { id: "connection", label: "Connection Log", description: "Connection Log Channel (Join & Leave)" },
    MODERATION: { id: "moderation", label: "Moderation Log", description: "Moderation Log Channel (Bans, Kicks, Mutes, etc.)" },
    MESSAGE: { id: "message", label: "Message Log", description: "Message Log Channel (Deleted & Edited Messages)" },
    ROLE: { id: "role", label: "Role Log", description: "Role Log Channel (Created, Deleted & Updated Roles)" },
    CHANNEL: { id: "channel", label: "Channel Log", description: "Channel Log Channel (Created, Deleted & Updated Channels)" },
    VOICE: { id: "voice", label: "Voice Log", description: "Voice Log Channel (Joined, Left & Moved Voice Channels)" },
    EMOJI: { id: "emoji", label: "Emoji Log", description: "Emoji Log Channel (Created, Deleted & Updated Emojis)" },
    PROFILE: { id: "profile", label: "Profile Log", description: "Profile Log Channel (Role, Nickname, Image & etc.)" },
    THREAD: { id: "thread", label: "Thread Log", description: "Thread Log Channel (Created, Deleted & Updated Threads)" },
    INVITE: { id: "invite", label: "Invite Log", description: "Tracks creation and deletion of invite links." },
    GUILD: { id: "guild", label: "Server Settings Log", description: "Tracks changes to server name, icon, and security levels." },
    AUTOMOD: { id: "automod", label: "AutoMod Log", description: "Logs actions taken by Discord's built-in AutoMod." },
    STICKER: { id: "sticker", label: "Sticker Log", description: "Created, Deleted & Updated Stickers" },
    INTEGRATION: { id: "integration", label: "Integration Log", description: "Webhooks, Bots & App-Command updates" },
    SCHEDULED_EVENT: { id: "scheduled_event", label: "Event Log", description: "Scheduled Server Events (Start, Edit, End)" },
    POLL: { id: "poll", label: "Poll Log", description: "New polls and poll results" },
    SYSTEM: { id: "system", label: "System Log", description: "Bot-internal errors and status updates" }
};

module.exports = LogChannelTypes;