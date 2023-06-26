const fp = require('fastify-plugin')
let { fetchTxContent } = require("../utils.js")
module.exports = fp(async function (app, opts) {
    app.get("/info", async (req, resp) => {
        if (global.networkInfo) {
            return global.networkInfo
        } else {
            return { error: "Network info isn't synced yet" }
        }
    })
})