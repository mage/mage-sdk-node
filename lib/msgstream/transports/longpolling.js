'use strict';

let EventEmitter = require('events');
let querystring = require('querystring');

const DEFAULT_AFTER_REQUEST_INTERVAL = 0;
const DEFAULT_ERROR_INTERVAL = 5000;
const POLLING_DURATION = 60000;

/**
 * This is the long-polling client, retrieves push events fron the server and notify the mage client
 *
 * @type {LongPollingClient}
 */
exports.LongPollingClient = class LongPollingClient extends EventEmitter {
    constructor(client, cfg) {
        super();

        this.style = 'longpolling';

        this._client = client;
        this._endpoint = cfg.url;

        this._afterRequestInterval = cfg.afterRequestInterval || DEFAULT_AFTER_REQUEST_INTERVAL;
        this._afterErrorInterval = cfg.afterErrorInterval || DEFAULT_ERROR_INTERVAL;

        // local status
        this._running = false;
        this._lastError = null;

        // request stuff
        this._request = null;
        this._session = null;
        this._confirmIds = [];
    }

    /**
     * Is the stream running
     *
     * @returns {boolean}
     */
    get running() {
        return this._running;
    }

    /**
     * Set the session to use
     *
     * @param {Object} session
     */
    set session(session) {
        this._session = session;
    }

    /**
     * Confirm a message id
     *
     * @param {int} msgId
     */
    confirm(msgId) {
        this._confirmIds.push(msgId);
    }

    /**
     * Start the stream client, if it is
     *
     * @param {Boolean} restart - Whether to restart the stream if it is already running
     */
    start(restart) {
        if (this._running && restart) {
            this.stop();
            this.start();
            return;
        }

        this._running = true;
        this._receive();
    }

    /**
     * Stop the message stream
     */
    stop() {
        if (!this._running) {
            return;
        }
        this._running = false;
        if (this._request) {
            this._request.abort();
            this._request = null;
        }
    }

    /**
     * Receive data from the server, also send the confirmed ids
     *
     * @private
     */
    _receive() {
        if (!this._running) {
            return;
        }

        this._lastError = null;

        let params = {
            transport: this.style
        };

        if (this._session) {
            params.sessionKey = this._session.key;
        }

        if (this._confirmIds.length) {
            params.confirmIds = this._confirmIds.join(',');
        }

        // send the request
        this._request = this._client.agent.get(this._endpoint + '?' + querystring.stringify(params))
            .timeout(POLLING_DURATION)
            .end((error, res) => {
                this._request = null;

                if (error) {
                    // timeouts are normal, just schedule next tick
                    if (error.timeout) {
                        this._next();
                        return;
                    }

                    this._lastError = error;
                    this.emit('error', { error: error, data: res });
                }

                this._confirmIds = [];
                if (res && res.text) {
                    try {
                        this.emit('delivery', JSON.parse(res.text));
                    } catch (exc) {
                        this._lastError = exc;
                        this.emit('error', { error: exc, data: res });
                    }
                }

                // queue next request
                this._next();
            });
    }

    /**
     * Queue the next receive, if an error happened, wait 5 seconds
     *
     * @private
     */
    _next() {
        if (!this._running) {
            return;
        }

        let interval = this._lastError ? this._afterErrorInterval : this._afterRequestInterval;
        setTimeout(this._receive.bind(this), interval);
    }
};
