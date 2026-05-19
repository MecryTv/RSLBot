const fs = require('fs');
const path = require('path');
const Guardian = require('./Guardian');

class EmojiService {
    constructor() {
        this.emojis = new Map();
        this._loadEmojis();
    }

    _loadEmojis() {
        const emojisPath = path.join(__dirname, '..', 'config', 'emojis.json');
        if (!fs.existsSync(emojisPath)) {
            return Guardian.handleGeneric(`The emoji configuration file (${emojisPath}) does not exist`, 'EmojiService Init');
        }

        try {
            const fileContent = fs.readFileSync(emojisPath, 'utf-8');
            let emojiData = JSON.parse(fileContent);

            if (Array.isArray(emojiData) && emojiData.length > 0) {
                emojiData = emojiData[0];
            }

            this._flattenEmojis(emojiData);
        } catch (error) {
            Guardian.handleGeneric('Error loading or parsing the emoji file', 'EmojiService Load', error.stack);
        }
    }

    _flattenEmojis(obj, prefix = '') {
        for (const key in obj) {
            if (obj.hasOwnProperty(key) && key !== 'panigation') {
                const newPrefix = prefix ? `${prefix}.${key}` : key;
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    this._flattenEmojis(obj[key], newPrefix);
                } else {
                    this.emojis.set(newPrefix, obj[key]);
                }
            }
        }
    }

    getLocal(key) {
        const id = this.emojis.get(key);
        if (!id) {
            Guardian.handleGeneric(`The emoji with the key ‘${key}’ was not found`, 'EmojiService Get');
            return null;
        }

        const name = key.split('.').pop();
        const isAnimated = name.startsWith('a_');

        return {
            name,
            id,
            animated: isAnimated,
            toString: () => (isAnimated ? `<a:${name}:${id}>` : `<:${name}:${id}>`),
        };
    }

    getServer(interaction, key) {
        if (!interaction || !interaction.guild) {
            Guardian.handleGeneric('Interaction or Guild was not available to search for server emojis', 'EmojiService GetServer');
            return null;
        }

        const emoji = interaction.guild.emojis.cache.find(e => e.name === key);

        if (!emoji) {
            Guardian.handleGeneric(`The server emoji named ‘${key}’ was not found`, 'EmojiService GetServer');
            return null;
        }

        return {
            name: emoji.name,
            id: emoji.id,
            animated: emoji.animated,
            toString: () => emoji.toString(),
        };
    }

    saveServerEmoji(name, id) {
        const emojisPath = path.join(__dirname, '..', 'config', 'emojis.json');
        try {
            let emojiData = {};
            if (fs.existsSync(emojisPath)) {
                const fileContent = fs.readFileSync(emojisPath, 'utf-8');
                let parsed = JSON.parse(fileContent);
                emojiData = Array.isArray(parsed) ? (parsed[0] || {}) : parsed;
            }

            if (!emojiData.server_custom) {
                emojiData.server_custom = {};
            }

            emojiData.server_custom[name] = id;

            fs.writeFileSync(emojisPath, JSON.stringify([emojiData], null, 4), 'utf-8');

            this.emojis.set(`server_custom.${name}`, id);
            return `server_custom.${name}`;
        } catch (error) {
            Guardian.handleGeneric('Error saving custom server emoji to file', 'EmojiService SaveServerEmoji', error.stack);
            return null;
        }
    }

    getEmojiCount() {
        return this.emojis.size;
    }
}

module.exports = new EmojiService();