'use strict';

let EventEmitter = require('events');
let querystring = require('querystring');

const DEFAULT_TIMEOUT = 5000;
const HTTP_OK = 200;


/**
 * ES6 implementation of the command center
 * TODO: file upload
 * TODO: retry?
 */
module.exports = class CommandCenter extends EventEmitter {
    /**
     * Just setup the command center
     *
     * @param {Mage} client
     * @param {Object} cfg
     */
    constructor(client, cfg) {
        super();

        this._client = client;

        this._queryId = 0;
        this._hooks = new Map();

        this._url = cfg.url;
        this._timeout = cfg.timeout || DEFAULT_TIMEOUT;

        this._scheduled = false;
        this._locked = false;
        this._queue = [];
    }

    /**
     * Register a hook with the command center, when hooks are called they should return an
     * object that will then be set as a header to the current call
     *
     * @param {string} name
     * @param {Function} fn
     */
    registerHook(name, fn) {
        this._hooks.set(name, fn);
    }

    /**
     * Remove a hook from the command center
     *
     * @param {string} name
     */
    unregisterHook(name) {
        this._hooks.delete(name);
    }

    /**
     * Call the command center, returns a promise and queue the command, the promise only resolves
     * once the queue goes through
     *
     * @param {string} cmdName
     * @param {*[]} params
     * @returns {Promise}
     */
    send(cmdName, ...params) {
        params = JSON.stringify(params);

        return new Promise((resolve, reject) => {
            let cmd = {
                name: cmdName,
                params: params || [],
                resolve: resolve,
                reject: reject
            };

            this.emit('queued', cmd);
            this._queue.push(cmd);
            this._schedule();
        });
    }

    /**
     * Parse events returned with the current call
     *
     * @param {Object[]} events
     * @private
     */
    _parseEvents(events) {
        events = events || [];
        for (let i = 0; i < events.length; i++) {
            const [eventName, eventData] = events[i];
            this._client.emit(eventName, eventData);
        }
    }

    /**
     * Parse a response from the server for the given queue
     *
     * @param {Object[]} queue
     * @param {Error|null} error
     * @param {IncomingMessage} res
     * @param {string|null} body
     * @returns {void}
     * @private
     */
    _parseServerResponse(queue, error, res) {
        if (!error && res.statusCode !== HTTP_OK) {
            error = new Error(res.statusMessage, res.statusCode);
        }

        if (error) {
            // fail all commands
            this._queueError(queue, error);
            return;
        }

        // unlock the command center
        this._unlock();

        // try to parse the body
        let responses = [];
        try {
            if (res.text) {
                responses = JSON.parse(res.text);
            }
        } catch (err) {
            this._queueError(queue, err);
            return;
        }

        // for every commands we should get a response, even if empty
        if (responses.length !== queue.length) {
            this._queueError(queue, new Error('invalid response from server'));
            return;
        }

        // resolve or reject each queued message
        for (let i = 0; i < responses.length; i++) {
            const cmd = queue[i];
            const [errorCode, cmdResponse, events] = responses[i];

            if (events) {
                try {
                    this._parseEvents(events);
                } catch (exc) {
                    if (exc instanceof ReferenceError) {
                        // ReferenceError is only thrown by desynced tomes, client should abort everything
                        this.emit('desync');
                    }
                    cmd.reject(exc);
                    continue;
                }
            }

            if (errorCode) {
                cmd.reject(errorCode);
                continue;
            }

            cmd.resolve(cmdResponse);
        }
    }

    /**
     * Reject an entire queue, called when the server misbehave
     *
     * @param {Object[]} queue
     * @param {Error} error
     * @private
     */
    _queueError(queue, error) {
        for (let cmd of queue) {
            cmd.reject(error);
        }
        return this.emit('error', error);
    }

    /**
     * Schedule the next queue
     *
     * @private
     */
    _schedule() {
        if (this._locked || this._scheduled) {
            return;
        }

        this._queryId++;
        this._scheduled = setImmediate(this._sendCurrentBatch.bind(this));
        this.emit('scheduled', this._queryId);
    }

    /**
     * Send the current queue
     *
     * @private
     */
    _sendCurrentBatch() {
        let queue = this._queue;
        this._queue = [];

        this._locked = true;
        this._scheduled = null;

        let queueLen = queue.length,
            cmdNames = new Array(queueLen),
            cmdParams = new Array(queueLen);

        for (let i = 0; i < queueLen; i++) {
            let cmd = queue[i];

            cmdNames[i] = cmd.name;
            cmdParams[i] = cmd.params;
        }

        let header = [];
        for (let hook of this._hooks.entries()) {
            const [name, hookFn] = hook;
            const out = hookFn(cmdParams);
            if (out) {
                out.name = name;
                header.push(out);
            }
        }

        const url = encodeURI(this._url + '/' + cmdNames.join(',') + '?' + querystring.stringify({
            queryId: this._queryId
        }));
        const data = JSON.stringify(header) + '\n' + cmdParams.join('\n');

        this._client.agent.post(url)
            .set('Content-Type', 'text/plain; charset=UTF-8')
            .send(data)
            .timeout(this._timeout)
            .end(this._parseServerResponse.bind(this, queue));
    }

    /**
     * Unlock the queue and reschedule if messages are waiting
     *
     * @private
     */
    _unlock() {
        this._locked = false;
        if (this._queue.length) {
            this._schedule();
        }
    }
};