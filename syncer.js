let { executeTxQuery, executeBundlrQuery, wait, makeBundlrQuery, findTxById } = require("./utils.js")
let consola = require("consola")
let startExecutionSyncLoop = require("./executionSync.js")
let lmdb = require("lmdb")
module.exports = async function startSyncLoop() {
    for await (let contract of (await executeTxQuery(0, [["Contract-Src", config.allowed.contractSourceIds], ["App-Name", ["SmartWeaveContract"]]], false, null))) {
        await databases.contracts.put(contract.id, contract)
        servedContractsIds.add(contract.id)
    }
    for (let contract of config.allowed.contractIds) {
        let contractTx = await findTxById(contract)
        await databases.contracts.put(contract, contractTx)
    }
    setInterval(async () => {
        for await (let contract of (await executeTxQuery(0, [["Contract-Src", config.allowed.contractSourceIds], ["App-Name", ["SmartWeaveContract"]]], false))) {
            await databases.contracts.put(contract.id, contract)
            servedContractsIds.add(contract.id)
        }
    }, 50000)
    consola.info("Serving " + servedContractsIds.size + " contracts");

    for (let contractIndex = 0; contractIndex <= Array.from(servedContractsIds).length; contractIndex += 4) {
        let contracts = Array.from(servedContractsIds).slice(contractIndex, contractIndex + 4)
        if (!contracts) {
            continue;
        }
        for (let contract of contracts) {
            if (!databases.interactions[contract]) {
                databases.interactions[contract] = lmdb.open("./db/interactions/" + contract)
            }
        }
        let bundledTransactions = (await executeBundlrQuery([["Contract", contracts], ["App-Name", ["SmartWeaveAction"]]]))
        let transactions = (await executeTxQuery(0, [["Contract", contracts], ["App-Name", ["SmartWeaveAction"]]], true))
        for await (let txForContract of bundledTransactions) {
            let belongingContracts = txForContract.tags.filter(t => t.name == "Contract").filter(t => contracts.includes(t.value)).map(t => t.value)
            for (let contract of belongingContracts) {
                if (!await databases.interactions[contract].doesExist(txForContract.id)) {
                    await databases.interactions[contract].put(txForContract.id, txForContract)
                    consola.info("[" + new Date(txForContract.timestamp).toISOString().split("T").join(" ").split(".")[0] + "]", "Loaded bundled interaction " + txForContract.id + " for contract " + contract)
                }
            }
        }
        for await (let txForContract of transactions) {
            let belongingContracts = txForContract.tags.filter(t => t.name == "Contract").filter(t => contracts.includes(t.value)).map(t => t.value)
            for (let contract of belongingContracts) {
                if (!await databases.interactions[contract].doesExist(txForContract.id)) {
                    await databases.interactions[contract].put(txForContract.id, txForContract)
                    consola.info("[" + new Date(txForContract.timestamp).toISOString().split("T").join(" ").split(".")[0] + "]", "Loaded base interaction " + txForContract.id + " for contract " + contract)
                }
            }
        }
        consola.success("Loaded contracts " + contracts.join(", "))
    }

    for (let contract of servedContractsIds) {

        if (!databases.interactions[contract]) {
            databases.interactions[contract] = lmdb.open("./db/interactions/" + contract)
        }
        await databases.indexes.put(contract, [...databases.interactions[contract].getRange().map(({ key, value }) => ({ id: value.id, timestamp: value.timestamp }))].sort((a, b) => a.timestamp - b.timestamp).map(i => i.id))
    }
    startExecutionSyncLoop()
    consola.success("Synced all contracts interactions")
    setInterval(async () => {
        for (let contractIndex = 0; contractIndex <= Array.from(servedContractsIds).length; contractIndex += 4) {
            let contracts = Array.from(servedContractsIds).slice(contractIndex, contractIndex + 4)
            if (!contracts) {
                continue;
            }
            for (let contract of contracts) {
                if (!databases.interactions[contract]) {
                    databases.interactions[contract] = lmdb.open("./db/interactions/" + contract)
                }
            }
            let bundledTransactions = (await executeBundlrQuery([["Contract", contracts], ["App-Name", ["SmartWeaveAction"]]]))
            let transactions = (await executeTxQuery(0, [["Contract", contracts], ["App-Name", ["SmartWeaveAction"]]], true))
            for await (let txForContract of bundledTransactions) {
                let belongingContracts = txForContract.tags.filter(t => t.name == "Contract").filter(t => contracts.includes(t.value)).map(t => t.value)
                for (let contract of belongingContracts) {
                    if (!await databases.interactions[contract].doesExist(txForContract.id)) {
                        await databases.interactions[contract].put(txForContract.id, txForContract)
                        consola.info("[" + new Date(txForContract.timestamp).toISOString().split("T").join(" ").split(".")[0] + "]", "Loaded bundled interaction " + txForContract.id + " for contract " + contract)
                    }
                }
            }
            for await (let txForContract of transactions) {
                let belongingContracts = txForContract.tags.filter(t => t.name == "Contract").filter(t => contracts.includes(t.value)).map(t => t.value)
                for (let contract of belongingContracts) {
                    if (!await databases.interactions[contract].doesExist(txForContract.id)) {
                        await databases.interactions[contract].put(txForContract.id, txForContract)
                        consola.info("[" + new Date(txForContract.timestamp).toISOString().split("T").join(" ").split(".")[0] + "]", "Loaded base interaction " + txForContract.id + " for contract " + contract)
                    }
                }
            }
        }
    }, Math.max(servedContractsIds.size * 300, 4000))

    setInterval(async () => {
        let contractIndex = 0
        for (contract of servedContractsIds) {
            contractIndex++
            if (!databases.interactions[contract]) {
                databases.interactions[contract] = lmdb.open("./db/interactions/" + contract)
            }
            await databases.indexes.put(contract, [...databases.interactions[contract].getRange().map(({ key, value }) => ({ id: value.id, timestamp: value.timestamp }))].sort((a, b) => a.timestamp - b.timestamp).map(i => i.id))
        }
    }, Math.max(servedContractsIds.size * 300, 4000))
}