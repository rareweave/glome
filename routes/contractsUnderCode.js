const fp = require('fastify-plugin')
module.exports = fp(async function (app, opts) {
    app.get("/contracts-under-code/:codeId", async (req, resp) => {
        let contracts = await databases.contracts.getRange({ offset: req.query.offset || 0, limit: Math.min(req.query.limit || 300, 300) }).filter(c => c.value.tags.find(tag => tag.name == "Contract-Src").value == req.params.codeId).map(c => c.value.id)

        if (!contracts) {
            resp.status(404)
            return "Not found"
        } else {
            if (!req.query.expandStates) {
                return contracts
            } else {
                let evaluationResults = await databases.evaluationResults.getMany([...contracts.map(c => c + "latest")])
                return evaluationResults.map((er, contractIndex) => ({ state: er?.state, contractId: ([...contracts])[contractIndex] }))
            }
        }
    })
})