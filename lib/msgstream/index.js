'use strict';

let LongPollingClient = require('./transports/longpolling').LongPollingClient;
let ShortPollingClient = require('./transports/shortpolling').ShortPollingClient;

const transports = {
    longpolling: LongPollingClient,
    shortpolling: ShortPollingClient
};

/**
 * A small static class whose purpose is to just give a factory
 * @type {MessageStream}
 */
exports.MessageStream = class MessageStream {
    /**
     * Takes the mage client and the stream configuration
     *
     * @param {Object}     config
     * @returns {LongPollingClient|ShortPollingClient|null}
     */
    static factory(client, config) {
        let detect = config.detect || ['longpolling', 'shortpolling'];

        for (let transport of detect) {
            if (transports[transport] && config.transports[transport]) {
                return new (transports[transport])(client, config.transports[transport]);
            }
        }

        return null;
    }
};

exports.transports = transports;
exports.longpolling = LongPollingClient;
exports.shortpolling = ShortPollingClient;
