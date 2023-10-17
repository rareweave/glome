let { fetch } = require('ofetch')
let { blake3: hash } = require("hash-wasm")
const { LuaFactory } = require('wasmoon')
const similarityScore = require("string-similarity-js").stringSimilarity
const luaFactory = new LuaFactory()
const { consola } = require('consola')
const deasync = require('deasync')
module.exports.makeTxQueryHash = (min, tags, baseOnly) => {
  return hash(`query {
  transactions(sort:HEIGHT_ASC, first:100, block: { min:${min} },tags:[${tags.map(tag => (`{ name: "${tag[0]}", values: ${typeof tag[1] == 'string' ? '["' + tag[1] + '"]' : JSON.stringify(tag[1])} }`)).join("\n")}]${baseOnly ? ',bundledIn:null' : ''}) {
    pageInfo {
        hasNextPage
    }
    edges {
      cursor
      node {
        id
        tags {
          name
          value
        }
        owner {
          
          address
        }
        quantity{
          winston
        }
        recipient
        fee {
          winston
        }
        block {
          id
          height
          timestamp
        }
       
      }
    }
  }
}
`)
}
module.exports.makeBundlrQueryHash = (tags, gateway) => {
  return hash(`${gateway}query {
  transactions(limit:100,tags:[${tags.map(tag => (`{ name: "${tag[0]}", values: ${typeof tag[1] == 'string' ? '["' + tag[1] + '"]' : JSON.stringify(tag[1])} }`)).join("\n")}]) {
    pageInfo {
        hasNextPage
    }
    edges {
      cursor
      node {
        id
        tags {
          name
          value
        }
        address
        timestamp
      }
    }
  }
}
`)
}
module.exports.findTxQuery = (txId) => {

  // console.log(tags.map(tag => (`{ name: "${tag[0]}", values: ${typeof tag[1] == 'string' ? '["' + tag[1] + '"]' : JSON.stringify(tag[1])} }`)).join("\n"))
  return {
    body: JSON.stringify({
      query: `query {
  transactions(ids:["${txId}"]) {
    pageInfo {
        hasNextPage
    }
    edges {
      cursor
      node {
        id
        tags {
          name
          value
        }
        owner {
          
          address
        }
        quantity{
          winston
        }
        recipient
        fee {
          winston
        }
        block {
          id
          height
          timestamp
        }
       
      }
    }
  }
}
`}),
    method: "POST", headers: { "Content-type": "application/json" }
  }
}
module.exports.makeTxQuery = (min, tags, baseOnly, cursor) => {

  // console.log(tags.map(tag => (`{ name: "${tag[0]}", values: ${typeof tag[1] == 'string' ? '["' + tag[1] + '"]' : JSON.stringify(tag[1])} }`)).join("\n"))
  return {
    body: JSON.stringify({
      query: `query {
  transactions(${cursor ? 'after:"' + cursor + '",' : ''}sort:HEIGHT_ASC, first:100, block: { min:${Math.max(min,10)}},tags:[${tags.map(tag => (`{ name: "${tag[0]}", values: ${typeof tag[1] == 'string' ? '["' + tag[1] + '"]' : JSON.stringify(tag[1].length ? tag[1] : ["empty"])} }`)).join("\n")}]${baseOnly ? ',bundledIn:null' : ''}) {
    pageInfo {
        hasNextPage
    }
    edges {
      cursor
      node {
        id
        tags {
          name
          value
        }
        owner {
          
          address
        }
        quantity{
          winston
        }
        recipient
        fee {
          winston
        }
        block {
          id
          height
          timestamp
        }
       
      }
    }
  }
}
`}),
    method: "POST", headers: { "Content-type": "application/json" }
  }
}
module.exports.makeBundlrQuery = (tags, cursor) => {
  return {
    body: JSON.stringify({
      query: `query {
  transactions(${cursor ? 'after:"' + cursor + '",' : ''}limit:100,tags:[${tags.map(tag => (`{ name: "${tag[0]}", values: ${typeof tag[1] == 'string' ? '["' + tag[1] + '"]' : JSON.stringify(tag[1])} }`)).join("\n")}]) {
    pageInfo {
        hasNextPage
    }
    edges {
      cursor
      node {
        id
        tags {
          name
          value
        }
        address
        timestamp
      }
    }
  }
}
`}),
    method: "POST", headers: { "Content-type": "application/json" }
  }
}

