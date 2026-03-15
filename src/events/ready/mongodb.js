const Event = require("../../structures/Events");
const { DATABASE } = require("../../../config.json");
const mongoose = require("mongoose");
const logger = require("../../utils/logger");
const Guardian = require("../../services/Guardian");

class MongoDB extends Event {
  constructor(client) {
    super(client, "clientReady", true);
  }

  async execute() {
      if (!DATABASE.DISCORD) {
          return Guardian.handleEvent(
              "Die MongoDB URL fehlt in der config.json.",
              { eventName: this.name }
          );
      }

      try {
          const baseConnection = await mongoose.createConnection(DATABASE.URI).asPromise();

          this.client.discordDB = baseConnection.useDb(DATABASE.DB_DISCORD);
          this.client.websiteDB = baseConnection.useDb(DATABASE.DB_WEBSITE);

          logger.info("✅ MongoDB Cluster connected (Discord & Website DBs ready)");
      } catch (error) {
          Guardian.handleEvent(
              `Verbindung fehlgeschlagen. Grund: ${error.message}`,
              { eventName: this.name }
          );
      }
  }
}

module.exports = MongoDB;