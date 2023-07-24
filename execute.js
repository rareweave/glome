const Arweave = require('arweave');
const ivm = require('isolated-vm');
let fs = require("fs");
const { wait } = require('./utils.js');
const executePromisisfyWarmup = fs.readFileSync("./execute-promisify-warmup.js", "utf-8")
let executionContexts = {}
function callbackify(O, internals) {
    let mO;
    if (!O) { return O }
    if (!Array.isArray(O)) {
        mO = {}
        Object.keys(O).forEach(k => {
            if (typeof O[k] == 'function') {
                if (O[k].constructor.name === "AsyncFunction") {
                    let internalName = Date.now().toString(16) + (Math.random().toString(16).split(".")[1])
                    internals.setSync(internalName, new ivm.Callback((resolve, reject, args) => {
                        // console.log("hello");

                        (O[k](...args)).then(res => resolve.applyIgnored(undefined, [new ivm.ExternalCopy(res).copyInto()])).catch(e => reject.applyIgnored(undefined, [new ivm.ExternalCopy(e).copyInto()]))

                    }));
                    mO[k] = "glome-internal:" + internalName
                    //    new ivm.Reference(async (...args) => { return new ivm.ExternalCopy(await O[k](...args)) })
                } else {
                    mO[k] = new ivm.Callback((...args) => { return new ivm.ExternalCopy(O[k](...args)).copyInto() })
                }

            } else if (typeof O[k] == "object") {
                mO[k] = callbackify(O[k], internals)
            } else {
                mO[k] = O[k]
            }
        })
    } else {
        mO = [];
        O.forEach((el, elIndex) => {
            if (typeof el == "function") {
                if (el.constructor.name === "AsyncFunction") {
                    let internalName = Date.now().toString(16) + (Math.random().toString(16).split(".")[1])
                    internals.setSync(internalName, new ivm.Callback((resolve, reject, args) => {
                        // console.log("hello");

                        (el(...args)).then(res => resolve.applyIgnored(undefined, [new ivm.ExternalCopy(res).copyInto()])).catch(e => reject.applyIgnored(undefined, [new ivm.ExternalCopy(e).copyInto()]))

                    }));
                    mO.push("glome-internal:" + internalName)
                    //    new ivm.Reference(async (...args) => { return new ivm.ExternalCopy(await O[k](...args)) })
                } else {
                    mO.push(new ivm.Callback((...args) => { return new ivm.ExternalCopy(el(...args)).copyInto() }))
                }

            } else if (typeof el == "object") {
                mO.push(callbackify(el, internals))
            } else {
                mO.push(el)
            }
        })
    }

    return mO
}
function convertToRuntimePassable(O, internals) {

    return new ivm.ExternalCopy(callbackify(O, internals)).copyInto()
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


        // context.global.setSync("_slowTask",
        //     (arg, resolve, reject) => {
        //         console.log("hello")
        //         slowTask(arg).then(
        //             (value) => {

        //                 resolve.applyIgnored(undefined, [value])
        //             },
        //             (err) => reject.applyIgnored(undefined, [new ivm.ExternalCopy(err).copyInto()])
        //         )
        //         return undefined
        //     }
        // )
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
    let internals = new ivm.Reference({})

    executionContexts[contractInfo.id].context.global.setSync("internals", internals)
    executionContexts[contractInfo.id].context.global.setSync("SmartWeave", convertToRuntimePassable({
        extensions: global.plugins,
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

    }, internals))
    executionContexts[contractInfo.id].context.global.setSync("_ivm", ivm)
    executionContexts[contractInfo.id].context.evalSync(executePromisisfyWarmup)
    await executionContexts[contractInfo.id].script.run(executionContexts[contractInfo.id].context)
    executionContexts[contractInfo.id].context.global.setSync("__state", convertToRuntimePassable(state))
    let contractCallIndex = interaction.tags.filter(tag => tag.name == "Contract").findIndex(tag => tag.value == contractInfo.id)
    let input = interaction.tags.filter(tag => tag.name == "Input")[contractCallIndex]?.value
    executionContexts[contractInfo.id].context.global.setSync("__action", convertToRuntimePassable({ input: JSON.parse(input), caller: interaction.owner.address }))
    return (await executionContexts[contractInfo.id].context.evalSync(`handle(__state,__action)`, { promise: true, externalCopy: true })).copy()
}
module.exports = execute