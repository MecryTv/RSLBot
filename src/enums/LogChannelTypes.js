const LogChannelTypes = {
    CONNECTION: { id: "connection", label: "Connection Log", description: "Connection Log Channel (Join & Leave)" },
    MODERATION: { id: "moderation", label: "Moderation Log", description: "Moderation Log Channel (Bans, Kicks, Mutes, etc.)" },
    MESSAGE: { id: "message", label: "Message Log", description: "Message Log Channel (Deleted & Edited Messages)" },
    ROLE: { id: "role", label: "Role Log", description: "Role Log Channel (Created, Deleted & Updated Roles)" },
    CHANNEL: { id: "channel", label: "Channel Log", description: "Channel Log Channel (Created, Deleted & Updated Channels)" },
    VOICE: { id: "voice", label: "Voice Log", description: "Voice Log Channel (Joined, Left & Moved Voice Channels)" },
    PROFILE: { id: "profile", label: "Profile Log", description: "Profile Log Channel (Role, Nickname, Image & etc.)" },
    AUDIT: { id: "audit", label: "Audit Log", description: "All other System Logs" }
};

module.exports = LogChannelTypes;