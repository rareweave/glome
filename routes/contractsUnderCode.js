const fp = require('fastify-plugin')
module.exports = fp(async function (app, opts) {
    app.get("/contracts-under-code/:codeId", async (req, resp) => {
        let contracts = await databases.contracts.getRange().filter(c => c.tags.find(tag => tag.name == "Contract-Src").value == req.params.codeId).map(c => c.id)
        if (!contracts) {
            resp.status(404)
            return "Not found"
        } else {
            return contracts
        }
    })
})