module.exports.executeTxQuery = async function* (min, tags, baseOnly, cursor) {
  if (!cursor && cursor !== null) {
    cursor = await databases.cursors.get(await module.exports.makeTxQueryHash(min, tags, baseOnly))
  }
  let hasNextPage = true;

  while (hasNextPage) {
    let currentChunkResult = await fetch(config.gateways.arweaveGql, module.exports.makeTxQuery(min, tags, baseOnly, cursor)).catch(e => null).then(res => res ? res.json().catch(() => null) : null)
    if (!currentChunkResult) { continue }

    hasNextPage = currentChunkResult?.data?.transactions?.pageInfo?.hasNextPage
    if (tags.find(t => t[1].includes('3tq3vxELCAhRd2qWk8ux16SaRzuUWYpcSgx0b1fvJ88'))) { console.log(currentChunkResult?.data?.transactions?.edges) }
    if (currentChunkResult?.data?.transactions?.edges) {
      currentChunkResult.data.transactions.edges = currentChunkResult?.data?.transactions?.edges.filter(edge => edge?.node?.block?.height)
    }
    if (tags.find(t => t[1].includes('3tq3vxELCAhRd2qWk8ux16SaRzuUWYpcSgx0b1fvJ88'))) { console.log(currentChunkResult?.data?.transactions?.edges) }
    cursor = (currentChunkResult?.data?.transactions?.edges || []).at(-1)?.cursor || cursor
    let resultPart = currentChunkResult?.data?.transactions?.edges
    resultPart = (resultPart ? resultPart.map(edge => {
      if (baseOnly) {
        if (!edge?.node?.block?.height) {
          return null
        }
      }
      return { ...edge.node, address: edge.node.owner.address === "jnioZFibZSCcV8o-HkBXYPYEYNib4tqfexP0kCBXX_M" ? edge.node.tags.find(t => t.name == "Sequencer-Owner")?.value : edge.node.owner.address, owner: { address: edge.node.owner.address === "jnioZFibZSCcV8o-HkBXYPYEYNib4tqfexP0kCBXX_M" ? edge.node.tags.find(t => t.name == "Sequencer-Owner")?.value : edge.node.owner.address }, timestamp: edge.node.block.timestamp * 1000, bundled: false }
    }) : []).filter(rp => rp)
    if (tags.find(t => t[1].includes('3tq3vxELCAhRd2qWk8ux16SaRzuUWYpcSgx0b1fvJ88'))) {
      console.log(JSON.parse(module.exports.makeTxQuery(min, tags, baseOnly, cursor).body).query)
      console.log("resultPart", resultPart)
    }
    yield* resultPart
    await module.exports.wait(config.requestTimeout)
    await databases.cursors.put(await module.exports.makeTxQueryHash(min, tags, baseOnly), cursor)
  }

}
module.exports.findTxById = async function (txId) {
  let fromCache = await databases.transactions.get(txId)
  if (fromCache) { return fromCache }

  let fromGql = await fetch(config.gateways.arweaveGql, module.exports.findTxQuery(txId)).catch(e => null).then(res => res ? res.json() : null)
  fromGql = fromGql?.data?.transactions?.edges[0]
  if (fromGql) {
    fromGql.node.owner.address = fromGql.node.owner.address === "jnioZFibZSCcV8o-HkBXYPYEYNib4tqfexP0kCBXX_M" ? fromGql.node.tags.find(t => t.name == "Sequencer-Owner").value : (fromGql.node.address) || fromGql.node?.owner?.address
    await databases.transactions.put(txId, fromGql.node)
    return fromGql.node
  } else { return null }


}
module.exports.executeBundlrQuery = async function* (tags) {
  for (let bundlrGateway of config.gateways.bundlr) {
    let hasNextPage = true;

    let cursor = await databases.cursors.get(await module.exports.makeBundlrQueryHash(tags, bundlrGateway)) || null
    // console.log(cursor, await databases.cursors.get(module.exports.makeBundlrQueryHash(tags, bundlrGateway)))
    while (hasNextPage) {

      let currentChunkResult = await fetch(bundlrGateway, module.exports.makeBundlrQuery(tags, cursor)).catch(e => {
     
        console.error(e)
        return null
      }).then(res => res ? res.json() : null)
      hasNextPage = currentChunkResult?.data?.transactions?.pageInfo?.hasNextPage
      cursor = currentChunkResult?.data?.transactions?.edges?.at(-1)?.cursor || cursor
      let resultPart = currentChunkResult?.data?.transactions?.edges
      // console.log(currentChunkResult)
      // console.log(JSON.parse(module.exports.makeBundlrQuery(tags, cursor).body).query)
      resultPart = resultPart ? resultPart.map(edge => {
       
        return {
          ...edge.node,
          address: edge.node.address === "jnioZFibZSCcV8o-HkBXYPYEYNib4tqfexP0kCBXX_M" ? edge.node.tags.find(t => t.name == "Sequencer-Owner")?.value : edge.node.address,
          owner: { address: edge.node.address === "jnioZFibZSCcV8o-HkBXYPYEYNib4tqfexP0kCBXX_M" ? edge.node.tags.find(t => t.name == "Sequencer-Owner")?.value : edge.node.address },
          quantity: { winston: "0" },
          fee: { winston: "0" },
          recipient: "",
          block: { timestamp: Math.round(edge.node.timestamp / 1000) },
          bundled: true
        }
      }) : []

      yield* resultPart
      await module.exports.wait(config.requestTimeout)
      await databases.cursors.put(await module.exports.makeBundlrQueryHash(tags, bundlrGateway), cursor)
    }

  }
}
module.exports.fetchTxContent = async function (txId) {
  let fromCache = await databases.transactionsContents.get(txId)
  if (fromCache) { return fromCache }
  let fromGateway = await fetch(config.gateways.arweaveGateway + txId).catch(e => null).then(res => res ? res.text().catch(() => {
    consola.error(txId, "Failed to load", config.gateways.arweaveGateway + txId,)
    return null
  }) : null)
  if (fromGateway) {
    await databases.transactionsContents.put(txId, fromGateway)
    return fromGateway
  } else { return null }
}
module.exports.ensureCodeAvailability = async function (codeTxId) {
  if (!await databases.codes.doesExist(codeTxId)) {
    let codeTx = await module.exports.findTxById(codeTxId)

    let code = await module.exports.fetchTxContent(codeTxId)
    if (code && codeTx && codeTx?.tags?.find(t => t.name == "Content-Type")?.value) {
      await databases.contentTypes.put(codeTxId, codeTx?.tags?.find(t => t.name == "Content-Type")?.value)
      await databases.codes.put(codeTxId, code)
    }
  }
}
module.exports.wait = (ms) => {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}
module.exports.accessPropertyByPath = require("lodash.get")
let heap = {}
module.exports.quickExpressionFilter = async (expression, target) => {
  let isolate = await luaFactory.createEngine({ traceAllocations: true })
  isolate.global.setMemoryMax(2.56e+8)
  isolate.global.setTimeout(Date.now() + 2000)

  Object.entries(target).forEach(([k, v]) => {
    isolate.global.set(k, v)
  })
  isolate.global.set("similarityScore", (s1, s2) => {
    return similarityScore(s1, s2)
  }
  )
  isolate.global.set("includes", (s1, s2) => {
    return s1.includes(s2)
  })

  let res;
  try {
    res = await isolate.doString(expression)
  } catch (e) {
    console.error(e)
    res = null
  } finally {
    isolate.global.close()
  }
  return res
}

