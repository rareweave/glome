let lmdb = require("lmdb")
let consola = require("consola")
let { ensureCodeAvailability, fetchTxContent, wait } = require("./utils.js")
let execute = require("./execute.js");
module.exports = async function executionSync() {
    await syncExecution()
    await wait(Math.max(servedContractsIds.size * 300, 20000))
    setInterval(syncExecution, 5000)
}
async function syncExecution() {
    for (contract of servedContractsIds) {
        if (!databases.interactions[contract]) {
            databases.interactions[contract] = lmdb.open("./db/interactions/" + contract)
        }
        await databases.indexes.put(contract, [...databases.interactions[contract].getRange().map(({ key, value }) => ({ id: value.id, timestamp: value.timestamp }))].sort((a, b) => a.timestamp - b.timestamp).map(i => i.id))
    }
    global.servedContractsIds.forEach(async contractId => {

        let contractInteractions = await databases.indexes.get(contractId)
        if (!contractInteractions) {
            consola.error(contractId, "No interactions in index")
            return
        }
        let amountOfInteractions = contractInteractions.length

        let isExecuted = await databases.isExecuted.get(contractId);
        if (typeof isExecuted === "number" && isExecuted == amountOfInteractions) {
            return
        }
        let contractInstantiateTx = await databases.contracts.get(contractId)
        // console.log(contractInstantiateTx, contractId)
        if (!contractInstantiateTx) { return }

        let interactionIndex = -1
        for (let interaction of contractInteractions) {
            if (!databases.interactions[contractId]) {
                databases.interactions[contractId] = databases.interactions[contractId] = lmdb.open("./db/interactions/" + contractId)
            }

            interaction = await databases.interactions[contractId].get(interaction)
            interactionIndex++
            let alreadyIndexed = await databases.evaluationResults.get(contractId + interactionIndex)
            if (alreadyIndexed && alreadyIndexed.id == interaction.id) {
                continue;
            }
            let state, contractSrc;

            if (interactionIndex == 0) {//We're syncing up from ground, need to download init state and init code

                try {
                    contractSrc = contractInstantiateTx.tags.find(tag => tag.name == "Contract-Src")?.value
                    state = contractInstantiateTx.tags.find(tag => tag.name == "Init-State") ? JSON.parse(contractInstantiateTx.tags.find(tag => tag.name == "Init-State").value) : JSON.parse(await fetchTxContent(contractId))

                } catch (e) {
                    return null
                }
            } else {
                state = (await databases.evaluationResults.get(contractId + (interactionIndex - 1))).state
                contractSrc = state.evolve ? state.evolve : (await databases.evaluationResults.get(contractId + (interactionIndex - 1))).contractSrc
            }

            await ensureCodeAvailability(contractSrc)
            // console.log(interaction)

            let newState;
            try {
                newState = await execute(contractSrc, state, interaction, contractInstantiateTx)
            } catch (e) {
                if (e.name == "UncacheableError") {
                    break;
                }
                consola.error("[" + contractId + "] (" + interaction.id + ")", e)
                // console.log(contractSrc, state, interaction, contractInstantiateTx)
                newState = state
            }
            await databases.evaluationResults.put(contractId + interactionIndex, {
                state: newState.state || state,
                contractSrc: contractSrc,
                id: interaction.id,
                timestamp: interaction.timestamp
            })
            await databases.evaluationResults.put(contractId + "latest", {
                state: newState.state || state,
                contractSrc: contractSrc,
                id: interaction.id,
                timestamp: interaction.timestamp
            })
            // console.log(newState)
        }
        if (amountOfInteractions === 0) {
            let state, contractSrc;

            try {
                contractSrc = contractInstantiateTx.tags.find(tag => tag.name == "Contract-Src")?.value
                state = contractInstantiateTx.tags.find(tag => tag.name == "Init-State") ? JSON.parse(contractInstantiateTx.tags.find(tag => tag.name == "Init-State").value) : JSON.parse(await fetchTxContent(contractId))

            } catch (e) {
                return null
            }

            await databases.evaluationResults.put(contractId + "latest", {
                state: state,
                contractSrc: contractSrc,
                id: "Init",
                timestamp: 0
            })
        }
        await databases.isExecuted.put(contractId, amountOfInteractions)
        consola.info("Executed contract " + contractId + ", " + amountOfInteractions + " interactions")
    })
}