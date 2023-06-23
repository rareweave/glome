const Arweave = require('arweave');
const ivm = require('isolated-vm');
let fs = require("fs")
let executionContexts = {}
function callbackify(O) {
    let mO;
    if (!O) { return O }
    if (!Array.isArray(O)) {
        mO = {}
        Object.keys(O).forEach(k => {
            if (typeof O[k] == 'function') {
                mO[k] = new ivm.Callback((...args) => { O[k](...args) })

            } else if (typeof O[k] == "object") {
                mO[k] = callbackify(O[k])
            } else {
                mO[k] = O[k]
            }
        })
    } else {
        mO = [];
        O.forEach((el, elIndex) => {
            if (typeof el == "function") {
                mO.push(new ivm.Callback((...args) => { el(...args) }))
            } else if (typeof el == "object") {
                mO.push(callbackify(el))
            } else {
                mO.push(el)
            }
        })
    }

    return mO
}
function convertToRuntimePassable(O) {

    return new ivm.ExternalCopy(callbackify(O)).copyInto()
}
async function execute(codeId, state, interaction, contractInfo) {
    if (!executionContexts[contractInfo.id] || executionContexts[contractInfo.id].codeId != codeId) {
        const isolate = new ivm.Isolate({ memoryLimit: 256 });
        const context = isolate.createContextSync();
        const arweave = Arweave.init({
            host: 'arweave.net',
            port: 443,
            protocol: 'https'
        });
        context.global.setSync("global", context.global.derefInto())
        context.global.setSync('console', convertToRuntimePassable(console));
        context.evalSync(`
        global.ContractError=class ContractError extends Error { constructor(message) { super(message); this.name = \'ContractError\' } };
        global.UncacheableError = class UncacheableError extends Error { constructor(message) { super(message); this.name = \'UncacheableError\' } };
        global.ContractAssert= function ContractAssert(cond, message) { if (!cond) throw new ContractError(message) };        
        `)
        let code = await databases.codes.get(codeId)
        let contractScript = isolate.compileScriptSync(code.split("export default").join("").split("export").join(""));
        executionContexts[contractInfo.id] = {
            codeId: codeId,
            script: contractScript,
            arweaveClient: arweave,
            isolate: isolate,
            context: context
        }
    }

    executionContexts[contractInfo.id].context.global.setSync("SmartWeave", convertToRuntimePassable({
        transaction: {
            bundled: interaction.bundled,
            timestamp: interaction.timestamp,
            id: interaction.id,
            owner: interaction.owner.address,
            tags: interaction.tags,
            quantity: interaction.quantity.winston,
            target: interaction.recipient,
            reward: interaction.fee.winston,
        }, contract: {
            id: contractInfo.id,
            owner: contractInfo.owner.address
        }, contracts: {
            readContractState: (id) => require("./reader-api.js").readUpTo(id, interaction.timestamp),
            viewContractState: (id) => require("./reader-api.js").viewUpTo(id, interaction.timestamp)
        }, block: interaction.block ? { height: interaction.block.height, timestamp: interaction.block.timestamp, indep_hash: interaction.block.id } : null,//Maybe not mined yet
        arweave: { utils: executionContexts[contractInfo.id].arweaveClient.utils, crypto: executionContexts[contractInfo.id].arweaveClient.crypto, wallets: executionContexts[contractInfo.id].arweaveClient.wallets, ar: executionContexts[contractInfo.id].arweaveClient.ar },
        unsafeClient: executionContexts[contractInfo.id].arweaveClient

    }))
    await executionContexts[contractInfo.id].script.run(executionContexts[contractInfo.id].context)
    executionContexts[contractInfo.id].context.global.setSync("__state", convertToRuntimePassable(state))
    let contractCallIndex = interaction.tags.filter(tag => tag.name == "Contract").findIndex(tag => tag.value == contractInfo.id)
    let input = interaction.tags.filter(tag => tag.name == "Input")[contractCallIndex]?.value
    executionContexts[contractInfo.id].context.global.setSync("__action", convertToRuntimePassable({ input: JSON.parse(input), caller: interaction.owner.address }))
    return (await executionContexts[contractInfo.id].context.evalSync(`handle(__state,__action)`, { promise: true, externalCopy: true })).copy()
}
module.exports = execute