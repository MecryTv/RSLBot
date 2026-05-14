const { createClient: createSupabase } = require('@supabase/supabase-js');
const { DATABASE } = require('../../config.json');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const { z } = require('zod');

class DatabaseService {
    constructor() {
        this.supabase = createSupabase(DATABASE.SUPABASE_URL, DATABASE.SUPABASE_KEY);
        this.models = new Map();
    }

    async connect() {
        logger.info("✅  DatabaseService (Supabase) initialized.");
    }

    async loadModels(folderPath) {
        if (!fs.existsSync(folderPath)) return;
        const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));
        for (const file of files) {
            const modelDef = require(path.join(folderPath, file));
            this.models.set(modelDef.name, modelDef);
        }
    }

    _validate(model, data, partial = false) {
        if (!model.validate) return data;
        try {
            const schema = partial ? model.validate.partial() : model.validate;
            return schema.parse(data);
        } catch (error) {
            throw new Error(`Validation failed for ${model.name}: ${error.errors.map(e => e.path + " " + e.message).join(", ")}`);
        }
    }

    _buildSelect(includes = []) {
        if (!includes || includes.length === 0) return '*';
        return `*, ${includes.map(rel => `${rel}(*)`).join(', ')}`;
    }

    async save(modelName, id, data) {
        const model = this.models.get(modelName);
        if (!model) throw new Error(`Model ${modelName} not found.`);

        const validatedData = this._validate(model, data);

        const { data: dbData, error } = await this.supabase
            .from(model.table)
            .upsert({ id, ...validatedData, deleted_at: null })
            .select().single();

        if (error) throw error;
        return dbData;
    }

    async findOne(modelName, criteria = {}, includes = []) {
        const model = this.models.get(modelName);
        if (!model) throw new Error(`Model ${modelName} not found.`);

        const { data, error } = await this.supabase
            .from(model.table)
            .select(this._buildSelect(includes))
            .match(criteria)
            .is('deleted_at', null)
            .maybeSingle();

        if (error) throw error;
        return data;
    }

    async findMany(modelName, criteria = {}, includes = []) {
        const model = this.models.get(modelName);
        if (!model) throw new Error(`Model ${modelName} not found.`);

        let query = this.supabase
            .from(model.table)
            .select(this._buildSelect(includes))
            .is('deleted_at', null);

        if (Object.keys(criteria).length > 0) query = query.match(criteria);

        const { data, error } = await query;
        if (error) throw error;
        return data;
    }

    async edit(modelName, id, data) {
        const model = this.models.get(modelName);
        if (!model) throw new Error(`Model ${modelName} not found.`);

        const validatedData = this._validate(model, data, true);

        const { data: dbData, error } = await this.supabase
            .from(model.table)
            .update(validatedData)
            .eq('id', id)
            .select().single();

        if (error) throw error;
        return dbData;
    }

    async delete(modelName, id, hard = false) {
        const model = this.models.get(modelName);
        if (!model) throw new Error(`Model ${modelName} not found.`);

        if (hard) {
            const { error } = await this.supabase.from(model.table).delete().eq('id', id);
            if (error) throw error;
        } else {
            const { error } = await this.supabase.from(model.table).update({ deleted_at: new Date() }).eq('id', id);
            if (error) throw error;
        }
        return true;
    }

    async increment(modelName, id, column, amount = 1) {
        const model = this.models.get(modelName);
        if (!model) throw new Error(`Model ${modelName} not found.`);

        const { error } = await this.supabase.rpc('increment_val', {
            table_name: model.table, row_id: id, column_name: column, amount: amount
        });
        if (error) throw error;
    }

    async decrement(modelName, id, column, amount = 1) {
        return this.increment(modelName, id, column, -amount);
    }

    async cleanupSoftDeletes() {
        const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        let deletedTotal = 0;
        for (const model of this.models.values()) {
            const { error, count } = await this.supabase.from(model.table).delete({ count: 'exact' }).lt('deleted_at', threshold);
            if (!error) deletedTotal += (count || 0);
        }
        if (deletedTotal > 0) logger.info(`🧹 Cleanup: ${deletedTotal} soft-deleted records permanently removed.`);
    }

    getModelCount() {
        return this.models.size;
    }
}

module.exports = new DatabaseService();