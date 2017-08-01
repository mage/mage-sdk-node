'use strict';

module.exports = class Session {
    /**
     * Register a couple events managers and hooks
     *
     * @param {Mage} client
     */
    constructor(client) {
        this._session = {};

        client.on('session.set', session => {
            this._session = session;
            client.stream.session = session;
            client.stream.start();
        });

        client.on('session.unset',  () => {
            this._session = {};
        });

        client.commands.registerHook('mage.session', this._commandHook.bind(this));
    }

    /**
     * Return the actorId
     *
     * @returns {string|null}
     */
    get actorId() {
        return this._session.actorId || null;
    }

    /**
     * Return the session key
     *
     * @returns {string|null}
     */
    get key() {
        return this._session.key || null;
    }

    /**
     * This hook is installed on the command center and sets the session in the headers
     *
     * @returns {{key: (string|null)}}
     * @private
     */
    _commandHook() {
        return this.key ? { key: this.key } : null;
    }
};