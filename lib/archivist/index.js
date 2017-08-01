'use strict';

let EventEmitter = require('events');
let media = require('./media');
let Memory = require('./memory');

/**
 * Just iterate
 *
 * @param max
 */
function *range(max) {
    for (let i = 0; i < max; i++) {
        yield i;
    }
}

/**
 * Generator that iterates on an array/object, yields [key, value]
 *
 * @param {Array|Object} iterator
 */
function *items(iterator) {
    let keys = Array.isArray(iterator) ? range(iterator.length) : Object.keys(iterator);
    for (let key of keys) {
        yield [key, iterator[key]];
    }
}

/**
 * Implements the original Archivist class but for the client, doesn't support pushing
 * local modifications to the server
 */
class Archivist extends EventEmitter {
    /**
     * Takes a mage client for querying the server
     *
     * @param {Mage} client
     */
    constructor(client) {
        super();

        this._client = client;
        this._cache = new Memory(this);

        // listen to events on mage itself
        this._client.on('archivist:applyDiff', this._eventApplyDiff.bind(this));
        this._client.on('archivist:del', this._eventDel.bind(this));
        this._client.on('archivist:set', this._eventSet.bind(this));
    }

    /**
     * Get the current cache object
     *
     * @returns {Memory}
     */
    get cache() {
        return this._cache;
    }

    exists(topic, index, options) {
        options = options || {};

        return new Promise((resolve, reject) => {
            if (this._cache.get(topic, index)) {
                resolve(true);
                return;
            }

            this._client.archivist.rawExists(topic, index, options).then(resolve, reject);
        });
    }

    /**
     * Retrieve a value from a topic
     *
     * @param {string} topic
     * @param {*}      index
     * @param {*}      [options]
     * @returns {Promise}
     */
    get(topic, index, options) {
        options = options || {};

        return new Promise((resolve, reject) => {
            if (index) {
                const cached = this._cache.get(topic, index);

                if (cached) {
                    resolve(cached);
                    return;
                }
            }

            this._client.archivist.rawGet(topic, index, options).then(data => {
                if (!data) {
                    resolve(null);
                    return;
                }

                resolve(this._cache.set(topic, index, media.decode(data)));
            }, reject);
        });
    }

    /**
     * Runs a list operation on the server
     *
     * @param {string} topic
     * @param {*}      partialIndex
     * @param {*}      [options]
     * @returns {Promise}
     */
    list(topic, partialIndex, options) {
        options = options || {};

        return this._client.archivist.rawList(topic, partialIndex, options);
    }

    /**
     * Get multiple values in one call to the server
     *
     * @param {Object} queries
     * @param {Object} [options]
     * @returns {Promise}
     */
    mget(queries, options) {
        options = options || {};

        return new Promise((resolve, reject) => {
            let results = Array.isArray(queries) ? new Array(queries.length) : {};
            let server = { ids: [], queries: [] };

            for (const [queryId, query] of items(queries)) {
                const cached = this._cache.get(query.topic, query.index);

                if (cached) {
                    results[queryId] = cached;
                } else {
                    server.ids.push(queryId);
                    server.queries.push(query);
                }
            }

            if (!server.ids.length) {
                resolve(results);
                return;
            }

            this._client.archivist.rawMGet(server.queries, options).then(data => {
                if (!data) {
                    resolve(results);
                    return;
                }

                // cache results
                for (let i = 0; i < data.length; i++) {
                    const result = data[i];
                    const id = server.ids[i];

                    results[id] = this._cache.set(
                        result.key.topic,
                        result.key.index,
                        media.decode(result)
                    );
                }

                resolve(results);
            }, reject);
        });
    }

    /**
     * Event handler for archivist:applyDiff
     *
     * @param item
     * @private
     */
    _eventApplyDiff(item) {
        let val = this._cache.applyDiff(item.key.topic, item.key.index, item.diff);
        this.emit(item.key.topic, 'applyDiff', item.key.index, val);
    }

    /**
     * Event handler for archivist:del
     *
     * @param item
     * @private
     */
    _eventDel(item) {
        this._cache.delete(item.key.topic, item.key.index);
        this.emit(item.key.topic, 'del', item.key.index);
    }

    /**
     * Event handler for archivist:set
     *
     * @param {Object} item
     * @private
     */
    _eventSet(item) {
        let val = this._cache.set(item.key.topic, item.key.index, media.decode(item));
        this.emit(item.key.topic, 'set', item.key.index, val);
    }
}

module.exports = Archivist;