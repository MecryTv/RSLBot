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
        const TaskModel = require('../models/ScheduledTask')(this.client);
        const runnablePath = path.join(__dirname, '../runnables');

        if (!fs.existsSync(runnablePath)) fs.mkdirSync(runnablePath);

        const files = fs.readdirSync(runnablePath).filter(f => f.endsWith('.js'));

        for (const file of files) {
            try {
                const runnable = require(path.join(runnablePath, file));
                this.client.loadedTasks.push(runnable);

                let task = await TaskModel.findOne({ name: runnable.name });
                const next = this.calculateNextRun(runnable.type, runnable.expression);

                if (!task) {
                    await TaskModel.create({
                        name: runnable.name,
                        type: runnable.type,
                        expression: runnable.expression,
                        nextRun: next
                    });
                }
            } catch (err) {
                logger.error(`[TaskService] Error loading ${file}: ${err.message}`);
            }
        }

        setInterval(() => this.checkTasks(), 30000);
    }

    async checkTasks() {
        const TaskModel = require('../models/ScheduledTask')(this.client);
        const now = new Date();
        const dueTasks = await TaskModel.find({ nextRun: { $lte: now }, enabled: true });

        for (const taskData of dueTasks) {
            const runnable = require(`../runnables/${taskData.name}.js`);
            try {
                await runnable.execute(this.client);

                if (taskData.type === 'ONCE') {
                    await TaskModel.updateOne({ _id: taskData._id }, { enabled: false, lastRun: now });
                } else {
                    const nextDate = this.calculateNextRun(taskData.type, taskData.expression);
                    await TaskModel.updateOne({ _id: taskData._id }, { nextRun: nextDate, lastRun: now });
                }
            } catch (e) { logger.error(`Run-Error (${taskData.name}): ${e.message}`); }
        }
    }

    calculateNextRun(type, expression) {
        if (type === 'CRON') return cronParser.parseExpression(expression).next().toDate();
        if (type === 'INTERVAL') return new Date(Date.now() + ms(expression));
        if (type === 'ONCE') return new Date(expression);
        return new Date();
    }
}