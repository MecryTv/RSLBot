const logger = require('../utils/logger');
const Guardian = require('../services/Guardian');
const TaskTypes = require('../enums/TaskTypes');

module.exports = {
    name: "DatabaseCleanup",
    type: TaskTypes.DAILY,
    time: "03:00",

    async execute(client) {
        if (!client.database) {
            return logger.error("[Task] Database service not initialized. Skipping Database Cleanup.");
        }

        try {
            logger.info("[Task] Starting Database Cleanup...");

            await client.database.cleanupSoftDeletes();

            logger.info("[Task] Database Cleanup successfully completed.");
        } catch (error) {
            logger.error(`[Task] Error while CleanUp: ${error.message}`);

            await Guardian.handleGeneric("Daily Cleanup Task Failed", error);
        }
    }
};