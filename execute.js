const Arweave = require('arweave');
const Glomium=require("glomium")
const { LuaFactory } = require('glome-wasmoon')
let fs = require("fs");
const { wait,syncify } = require('./utils.js');

const luaFactory = new LuaFactory()
const executePromisifyWarmup = fs.readFileSync("./execute-promisify-warmup.js", "utf-8")
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
async function execute(codeId,state,interaction,contractInfo){
    let contractContentType=await global.databases.contentTypes.get(codeId);
    return await ((
        {
        "application/javascript":executeJS,
        "application/lua":executeLua,
        })[contractContentType](codeId,state,interaction,contractInfo))
}

async function executeLua(codeId,state,interaction,contractInfo){
    let notCache=false
   

    if (!executionContexts[contractInfo.id] || executionContexts[contractInfo.id].codeId != codeId) {
        let isolate = await luaFactory.createEngine({ traceAllocations: true })
    
        const arweave = Arweave.init({
            host: 'arweave.net',
            port: 443,
            protocol: 'https'
        });

        isolate.global.setMemoryMax(10e+8)
        isolate.global.setTimeout(Date.now() + 8000)
        isolate.global.set("console",console)
        isolate.global.set("print", console.log)
        console.log()
        // console.log("yield", isolate.global.lua.lua_yield(isolate.global.address,0))
        isolate.global.set("UncacheableError",(msg)=>{
            notCache=true;
            isolate.global.get("error")(msg)
        })
  
        let code = codeId == 'i6VO1Yw6bG1FdW0rH7m0tXvRKrtL7gNnd3o6SKQDg1A' ? fs.readFileSync("./contract-mock.lua", 'utf-8') : await databases.codes.get(codeId)
        executionContexts[contractInfo.id] = {
            codeId: codeId,
            script: code,
            arweaveClient: arweave,
            isolate: isolate,
            context: isolate
        }
    }

    executionContexts[contractInfo.id].isolate.global.set("SmartWeave", {
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
            readContractState: (id) => require("./reader-api.js").readUpTo(id, interaction.timestamp,(msg)=>{
                notCache=true;
                executionContexts[contractInfo.id].isolate.global.get("error")(msg)
            }),
            viewContractState: (id) => require("./reader-api.js").viewUpTo(id, interaction.timestamp,(msg)=>{
                notCache=true;
                executionContexts[contractInfo.id].isolate.global.get("error")(msg)
            })
        }, block: interaction.block ? { height: interaction.block.height, timestamp: interaction.block.timestamp, indep_hash: interaction.block.id } : null,//Maybe not mined yet
    
        arweave: {
            utils: executionContexts[contractInfo.id].arweaveClient.utils, crypto:executionContexts[contractInfo.id].arweaveClient.crypto, wallets: executionContexts[contractInfo.id].arweaveClient.wallets, ar: executionContexts[contractInfo.id].arweaveClient.ar
        },
        unsafeClient: executionContexts[contractInfo.id].arweaveClient

    })
    const execThread=executionContexts[contractInfo.id].isolate.global.newThread()
    await execThread.loadString(executionContexts[contractInfo.id].script)
await execThread.run()

    let handle = (...args) =>execThread.call('handle',...args)
    let contractCallIndex = interaction.tags.filter(tag => tag.name == "Contract").findIndex(tag => tag.value == contractInfo.id)
    let input = interaction.tags.filter(tag => tag.name == "Input")[contractCallIndex]?.value
    let action={ input: JSON.parse(input), caller: interaction.owner.address }

    let res
    try{
        res=await handle(state,action)
    }catch(e){
        if(notCache){
            throw new UncacheableError(e)
        } else {
            console.error(e)
            throw new Error(e)
        }
    }
    return res
}
async function runLuaFunction(main, co, funcName, args) {
    // Get the function from the main thread and move it to the coroutine's stack
    main.lua.lua_getglobal(main.address, funcName);
    main.lua.lua_xmove(main, co.address, 1);

    // Push the arguments for the function onto the coroutine's stack
    for (const arg of args) {
        co.pushValue(arg);
    }

    // Resume the coroutine, effectively running the function
    return await co.runSync(args.length);
}
async function executeJS(codeId, state, interaction, contractInfo) {

    if (!executionContexts[contractInfo.id] || executionContexts[contractInfo.id].codeId != codeId) {
        const vm = new Glomium(config.glomiumConfig)
        const arweave = Arweave.init({
            host: 'arweave.net',
            port: 443,
            protocol: 'https'
        });

        context.global.setSync('console', console);


       
        
        let code = await databases.codes.get(codeId)
        executionContexts[contractInfo.id] = {
            vm,
            codeId: codeId,
            code,
            arweaveClient: arweave,
        }
    }
  



   await executionContexts[contractInfo.id].vm.set("SmartWeave", {
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
    
        arweave: {
            utils: executionContexts[contractInfo.id].arweaveClient.utils, crypto:
            {
               hash: async (d,a)=>await executionContexts[contractInfo.id].arweaveClient.crypto.hash(new Uint8Array(d),a)
            }, wallets: executionContexts[contractInfo.id].arweaveClient.wallets, ar: executionContexts[contractInfo.id].arweaveClient.ar
        },
        unsafeClient: executionContexts[contractInfo.id].arweaveClient

    }, internals)

    
    await executionContexts[contractInfo.id].vm.run(executionContexts[contractInfo.id].code)
    let contractCallIndex = interaction.tags.filter(tag => tag.name == "Contract").findIndex(tag => tag.value == contractInfo.id)
    let input = interaction.tags.filter(tag => tag.name == "Input")[contractCallIndex]?.value
   
    return (await executionContexts[contractInfo.id].vm.get(`handle`))(state, { input: JSON.parse(input), caller: interaction.owner.address })
}
class UncacheableError extends Error { constructor(message) {this.name = 'UncacheableError'; super(message)} }
module.exports = execute