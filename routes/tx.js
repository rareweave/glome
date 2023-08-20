const fp = require('fastify-plugin')
let consola = require("consola")
const { $fetch } = require('ofetch')
const { DataItem } = require('arbundles')
const Arweave = require("arweave")
const arweave = Arweave.init({
    host: 'arweave.net',
    port: 443,
    protocol: 'https'
});
module.exports = fp(async function (app, opts) {
    app.post("/tx", async (req, resp) => {
        let bundlrResponse
        try {
            bundlrResponse = await (await $fetch.native(config.gateways.bundlrPost, {
                method: "POST",
                headers: {
                    "Content-Type": "application/octet-stream"
                },
                body: req.body
            })).json();
        } catch (e) {
            resp.status(400)
            return "Failed posting to bundlr"
        }
        let contracts = Array.from(servedContractsIds)
        if (!contracts) { return }
        for (let contract of contracts) {
            if (!databases.interactions[contract]) {
                databases.interactions[contract] = lmdb.open("./db/interactions/" + contract)
            }
        }

        if (bundlrResponse && bundlrResponse.id && bundlrResponse.timestamp) {

            let transaction = new DataItem(req.body)
            if (!transaction) { return }
            let content = Buffer.from(transaction.data, "base64")
            if (!content || !content.length) { return }
            try {
                transaction.address = await arweave.wallets.ownerToAddress(transaction.owner)
            } catch (e) {
                transaction.address = null

            }

            transaction = {
                id: transaction.id,
                address: transaction.address,
                owner: { address: transaction.address },
                tags: transaction.tags,
                quantity: { winston: "0" },
                fee: { winston: "0" },
                recipient: "",
                bundled: true,
                timestamp: bundlrResponse.timestamp
            }
            let belongingContracts = transaction.tags.filter(t => t.name == "Contract").filter(t => contracts.includes(t.value)).map(t => t.value)
            for (let contract of belongingContracts) {
                if (!await databases.interactions[contract].doesExist(transaction.id)) {
                    await databases.interactions[contract].put(transaction.id, transaction)
                    consola.info("[" + new Date(transaction.timestamp).toISOString().split("T").join(" ").split(".")[0] + "]", "Loaded bundled interaction " + transaction.id + " for contract " + contract)
                }
            }

            consola.info(`Loaded interaction ` + transaction.id + ` via QuickBroadcast, contracts affected: ` + belongingContracts + `, by: ` + transaction.address)
            return "OK"
        }
    })
})