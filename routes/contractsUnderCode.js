const { consola } = require('consola')
const fp = require('fastify-plugin')
let { quickExpressionFilter, properRange, quickSort } = require("../utils.js")
module.exports = fp(async function (app, opts) {
    app.post("/contracts-under-code/:codeIds", async (req, resp) => {

        let contracts = properRange(databases.contracts, [["filter", c => c && req.params.codeIds.split("|").includes(c.value.tags.find(tag => tag.name == "Contract-Src")?.value)], ["map", async c => {

            return { state: (await databases.evaluationResults.get(c?.value?.id + "latest"))?.state, id: c?.value?.id, creationTime: c?.value?.timestamp }
        }], ["filter", async c => {

            if (req?.body?.filterScript) {
                // console.log(req.query.filterScript, Buffer.from(req.query.filterScript, "base64").toString("utf-8"), quickExpressionFilter(Buffer.from(req.query.filterScript, "base64").toString("utf-8"), c))
                return await quickExpressionFilter(req?.body?.filterScript, { ...c, variables: req.body.variables })
            } else {
                return true
            }
        }]], req.query.offset || 0, Math.min(req.query.limit || 300, 300))

        let result = []
        for await (let contract of contracts) {
            result.push(contract)
        }
        if (req?.body?.sortScript) {
            result=await quickSort(result,async (firstContract, secondContract) => await quickExpressionFilter(req?.body?.sortScript, { firstContract, secondContract, variables: req.body.variables }, true))
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