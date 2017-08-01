'use strict';

// node modules
let EventEmitter = require('events');
let request = require('superagent');

// internal modules
let Archivist = require('./archivist');
let CommandCenter = require('./commandCenter');
let MessageStream = require('./msgstream').MessageStream;
let Session = require('./session');

/**
 * The Mage Client
 * @type {Mage}
 */
module.exports = class Mage extends EventEmitter {
    /**
     * Takes a mage client config, see README for details on how to generate
     *
     * @param {Object} config
     * @throws Error
     */
    constructor(config) {
        super();

        this.config = config;
        this.archivist = new Archivist(this);

        // create our core modules
        this._stream = MessageStream.factory(this, this.config.server.msgStream);
        this._commands = new CommandCenter(this, this.config.server.commandCenter);
        this._session = new Session(this);

        if (!this._stream) {
            throw new Error('No valid configuration found for message stream');
        }

        // the webpack version of superagent doesn't have an agent (since the browser does it for us)
        this._agent = request.agent ? request.agent() : request; // this is shared between commandCenter and msgStream
        this._stream.cookies = this._cookies;
        this._commands.cookies = this._cookies;

        // stream events
        this._stream.on('delivery', this._eventDelivery.bind(this));
        this._stream.on('error', () => {
            // silence stream errors for now
        });

        // create commands from config
        this._createCommands();
    }

    /**
     * Get the agent for this mage connection
     */
    get agent() {
        return this._agent;
    }

    /**
     * The command center
     *
     * @returns {CommandCenter}
     */
    get commands() {
        return this._commands;
    }

    /**
     * Our session
     *
     * @returns {Session}
     */
    get session() {
        return this._session;
    }

    /**
     * Replace the session with a new one
     *
     * @param {Session} val
     */
    set session(val) {
        if (!(val instanceof Session)) {
            throw new Error('session must be an instance of Session');
        }
        this._session = val;
    }

    /**
     * The message stream object
     *
     * @returns {LongPollingClient|ShortPollingClient|null}
     */
    get stream() {
        return this._stream;
    }

    /**
     * Closes connection to the server
     */
    close() {
        if (this._stream) {
            this._stream.stop();
        }
    }

    /**
     * Retrieve the commands from the config and create the client.{module}.{command} helpers
     *
     * @private
     */
    _createCommands() {
        let commands = this.config.server.commandCenter.commands;

        for (let module in commands) {
            if (!commands.hasOwnProperty(module)) {
                continue;
            }

            this[module] = this[module] || {};
            for (let cmd of commands[module]) {
                this._createCommand(module, cmd);
            }
        }
    }

    /**
     * Wraps a command call
     *
     * @param {string} module
     * @param {string} cmd
     * @private
     */
    _createCommand(module, cmd) {
        let that = this;
        // arguments is being used in that function so can't use "=>"
        this[module][cmd.name] = that._commands.send.bind(that._commands, module + '.' + cmd.name);
    }

    /**
     * Deliver events from the message stream and confirm them
     *
     * @param {Object[]} messages
     * @private
     */
    _eventDelivery(messages) {
        for (let idx in messages) {
            for (let subIdx in messages[idx]) {
                const [eventName, eventData] = messages[idx][subIdx];

                this.emit(eventName, eventData);
            }
            this._stream.confirm(idx);
        }
    }
};
