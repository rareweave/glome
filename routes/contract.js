const fp = require('fastify-plugin')
let { fetchTxContent } = require("../utils.js")
module.exports = fp(async function (app, opts) {
    app.get("/state/:contract", async (req, resp) => {
        let latestExecutionResult = await databases.evaluationResults.get(req.params.contract + "latest")
        if (latestExecutionResult) { return latestExecutionResult?.state } else {
            let contractInstantiateTx = await databases.contracts.get(req.params.contract)
            if (!contractInstantiateTx) {
                resp.status(404)
                return { error: "Not indexed" }
            } else {
                return contractInstantiateTx.tags.find(tag => tag.name == "Init-State") ? JSON.parse(contractInstantiateTx.tags.find(tag => tag.name == "Init-State").value) : JSON.parse(await fetchTxContent(contractId))
            }
        }
    })
})