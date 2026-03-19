const axios = require('axios');
const { RLAPI } = require('../../config');
const logger = require('../utils/logger');

class RLAPIService {
    constructor() {
        this.client = axios.create({
            baseURL: RLAPI.URI,
            headers: {
                'Authorization': RLAPI.KEY,
                'Content-Type': 'application/json'
            }
        });
    }

    async resolveUser(epicName) {
        try {
            const response = await this.client.post('/Revolver/ResolveUser', {
                User: epicName
            });

            if (!response.data || !response.data.Result) {
                logger.error(`[RLAPIService] Critical API Error: Invalid response structure when resolving user "${epicName}". Response: ${JSON.stringify(response.data)}`);
                throw new Error(`Invalid response from RLAPI when resolving user "${epicName}". Please check the logs for more details.`);
            }

            return response.data.Result.AccountID;
        } catch (error) {
            logger.error(`[RLAPIService] Critical API Error: Failed to resolve user "${epicName}".`, error);
            throw new Error(`Failed to resolve user "${epicName}". Please check the logs for more details.`);
        }
    }
}