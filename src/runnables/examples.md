## runnables/DailyCheck.js
```js
module.exports = {
    name: "DailyCheck",
    type: "CRON",
    expression: "30 14 * * *", // Daily at 14:30 (2:30 PM)
    async execute(client) {
        console.log("Es ist 14:30! Starte tägliche Routine...");
    }
};
```

## CRON Expression Guide
```txt
// expression: "0 0 * * 1"      -> Every Monday at 12:00 am (00:00)
// expression: "0 0 1 * *"      -> On the 1st of every month at 12:00 am (00:00)
// expression: "0 0 1 1 *"      -> Every January 1 (annually/yearly)
```

## runnables/StatusUpdate.js
```js
module.exports = {
    name: "StatusUpdate",
    type: "INTERVAL",
    expression: "15m", // Every 15 minutes (uses ms format: 1h, 2d, 30s)
    async execute(client) {
        client.user.setActivity(`${client.guilds.cache.size} Servern zu`, { type: 3 });
    }
};
```

## runnables/SpecialEvent.js
```js
module.exports = {
    name: "SpecialEvent",
    type: "ONCE",
    expression: "2026-12-24T18:00:00", // December 24, 2026, at 6:00 pm (18:00)
    async execute(client) {
        console.log("Frohe Weihnachten 2026! Event startet jetzt.");
    }
};
```