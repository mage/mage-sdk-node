'use strict';

let Tome = require('tomes').Tome;

/**
 * Matches basic media and unknown medias, just retrieve the data as is
 */
class BaseMedia {
    static decode(value) {
        return value.data;
    }
}

/**
 * JSON.parse and put the value in a Tome
 */
class TomeMedia {
    static decode(value) {
        return Tome.conjure(JSON.parse(value.data));
    }
}

/**
 * Raw JSON, no Tome
 */
class JsonMedia {
    static decode(value) {
        return JSON.parse(value.data);
    }
}

/**
 * Raw text, just use the base media
 * TODO: support encodings
 */
class TextMedia extends BaseMedia {
    // don't do anything
}

/**
 * Binary media, store the value in a buffer
 */
class BinaryMedia {
    static decode(value) {
        return new Buffer(value.data, value.encoding);
    }
}

const types = {
    '*': BaseMedia,
    'application/x-tome': TomeMedia,
    'application/json': JsonMedia,
    'text/plain': TextMedia,
    'application/octet-stream': BinaryMedia
};

/**
 * Takes a server value and returns the actual value to store in the cache
 *
 * @param {Object} item
 * @returns {*}
 */
exports.decode = function(item) {
    let value = item.value;
    let decoder = types[value.mediaType || '*'] || types['*'];

    return decoder.decode(value);
};