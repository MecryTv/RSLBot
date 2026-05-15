class DateTimeService {
    formatDate(date = new Date()) {
        return date.toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            timeZone: 'Europe/Berlin'
        });
    }

    formatTime(date = new Date()) {
        return date.toLocaleTimeString('de-DE', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'Europe/Berlin'
        });
    }

    getNow(date = new Date()) {
        return {
            date: this.formatDate(date),
            time: this.formatTime(date)
        };
    }
}

module.exports = new DateTimeService();