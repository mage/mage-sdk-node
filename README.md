# Mage Client

This is a MAGE client written in pure ES6, it should be compatible with Node 5.x and should also
run in the browser if built through a tool like Babel.

## Installation

```
npm i mage-sdk-node --save
```

## Usage

### Node.JS

```javascript
const Mage = require('mage-sdk-node')
const config = require('./my-mage-config')


const client = new Mage(config)

// mage commands are now promises so they can be chained
client.user.register()
    .then(() => {
        // do game/app logic
    })
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
```

### Async/Await

If async/await is available, the code above can be rewritten as follow:

```javascript
const Mage = require('mage-sdk-node')
const config = require('./my-mage-config')

try {
    // create the mage client
    const client = new Mage(config)

    // register a guest user and join a game
    await client.user.register();

    const game = await client.game.join();
    doSomething(game);
} catch (error) {
    console.error(error);
}
```

## Configuration

You will need to extract your client configuration from your mage project, to do
so create a javascript file at the root of your project (ie. `config.js`) with
the following content:

```js
const mage = require('./lib');
console.log(JSON.stringify(mage.getClientConfig('api'), null, 4));
```

Then run it with node, a JSON object should get output in your console, this is
your node config and can be used to instanciate the `Mage` class.

It could for example be saved in a file called `config/production.js` in your
client project using this format:

```js
module.exports = {
    /* json configuration */
}
```

That way you can easily require it in your project.

## API

### Mage (EventEmitter)

When the mage client finish initializing, you should be able to run client.{module}.{command} for each
user command set on the server, those calls will return a promise.

**constructor(config: MageClientConfig)**

The Mage client config can be extracted from your server by running the command
described above.

*get* **archivist**

The archivist instance.

*get* **commands**

Returns the Command Center.

*get* **session**

Returns the current session.

*set* **session**

Sets the current session, must be a Session object.

*get* **stream**

Returns the message stream.

**close() -> void**

Closes all connections to the server.

**{module}.{command}(any ...params) -> Promise(any)**

Wrappers for `CommandCenter.send`.

### Archivist (EventEmitter)

*get* **cache**

Returns the underlying cache (defaults to Memory).

**exists(string topic, Object index[, Object options]) -> Promise(boolean)**

Checks if the given value exists.

**get(string topic, Object index[, Object options]) -> Promise(any)**

Retrieve a value from the server, unless cached locally.

**list(string topic, Object partialIndex[, Object options]) -> Promise(any[])**

List objects on the server using a partial index.

**mget(Object|Object[] queries[, Object options]) -> Promise(Object|any[])**

Run multiple gets on the server in one go.

*event* **{topic}(string operation, Object index[, any value])**

Whenether `set`, `applyDiff` or `del` operations are run, emit an event for the topic.

### CommandCenter

*set* **cookies**

Set a cookie jar for use with the command center.

**registerHook(string name, Function hook)**

Register a hook with the command center, when hooks are called they should return an object that will then be
set as a header to the current call.

**unregisterHook(string name)**

Remove a hook.

**send(string cmdName, any[] params) -> Promise(any)**

Call the command center, returns a promise and queue the command, the promise only resolves
once the queue goes through.

## License

MIT