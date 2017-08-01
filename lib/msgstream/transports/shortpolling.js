'use strict';

let LongPollingClient = require('./longpolling').LongPollingClient;

const DEFAULT_AFTER_REQUEST_INTERVAL = 5000;

/**
 * Just extends the LongPollingClient and make a couple adjustements
 *
 * @type {ShortPollingClient}
 */
exports.ShortPollingClient = class ShortPollingClient extends LongPollingClient {
    constructor(cfg) {
        super(cfg);

        this.style = 'shortpolling';
        this._afterRequestInterval = cfg.afterRequestInterval || DEFAULT_AFTER_REQUEST_INTERVAL;
    }
};