const { consola } = require('consola')
const fp = require('fastify-plugin')
let { quickExpressionFilter } = require("../utils.js")
module.exports = fp(async function (app, opts) {
    app.get("/all-contracts", async (req, resp) => {
        let contracts = await databases.contracts
            .getRange({ offset: req.query.offset || 0, limit: Math.min(req.query.limit || 300, 300) })
            .map(async c => {

                return { state: (await databases.evaluationResults.get(c?.value?.id + "latest"))?.state, id: c?.value?.id, creationTime: c?.value?.timestamp }
            }).filter(c => {
                if (req.query.filterScript) {
                    return quickExpressionFilter(Buffer.from(req.query.filterScript, "base64url").toString("utf-8"), c)
                } else {
                    return true
                }
            })
        let result = []
        for await (let contract of contracts) {
            result.push(contract)
        }
        if (req.query.sortScript) {
            result.sort((firstContract, secondContract) => {
                return quickExpressionFilter(Buffer.from(req.query.sortScript, "base64url").toString("utf-8"), { firstContract, secondContract })
            })
        }
        if (!result) {
            resp.status(404)
            return "Not found"
        } else {

            if (!req.query.expandStates) {

                return result.map(c => c.id)
            } else {
                return result
            }
        }
    })
})