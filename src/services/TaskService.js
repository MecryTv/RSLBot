const cronParser = require('cron-parser');
const ms = require('ms');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class TaskService {
    constructor(client) {
        this.client = client;
        this.client.loadedTasks = [];
    }

    async init() {
        const runnablePath = path.join(__dirname, '../runnables');

        if (!fs.existsSync(runnablePath)) fs.mkdirSync(runnablePath, { recursive: true });

        const files = fs.readdirSync(runnablePath).filter(f => f.endsWith('.js'));

        for (const file of files) {
            try {
                const runnable = require(path.join(runnablePath, file));
                this.client.loadedTasks.push(runnable);

                let task = await this.client.database.findOne('ScheduledTask', { name: runnable.name });
                const next = this.calculateNextRun(runnable.type, runnable.expression);

                if (!task) {
                    await this.client.database.save('ScheduledTask', {
                        name: runnable.name,
                        type: runnable.type,
                        expression: runnable.expression,
                        nextRun: next,
                        enabled: true,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });
                }
            } catch (err) {
                logger.error(`[TaskService] Error loading ${file}: ${err.message}`);
            }
        }

        logger.info(`📜 ${files.length} ScheduledTasks loaded into Memory & DB`);

        setInterval(() => this.checkTasks(), 30000);
    }

    async checkTasks() {
        const now = new Date();

        try {
            const repo = this.client.database.repositories.get('ScheduledTask');

            const dueTasks = await repo.search()
                .where('nextRun').lessThanOrEqualTo(now)
                .and('enabled').true()
                .return.all();

            for (const taskData of dueTasks) {
                const runnable = this.client.loadedTasks.find(t => t.name === taskData.name);

                if (!runnable) {
                    logger.error(`[TaskService] Task "${taskData.name}" gefunden, aber das File im runnable-Ordner fehlt!`);
                    continue;
                }

                try {
                    await runnable.execute(this.client);

                    if (taskData.type === 'ONCE') {
                        taskData.enabled = false;
                    } else {
                        taskData.nextRun = this.calculateNextRun(taskData.type, taskData.expression);
                    }

                    taskData.lastRun = now;
                    taskData.updatedAt = now;

                    await this.client.database.save('ScheduledTask', taskData);

                } catch (e) {
                    logger.error(`Run-Error (${taskData.name}): ${e.message}`);
                }
            }
        } catch (err) {
            logger.error(`[TaskService] Error during checkTasks: ${err.message}`);
        }
    }

    calculateNextRun(type, expression) {
        try {
            if (type === 'CRON') {
                let parser;
                if (typeof cronParser.parseExpression === 'function') {
                    parser = cronParser.parseExpression(expression);
                } else if (cronParser.default && typeof cronParser.default.parseExpression === 'function') {
                    parser = cronParser.default.parseExpression(expression);
                } else {
                    parser = cronParser.CronExpressionParser.parse(expression);
                }
                return parser.next().toDate();
            }
            if (type === 'INTERVAL') return new Date(Date.now() + ms(expression));
            if (type === 'ONCE') return new Date(expression);
        } catch (error) {
            logger.error(`[TaskService] Invalid expression (${expression}): ${error.message}`);
        }
        return new Date();
    }
}

module.exports = TaskService;