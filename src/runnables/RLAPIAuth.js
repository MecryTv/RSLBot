const ComponentV2Container = require('../utils/ComponentV2Container');
const RLAPIService = require('../services/RLAPIService');
const logger = require('../utils/logger');
const { MessageFlags } = require('discord.js');

module.exports = {
    name: "DailyAPIAuthCheck",
    type: "CRON",
    expression: "21 22 * * *",
    async execute (client) {

        const mecryID = "1059621019947634739";
        const RLAPI = new RLAPIService();

        try {
            const authInfo = await RLAPI.getAuthInfo();

            const expiresAt = new Date(authInfo.ExpiresAt);
            const now = new Date();

            const timeRemaining = expiresAt - now;
            const diffDays = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
            const diffHours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

            const title = "🎫 Rocket League API - Zahlungs-Check";

            let timeWarning = "";
            if (timeRemaining <= 0) {
                timeWarning = "⚠️ **DEINE LIZENZ IST ABGELAUFEN!**";
            } else {
                timeWarning = `Deine Lizenz ist noch **${diffDays} Tage und ${diffHours} Stunden** gültig.`;
            }

            const text = `Hallo! Hier ist dein täglicher Statusbericht für die Rocket League API.\n\n` +
                `📅 **Ablaufdatum:** ${expiresAt.toLocaleDateString('de-DE')} um ${expiresAt.toLocaleTimeString('de-DE')} Uhr\n` +
                `⏳ **Status:** ${timeWarning}\n` +
                `📊 **Genutzte Requests:** ${authInfo.Requests}\n\n` +
                `Um den Service weiterhin ohne Unterbrechung zu nutzen, kannst du hier verlängern:\n` +
                `👉 **[Über PayPal verlängern](https://paypal.me/stevp)**\n\n` +
                `*Bitte beachte, dass die Bearbeitung der Zahlung bis zu 24h dauern kann.*`;

            const authContainer = ComponentV2Container(title, text, null);
            const user = await client.users.fetch(mecryID);

            if (user) {
                try {
                    await user.send({
                        flags: 32768,
                        components: [authContainer.toJSON()]
                    });
                } catch (djsError) {
                    const dmChannel = await user.createDM();
                    await client.rest.post(`/channels/${dmChannel.id}/messages`, {
                        body: {
                            flags: 32768,
                            components: [authContainer.toJSON()]
                        }
                    });
                }
            }
        } catch (error) {
            logger.error("[DailyAPIAuthCheck] Fehler beim Ausführen des Tasks:", error);
        }
    }
}