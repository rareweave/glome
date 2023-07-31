let { fetchTxContent } = require("./utils.js")
module.exports.readUpTo = async (contractId, timestamp) => {
    console.log(global.servedContractsIds)
    if (!global.servedContractsIds.has(contractId)) {
        global.servedContractsIds.add(contractId)
        throw new UncacheableError("Put dependency contract (" + contractId + ") to loadlist")
    }
    let isExecuted = await databases.isExecuted.get(contractId);
    if (typeof isExecuted === "number") {
        if (isExecuted === 0) {
            let contractInstantiateTx = await databases.contracts.get(contractId)
            if (!contractInstantiateTx || contractInstantiateTx.timestamp <= timestamp) {
                throw new Error("No contract found")
            } else {
                return contractInstantiateTx.tags.find(tag => tag.name == "Init-State") ? JSON.parse(contractInstantiateTx.tags.find(tag => tag.name == "Init-State").value) : JSON.parse(await fetchTxContent(contractId))
            }
        } else {
            let bestMatch = null
            for await (let interaction of databases.interactions[contractId].getRange().map(({ value }) => (value)).filter(v => v.timestamp <= timestamp)) {
                if (interaction.timestamp >= (bestMatch?.timestamp || 0)) {
                    bestMatch = interaction
                }
            }
            if (!bestMatch) {
                let contractInstantiateTx = await databases.contracts.get(contractId)
                if (!contractInstantiateTx || contractInstantiateTx.timestamp <= timestamp) {
                    throw new Error("No contract found")
                } else {
                    return contractInstantiateTx.tags.find(tag => tag.name == "Init-State") ? JSON.parse(contractInstantiateTx.tags.find(tag => tag.name == "Init-State").value) : JSON.parse(await fetchTxContent(contractId))
                }
            } else {
                let bestMatchState = await databases.evaluationResults.get(contractId + bestMatch.id)
                return bestMatchState?.state
            }

        }
    } else {
        throw new UncacheableError("Contract isn't executed yet")
    }
}

class UncacheableError extends Error { constructor(message) { super(message); this.name = 'UncacheableError' } }