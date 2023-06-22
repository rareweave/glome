const fp = require('fastify-plugin')
module.exports = fp(async function (app, opts) {
    app.get("/interactions/:contract", async (req, resp) => {
        let interactions = await databases.indexes.get(req.params.contract)
        if (!interactions) {
            resp.status(404)
            return "Not found"
        } else {
            return await databases.interactions[req.params.contract].getMany(interactions)
        }
    })
})