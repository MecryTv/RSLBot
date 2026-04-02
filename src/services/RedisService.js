const { createClient } = require('redis');
const { Repository } = require('redis-om');
const { DATABASE } = require('../../config.json');
const fs = require('fs');
const path = require('path');

class RedisService {
    constructor() {
        this.client = createClient({
            url: DATABASE.REDIS_URL || 'redis://localhost:6379'
        });
        this.repositories = new Map();
        this.client.on('error', (err) => console.error('Redis Client Error', err));
    }

    async connect() {
        if (!this.client.isOpen) {
            await this.client.connect();
        }
    }

    async loadModels(folderPath) {
        const modelFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

        for (const file of modelFiles) {
            const filePath = path.join(folderPath, file);
            const schema = require(filePath);

            const modelName = path.parse(file).name;

            try {
                await this.registerModel(modelName, schema);
            } catch (error) {
                console.error(`❌ Fehler beim Registrieren von Model [${modelName}]:`, error);
            }
        }
    }

    async registerModel(name, schema) {
        const repo = new Repository(schema, this.client);
        await repo.createIndex();
        this.repositories.set(name, repo);
    }

    getModelCount() {
        return this.repositories.size;
    }

    async findOne(modelName, criteria = {}) {
        const repo = this.repositories.get(modelName);
        if (!repo) throw new Error(`Model ${modelName} nicht gefunden.`);

        let search = repo.search();
        for (const [key, value] of Object.entries(criteria)) {
            search = search.where(key).equals(value);
        }
        return await search.return.first();
    }

    async save(modelName, data) {
        const repo = this.repositories.get(modelName);
        if (!repo) throw new Error(`Model ${modelName} nicht gefunden.`);
        return await repo.save(data);
    }

    async delete(modelName, entityId) {
        const repo = this.repositories.get(modelName);
        if (!repo) throw new Error(`Model ${modelName} nicht gefunden.`);
        await repo.remove(entityId);
    }

    async findAll(modelName) {
        const repo = this.repositories.get(modelName);
        if (!repo) throw new Error(`Model ${modelName} nicht gefunden.`);
        return await repo.search().return.all();
    }
}

module.exports = new RedisService();