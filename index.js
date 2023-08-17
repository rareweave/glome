let lmdb = require("lmdb")
let JSON5 = require("json5")
let consola = require("consola")
let autoLoad = require("@fastify/autoload")
const app = require('fastify')({ logger: true })
let fs = require("fs")

global.config = JSON5.parse(fs.readFileSync("./config.json5", "utf8"))
global.databases = {
    codes: lmdb.open("./db/codes"),
    cursors: lmdb.open("./db/cursors"),
    contracts: lmdb.open("./db/contracts"),
    transactions: lmdb.open("./db/transactions"),
    transactionsContents: lmdb.open("./db/transactionsContents"),
    interactions: {},
    contentTypes: lmdb.open("./db/contentTypes"),
    evaluationResults: lmdb.open("./db/evaluationResults"),
    isExecuted: lmdb.open("./db/isExecuted"),
    indexes: lmdb.open("./db/indexes")
}
global.servedContractsIds = new Set(config.allowed.contractIds);
global.networkInfo = {}


let startSyncLoop = require("./syncer.js");

startSyncLoop()

const start = async () => {

    app.addHook("preHandler", (req, res, done) => {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Methods", "*");
        res.header("Access-Control-Allow-Headers", "*");
        const isPreflight = /options/i.test(req.method);
        if (isPreflight) {
            return res.send();
        }
        done()
    })
    app.addContentTypeParser('application/octet-stream', function (request, payload, done) {
        let data = Buffer.alloc(0)
        payload.on('data', chunk => {
            if (chunk.length + data.length >= 1e+8) {
                throw "Too big payload"
            }
            data = Buffer.concat([data, chunk])
        })
        payload.on('end', () => {
            done(null, data)
        })
    })
    app.register(autoLoad, {
        dir: require("path").join(__dirname, 'routes')
    })

    try {
        await app.listen({ port: config.port })
    } catch (err) {
        app.log.error(err)
        process.exit(1)
    }
}
start()
