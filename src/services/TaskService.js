const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const Guardian = require('./Guardian');
const ms = require('ms');
const TaskTypes = require('../enums/TaskTypes');

class TaskService {
    constructor(client) {
        this.client = client;
        this.runnables = new Map();
        this.checkInterval = null;
    }

    async init() {
        const runnablePath = path.join(__dirname, '../runnables');
        if (!fs.existsSync(runnablePath)) fs.mkdirSync(runnablePath, { recursive: true });

        await this._loadRunnables(runnablePath);
        await this._syncWithDatabase();

        this.checkInterval = setInterval(() => this.processDueTasks(), 30000);

        logger.info(`📅 TaskService: ${this.runnables.size} Tasks (${Array.from(this.runnables.values()).map(t => t.type).join(', ')}) synced`);
    }

    async _loadRunnables(dir) {
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
        for (const file of files) {
            try {
                delete require.cache[require.resolve(path.join(dir, file))];
                const runnable = require(path.join(dir, file));

                this.runnables.set(runnable.name, runnable);
            } catch (err) {
                logger.error(`[TaskService] Error while loading ${file}: ${err.message}`);
            }
        }
    }

    async _syncWithDatabase() {
        for (const [name, runnable] of this.runnables) {
            let task = await this.client.database.findOne('ScheduledTask', { name });

            const next = this.calculateNextRun(runnable);
            const normalizedType = runnable.type.toUpperCase();

            if (!task) {
                await this.client.database.save('ScheduledTask', name, {
                    name,
                    type: TaskTypes[normalizedType] || normalizedType,
                    expression: runnable.expression || null,
                    time: runnable.time || null,
                    date: runnable.date || null,
                    nextRun: next,
                    enabled: true,
                    isRunning: false
                });
                logger.info(`🆕 Task "${name}" registert (Type: ${runnable.type} | Next Run: ${next.toLocaleString('de-DE')})`);
            } else {
                if (
                    task.type !== (TaskTypes[normalizedType] || normalizedType) ||
                    task.time !== (runnable.time || null) ||
                    task.date !== (runnable.date || null) ||
                    task.expression !== (runnable.expression || null)
                ) {
                    await this.client.database.edit('ScheduledTask', task.id, {
                        type: TaskTypes[normalizedType] || normalizedType,
                        time: runnable.time || null,
                        date: runnable.date || null,
                        expression: runnable.expression || null,
                        nextRun: next
                    });
                    logger.info(`🔄 Task "${name}" refreshed (Next Run: ${next.toLocaleString('de-DE')})`);
                }
            }
        }
    }

    async processDueTasks() {
        const now = new Date();
        try {
            const dueTasks = await this.client.database.findMany('ScheduledTask', {
                enabled: true,
                isRunning: false
            });

            const executableTasks = dueTasks.filter(t => t.nextRun && new Date(t.nextRun) <= now);

            for (const taskData of executableTasks) {
                await this._runTask(taskData);
            }
        } catch (err) {
            logger.error(`[TaskService] Error with Process: ${err.message}`);
        }
    }

    async _runTask(taskData) {
        const runnable = this.runnables.get(taskData.name);
        if (!runnable) return;

        await this.client.database.edit('ScheduledTask', taskData.id, { isRunning: true });

        try {
            logger.info(`🚀 Start Task: ${taskData.name} (${taskData.type})`);
            await runnable.execute(this.client);

            const updates = {
                isRunning: false,
                lastRun: new Date(),
                lastError: null
            };

            if (taskData.type === TaskTypes.ONCE) {
                updates.enabled = false;
                updates.nextRun = null;
            } else {
                updates.nextRun = this.calculateNextRun(taskData);
            }

            await this.client.database.edit('ScheduledTask', taskData.id, updates);
            logger.info(`✅ Task "${taskData.name}" finished. Next Run: ${updates.nextRun ? new Date(updates.nextRun).toLocaleString('de-DE') : 'N/A'}`);

        } catch (err) {
            logger.error(`❌ Task "${taskData.name}" failed: ${err.message}`);
            await this.client.database.edit('ScheduledTask', taskData.id, {
                isRunning: false,
                lastError: err.message
            });
            await Guardian.handleGeneric(`Task Error: ${taskData.name}`, err);
        }
    }

    calculateNextRun(data) {
        const now = new Date();
        const taskType = data.type.toUpperCase();

        switch (taskType) {
            case TaskTypes.DAILY: {
                const [hours, minutes] = data.time.split(':').map(Number);
                let nextRun = new Date();
                nextRun.setHours(hours, minutes, 0, 0);

                if (nextRun <= now) {
                    nextRun.setDate(nextRun.getDate() + 1);
                }
                return nextRun;
            }

            case TaskTypes.ONCE: {
                const [hours, minutes] = data.time.split(':').map(Number);
                const [day, month, year] = data.date.split('.').map(Number);
                return new Date(year, month - 1, day, hours, minutes, 0, 0);
            }

            case TaskTypes.INTERVAL: {
                const duration = ms(data.expression);
                if (!duration) {
                    logger.error(`[TaskService] Ungültige Interval-Expression im Task "${data.name}": ${data.expression}`);
                    return new Date(Date.now() + 60000);
                }
                return new Date(Date.now() + duration);
            }

            default: {
                logger.error(`[TaskService] Unbekannter Task-Typ: ${data.type} beim Task "${data.name}"`);
                return new Date(Date.now() + 60000);
            }
        }
    }
}

module.exports = TaskService;