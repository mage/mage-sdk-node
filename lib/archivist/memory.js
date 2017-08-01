'use strict';

let format = require('util').format;
let Tome = require('tomes').Tome;
let trueName = require('rumplestiltskin').trueName;

/**
 * Used for caching values locally, can be replaced with other implementations later
 *
 * TODO: maybe move the Tome related logic inside archivist itself?
 * TODO: add expiration TTL support
 */
class Memory {
    constructor(archivist) {
        this._archivist = archivist;
        this._data = {};
    }

    /**
     * Get a value from the cache, return null if not found
     *
     * @param {string} topic
     * @param {*}      index
     * @returns {*|null}
     */
    get(topic, index) {
        // trueName converts the index to a string (unique per object instance)
        let cacheKey = trueName(index);

        if (!this._data[topic]) {
            return null;
        }

        return this._data[topic][cacheKey] || null;
    }

    /**
     * Set a value in the cache, use with absolute discretion
     *
     * @param {string} topic
     * @param {*}      index
     * @param {*}      value
     * @returns {*}
     */
    set(topic, index, value) {
        let cacheKey = trueName(index);

        if (!this._data[topic]) {
            this._data[topic] = {};
        }

        if (this._data[topic][cacheKey]) {
            this._data[topic][cacheKey].assign(value);
        } else {
            this._data[topic][cacheKey] = value;
        }

        return value;
    }

    /**
     * Apply a diff on a value, only works if the value is a Tome
     *
     * @param {string} topic
     * @param {*}      index
     * @param {Object} diff
     * @returns {*}
     */
    applyDiff(topic, index, diff) {
        let cacheKey = trueName(index);

        if (!this._data[topic] || !this._data[topic][cacheKey]) {
            // TODO: probably warn?
            return null;
        }

        let value = this._data[topic][cacheKey];

        // can only apply diffs to Tomes, at least for now
        if (!(value instanceof Tome)) {
            throw new Error(
                format('Trying to apply a diff on non-tome value: %s %s', topic, index));
        }

        value.merge(diff);

        return value;
    }

    /**
     * Delete a value from the cache, forcing a call to the server on next get
     *
     * @param {string} topic
     * @param {*}      index
     */
    delete(topic, index) {
        let cacheKey = trueName(index);

        if (!this._data[topic] || !this._data[topic][cacheKey]) {
            return;
        }

        delete this._data[topic][cacheKey];
    }
}

module.exports = Memory;