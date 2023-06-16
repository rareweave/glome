const fp = require('fastify-plugin')
module.exports = fp(async function (app, opts) {
    app.get("/contracts-under-code/:codeId", async (req, resp) => {
        let interactions = await databases.indexes.get(req.params.contract)
        if (!interactions) {
            resp.status(404)
            return "Not found"
        } else {
            return await databases.interactions[contract].getMany(interactions)
        }
    })
})