function JSONParseSafe(content) {
  if (typeof content == "string" && content.startsWith("¡")) {
    let clone = heap[content.slice(1)]
    delete heap[content.slice(1)]
    return clone
  }
  let result
  try {
    result = JSON.parse(content)
  } catch (e) {
    result = null
    return result
  }
  return result
}
module.exports.properRange = async function* properRange(db, transformations, startFrom, limit) {
  let count = 0
  let index = startFrom || 0
  let iterator = await db.getRange({ offset: startFrom || 0 })
  let lastItem = { done: false, value: null }
  itemsLoop: while (!lastItem.done) {
    lastItem = await iterator.next()
    index++
    let item = lastItem.value
    transformationsLoop: for await (let transformation of transformations) {
      if (transformation[0] == "map") {
        item = await transformation[1](item)
      } else if (transformation[0] == "filter") {

        let res;
        try {
          res = await transformation[1](item)
        } catch (e) {
          res = false
          continue itemsLoop;
        }
        if (!res) { continue itemsLoop; }
      }
    }
    yield ({ ...item, index })
    count++
    if (count >= limit) { break; }
  }

}

async function quickSort(arr, compare = async (a, b) => a - b) {
  if (arr.length <= 1) {
    return arr;
  }

  const pivot = arr[0];
  const left = [];
  const right = [];

  for (let i = 1; i < arr.length; i++) {
    if ((await compare(arr[i], pivot)) < 0) {
      left.push(arr[i]);
    } else {
      right.push(arr[i]);
    }
  }
  let ls = quicksort(left, compare)// we need to call it in parallel to achieve faster results
  let rs = quicksort(right, compare)
  return [
    ...(await ls),
    pivot,
    ...(await rs)
  ];
}
module.exports.quickSort = quickSort

module.exports.syncify = function syncify(O) {
  let mO;
  if (!O) { return O }
  if (!Array.isArray(O)) {
    mO = {}
    Object.keys(O).forEach(k => {
      if (typeof O[k] == 'function') {
        if (O[k].constructor.name === "AsyncFunction") {
        
         
          mO[k] = (...args) => {
            let done = false
            let returnValue=undefined
            O[k](...args).then((res) => {
              done = true
              returnValue=res
            }).catch(e => {
              done = true
              returnValue = e
            })
            deasync.loopWhile(()=>done)

          }
        } else {
          mO[k] = O[k]
        }

      } else if (typeof O[k] == "object") {
        mO[k] = syncify(O[k])
      } else {
        mO[k] = O[k]
      }
    })
  } else {
    mO = [];
    O.forEach((el, elIndex) => {
      if (typeof el == "function") {
        if (el.constructor.name === "AsyncFunction") {
          mO.push((...args) => {
            let done = false
            let returnValue = undefined
            (el(...args)).then((res) => {
              done = true
              returnValue = res
            }).catch(e => {
              done = true
              returnValue = e
            })
            deasync.loopWhile(() => done)

          })
          //    new ivm.Reference(async (...args) => { return new ivm.ExternalCopy(await O[k](...args)) })
        } else {
          mO.push(el)
        }

      } else if (typeof el == "object") {
        mO.push(syncify(el))
      } else {
        mO.push(el)
      }
    })
  }

  return mO
}