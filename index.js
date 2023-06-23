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
    evaluationResults: lmdb.open("./db/evaluationResults"),
    isExecuted: lmdb.open("./db/isExecuted"),
    indexes: lmdb.open("./db/indexes")
}
global.servedContractsIds = new Set(config.allowed.contractIds);


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
