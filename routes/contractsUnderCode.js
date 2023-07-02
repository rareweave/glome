const { consola } = require('consola')
const fp = require('fastify-plugin')
let { quickExpressionFilter, properRange } = require("../utils.js")
module.exports = fp(async function (app, opts) {
    app.post("/contracts-under-code/:codeId", async (req, resp) => {

        let contracts = properRange(databases.contracts, [["filter", c => c && c.value.tags.find(tag => tag.name == "Contract-Src")?.value == req.params.codeId], ["map", async c => {

            return { state: (await databases.evaluationResults.get(c?.value?.id + "latest"))?.state, id: c?.value?.id, creationTime: c?.value?.timestamp }
        }], ["filter", c => {

            if (req?.body?.filterScript) {
                // console.log(req.query.filterScript, Buffer.from(req.query.filterScript, "base64").toString("utf-8"), quickExpressionFilter(Buffer.from(req.query.filterScript, "base64").toString("utf-8"), c))
                return quickExpressionFilter(req?.body?.filterScript, { ...c, variables: req.body.variables })
            } else {
                return true
            }
        }]], req.query.offset || 0, Math.min(req.query.limit || 300, 300))

        let result = []
        for await (let contract of contracts) {
            result.push(contract)
        }
        if (req?.body?.sortScript) {
            result.sort((firstContract, secondContract) => {
                // console.log(quickExpressionFilter(Buffer.from(req.query.sortScript, "base64url").toString("utf-8"), { firstContract, secondContract }))

                return quickExpressionFilter(req?.body?.sortScript, { firstContract, secondContract, variables: req.body.variables }, true)
            })
        }
        if (!result) {
            resp.status(404)
            return { error: "Not indexed" }
        } else {

            if (!req.query.expandStates) {

                return result.map(c => c.id)
            } else {
                return result
            }
        }
    })
})