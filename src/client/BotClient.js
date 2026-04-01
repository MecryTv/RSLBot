const {Client, Collection, GatewayIntentBits, REST, Routes} = require("discord.js");
const fs = require("fs");
const path = require("path");
const { BOT, DATABASE } = require("../../config.json")
const logger = require("../utils/logger");
const ConfigService = require("../services/ConfigService");
const MessageService = require("../services/MessageService");
const MediaService = require("../services/MediaService");
const EmojiService = require("../services/EmojiService");
const Guardian = require("../services/Guardian");
const ModelService = require("../services/ModelService");
const TaskService = require("../services/TaskService");
const mongoose = require("mongoose");

class BotClient extends Client {
    constructor() {
        super({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildMessageReactions,
                GatewayIntentBits.GuildPresences,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildEmojisAndStickers,
                GatewayIntentBits.GuildIntegrations,
                GatewayIntentBits.GuildScheduledEvents,
                GatewayIntentBits.GuildWebhooks,
                GatewayIntentBits.GuildInvites,
                GatewayIntentBits.GuildModeration,
                GatewayIntentBits.GuildMessageTyping,
                GatewayIntentBits.GuildScheduledEvents,
                GatewayIntentBits.DirectMessages,
            ],
        });

        this.commands = new Collection();
        this.taskService = new TaskService(this);
    }

    async loadAndRegisterCommands() {
        const commandsPath = path.join(__dirname, "../commands");
        const commandFiles = this.getAllFiles(commandsPath);
        const commandArray = [];
        let count = 0;

        for (const file of commandFiles) {
            try {
                const CommandClass = require(file);
                const command = new CommandClass();
                this.commands.set(command.name, command);
                if (command.data) {
                    commandArray.push(command.data.toJSON());
                }
                count++;
            } catch (error) {
                Guardian.handleGeneric(`Error loading the command from the file: ${path.basename(file)}`, 'Command Loading', error.stack);
            }
        }

        if (!BOT || !BOT.CLIENT_ID || !BOT.TOKEN) {
            await Guardian.handleGeneric("CLIENT_ID or TOKEN is missing from config.json. The bot cannot start", "Bot Initialization");
            process.exit(1);
        }

        const rest = new REST({version: "10"}).setToken(BOT.TOKEN);

        await rest.put(Routes.applicationCommands(BOT.CLIENT_ID), { body: commandArray })
            .then(() => logger.info(`🚀  ${count} Commands loaded`))
            .catch(err => {
                Guardian.handleGeneric(`Error registering slash commands on Discord. Reason`, "Discord API Error", err.stack);
            });
    }

    async loadEvents() {
        const eventsPath = path.join(__dirname, "../events");
        const eventFolders = fs.readdirSync(eventsPath);
        let count = 0;

        for (const folder of eventFolders) {
            const folderPath = path.join(eventsPath, folder);
            const eventFiles = this.getAllFiles(folderPath);

            for (const file of eventFiles) {
                try {
                    const EventClass = require(file);
                    const event = new EventClass(this);
                    if (event.once) {
                        this.once(event.name, (...args) => event.execute(...args));
                    } else {
                        this.on(event.name, (...args) => event.execute(...args));
                    }
                    count++;
                } catch (error) {
                    Guardian.handleGeneric(`Error loading the event from the file: ${path.basename(file)}`, 'Event Loading', error.stack);
                }
            }
        }
        logger.info(`🚀  ${count} Events loaded`);
    }

    getAllFiles(dir) {
        try {
            const files = fs.readdirSync(dir, { withFileTypes: true });
            let allFiles = [];
            for (const file of files) {
                const filePath = path.join(dir, file.name);
                if (file.isDirectory()) {
                    allFiles = [...allFiles, ...this.getAllFiles(filePath)];
                } else if (file.name.endsWith(".js")) {
                    allFiles.push(filePath);
                }
            }
            return allFiles;
        } catch (error) {
            Guardian.handleGeneric(`Error reading the directory: ${dir}`, "File System Error", error.stack);
            return [];
        }
    }

    async start(token) {
        logger.mtvBanner();
        Guardian.initialize(this);

        try {
            const baseConnection = await mongoose.createConnection(DATABASE.URI).asPromise();
            this.discordDB = baseConnection.useDb(DATABASE.DB_DISCORD);
            this.websiteDB = baseConnection.useDb(DATABASE.DB_WEBSITE);
            logger.info("✅  MongoDB connected");

            await this.loadEvents();
            await this.loadAndRegisterCommands();
            await this.taskService.init();

            logger.info(`💾  ${ModelService.getModelCount()} Models loaded`);
            logger.info(`⚙️  ${ConfigService.getConfigCount()} Configurations loaded`);
            logger.info(`💬  ${MessageService.getMessageCount()} Message files loaded`);
            logger.info(`🖼️ ${MediaService.getMediaCount()} Media files loaded`);
            logger.info(`😃  ${EmojiService.getEmojiCount()} Emojis loaded`);

            await this.login(token);

        } catch (error) {
            logger.error("Startup Failure:", error);
            if (Guardian) await Guardian.handleGeneric(error.message, "Critical Startup Error", error.stack);
            process.exit(1);
        }
    }
}

module.exports = BotClient;