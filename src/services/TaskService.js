const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const Guardian = require('./Guardian');

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

        logger.info(`📅 TaskService: ${this.runnables.size} Tasks (Daily/Fixed) synced`);
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

            if (!task) {
                await this.client.database.save('ScheduledTask', name, {
                    name,
                    type: runnable.type,
                    daily: runnable.daily,
                    time: runnable.time,
                    date: runnable.date || null,
                    nextRun: next,
                    enabled: true,
                    isRunning: false
                });
                logger.info(`🆕 Task "${name}" registriert (Next Run: ${next.toLocaleString('de-DE')})`);
            } else {
                if (task.time !== runnable.time || task.date !== runnable.date || task.daily !== runnable.daily) {
                    await this.client.database.edit('ScheduledTask', task.id, {
                        daily: runnable.daily,
                        time: runnable.time,
                        date: runnable.date || null,
                        nextRun: next
                    });
                    logger.info(`🔄 Task "${name}" Time/Date refresh (Next Run: ${next.toLocaleString('de-DE')})`);
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
            logger.info(`🚀 Starte Task: ${taskData.name}`);
            await runnable.execute(this.client);

            const updates = {
                isRunning: false,
                lastRun: new Date(),
                lastError: null
            };

            if (!taskData.daily) {
                updates.enabled = false;
                updates.nextRun = null;
            } else {
                updates.nextRun = this.calculateNextRun(taskData);
            }

            await this.client.database.edit('ScheduledTask', taskData.id, updates);
            logger.info(`✅ Task "${taskData.name}" finished successfully. Next Run: ${updates.nextRun ? new Date(updates.nextRun).toLocaleString('de-DE') : 'N/A'}`);

        } catch (err) {
            logger.error(`❌ Task "${taskData.name}" fehlgeschlagen: ${err.message}`);
            await this.client.database.edit('ScheduledTask', taskData.id, {
                isRunning: false,
                lastError: err.message
            });
            Guardian.handleGeneric(`Task Error: ${taskData.name}`, err);
        }
    }

    calculateNextRun(data) {
        const now = new Date();
        const [hours, minutes] = data.time.split(':').map(Number);

        let nextRun = new Date();

        if (data.daily) {
            nextRun.setHours(hours, minutes, 0, 0);

            if (nextRun <= now) {
                nextRun.setDate(nextRun.getDate() + 1);
            }
        } else if (data.date) {
            const [day, month, year] = data.date.split('.').map(Number);
            nextRun = new Date(year, month - 1, day, hours, minutes, 0, 0);
        }

        return nextRun;
    }
}

module.exports = TaskService;