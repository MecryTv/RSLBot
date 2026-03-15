const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class ModelService {
    constructor() {
        this.models = new Map();
        this._loadModels();
    }

    _getAllFiles(dir) {
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            return entries.flatMap(entry => {
                const res = path.resolve(dir, entry.name);
                return entry.isDirectory() ? this._getAllFiles(res) : res;
            });
        } catch(error) {
            logger.error(`[ModelService] Critical File System Error: Failed to read directory ${dir}.`, error);
            return [];
        }
    }

    _loadModels() {
        const modalsPath = path.join(__dirname, "..", "models");

        if (!fs.existsSync(modalsPath)) {
            logger.warn(`[ModelService] Warning: Modals directory not found at ${modalsPath}. No models loaded.`);
            return;
        }

        const modalFiles = this._getAllFiles(modalsPath).filter(file => file.endsWith(".js"));

        for (const file of modalFiles) {
            try {
                const model = require(file);
                if (model && model.modelName) {
                    this.models.set(model.modelName.toLowerCase(), model);
                }
            } catch(error) {
                logger.error(`[ModelService] Critical Load Error: Failed to load model from ${file}.`, error);
            }
        }
    }

    getModelCount() {
        return this.models.size;
    }

    _getModel(modelName) {
        const model = this.models.get(modelName.toLowerCase());
        if (!model) {
            throw new Error(`Model "${modelName}" was not found or has not been loaded.`);
        }
        return model;
    }

    async create(modelName, data) {
        const Model = this._getModel(modelName);
        const newDocument = new Model(data);
        return await newDocument.save();
    }

    async findOne(modelName, query = {}) {
        const Model = this._getModel(modelName);
        return await Model.findOne(query).exec();
    }

    async find(modelName, query = {}) {
        const Model = this._getModel(modelName);
        return await Model.find(query).exec();
    }

    async updateOne(modelName, query, updateData, options = {}) {
        const Model = this._getModel(modelName);
        return await Model.findOneAndUpdate(query, updateData, { new: true, ...options }).exec();
    }

    async deleteOne(modelName, query) {
        const Model = this._getModel(modelName);
        return await Model.deleteOne(query).exec();
    }

    async delete(modelName, query) {
        const Model = this._getModel(modelName);
        return await Model.deleteMany(query).exec();
    }

    async exists(modelName, query = {}) {
        const Model = this._getModel(modelName);
        const result = await Model.exists(query).exec();
        return result !== null;
    }
}

module.exports = new ModelService();