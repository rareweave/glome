let { fetch } = require('ofetch')
let { hash } = require("blake3")
const { consola } = require('consola')
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
`).toString("base64url")
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
`).toString("base64url")
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
  transactions(${cursor ? 'after:"' + cursor + '",' : ''}sort:HEIGHT_ASC, first:100, block: { min:${min}},tags:[${tags.map(tag => (`{ name: "${tag[0]}", values: ${typeof tag[1] == 'string' ? '["' + tag[1] + '"]' : JSON.stringify(tag[1].length ? tag[1] : ["empty"])} }`)).join("\n")}]${baseOnly ? ',bundledIn:null' : ''}) {
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
    cursor = await databases.cursors.get(module.exports.makeTxQueryHash(min, tags, baseOnly))
  }
  let hasNextPage = true;

  while (hasNextPage) {
    let currentChunkResult = await fetch(config.gateways.arweaveGql, module.exports.makeTxQuery(min, tags, baseOnly, cursor)).catch(e => null).then(res => res ? res.json().catch(() => null) : null)
    if (!currentChunkResult) { continue }
    hasNextPage = currentChunkResult?.data?.transactions?.pageInfo?.hasNextPage
    if (currentChunkResult?.data?.transactions?.edges) {
      currentChunkResult.data.transactions.edges = currentChunkResult?.data?.transactions?.edges.filter(edge => edge?.node?.block?.height)
    }
    cursor = currentChunkResult?.data?.transactions?.edges?.at(-1)?.cursor || cursor
    let resultPart = currentChunkResult?.data?.transactions?.edges
    resultPart = resultPart ? resultPart.map(edge => {

      return { ...edge.node, address: edge.node.owner.address === "jnioZFibZSCcV8o-HkBXYPYEYNib4tqfexP0kCBXX_M" ? edge.node.tags.find(t => t.name == "Sequencer-Owner")?.value : edge.node.owner.address, owner: { address: edge.node.owner.address === "jnioZFibZSCcV8o-HkBXYPYEYNib4tqfexP0kCBXX_M" ? edge.node.tags.find(t => t.name == "Sequencer-Owner")?.value : edge.node.owner.address }, timestamp: edge.node.block.timestamp * 1000, bundled: false }
    }) : []

    yield* resultPart
    await module.exports.wait(config.requestTimeout)
    await databases.cursors.put(module.exports.makeTxQueryHash(min, tags, baseOnly), cursor)
  }

}
module.exports.findTxById = async function (txId) {
  let fromCache = await databases.transactions.get(txId)
  if (fromCache) { return fromCache }

  let fromGql = await fetch(config.gateways.arweaveGql, module.exports.findTxQuery(txId)).catch(e => null).then(res => res ? res.json() : null)
  fromGql = fromGql?.data?.transactions?.edges[0]
  if (fromGql) {
    fromGql.node.owner.address = fromGql.node.owner.address === "jnioZFibZSCcV8o-HkBXYPYEYNib4tqfexP0kCBXX_M" ? fromGql.node.tags.find(t => t.name == "Sequencer-Owner").value : fromGql.node.address
    await databases.transactions.put(txId, fromGql.node)
    return fromGql.node
  } else { return null }


}
module.exports.executeBundlrQuery = async function* (tags) {
  for (let bundlrGateway of config.gateways.bundlr) {
    let hasNextPage = true;

    let cursor = await databases.cursors.get(module.exports.makeBundlrQueryHash(tags, bundlrGateway)) || null
    // console.log(cursor, await databases.cursors.get(module.exports.makeBundlrQueryHash(tags, bundlrGateway)))
    while (hasNextPage) {

      let currentChunkResult = await fetch(bundlrGateway, module.exports.makeBundlrQuery(tags, cursor)).catch(e => {
        // console.error(JSON.parse(module.exports.makeBundlrQuery(tags, cursor).body).query)
        console.error(e)
        return null
      }).then(res => res ? res.json() : null)
      hasNextPage = currentChunkResult?.data?.transactions?.pageInfo?.hasNextPage
      cursor = currentChunkResult?.data?.transactions?.edges?.at(-1)?.cursor || cursor
      let resultPart = currentChunkResult?.data?.transactions?.edges
      // console.log(currentChunkResult)
      resultPart = resultPart ? resultPart.map(edge => {
        return { ...edge.node, address: edge.node.address === "jnioZFibZSCcV8o-HkBXYPYEYNib4tqfexP0kCBXX_M" ? edge.node.tags.find(t => t.name == "Sequencer-Owner")?.value : edge.node.address, owner: { address: edge.node.address === "jnioZFibZSCcV8o-HkBXYPYEYNib4tqfexP0kCBXX_M" ? edge.node.tags.find(t => t.name == "Sequencer-Owner")?.value : edge.node.address }, quantity: { winston: "0" }, fee: { winston: "0" }, recipient: "", block: { timestamp: Math.round(edge.node.timestamp / 1000) }, bundled: true }
      }) : []

      yield* resultPart
      await module.exports.wait(config.requestTimeout)
      await databases.cursors.put(module.exports.makeBundlrQueryHash(tags, bundlrGateway), cursor)
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
    let code = await module.exports.fetchTxContent(codeTxId)
    if (code) {
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
module.exports.quickExpressionFilter = (expression, target) => {

  let decodedExpression = Buffer.from(expression).toString("utf8")

  let expressions = []

  let lastSave = 0
  let lBrackets = []
  let quoteActive = false
  let lastQuote = null
  quoteSearchLoop: while (true) {

    for (let i = 0; i < decodedExpression.length; i++) {
      let l = decodedExpression.at(i)

      if (l == "\"") {
        if (lastQuote === null) {
          lastQuote = i
        } else {
          let heapVarName = "str" + i + "_" + lastQuote + Math.round(Math.random() * 100000000).toString("16") + Date.now()
          heap[heapVarName] = decodedExpression.slice(lastQuote + 1, i)
          decodedExpression = decodedExpression.slice(0, lastQuote) + ("¡" + heapVarName) + decodedExpression.slice(i + 1)

          lastQuote = null
          continue quoteSearchLoop;
        }

      }
    }
    break;
  }
  while (decodedExpression.split(")").length > 1) {

    for (let i = 0; i < decodedExpression.length; i++) {
      let l = decodedExpression.at(i)
      if (l == "(") {
        lBrackets.push(i)
      } else if (l == ")") {
        let indexes = [lBrackets.pop() + 1, i];
        let bracketContent = decodedExpression.slice(...indexes)

        let heapVarName = "bracket" + indexes[0] + "_" + indexes[1] + Math.round(Math.random() * 100000000).toString("16") + Date.now()
        heap[heapVarName] = module.exports.quickExpressionFilter(bracketContent, target)
        decodedExpression = decodedExpression.slice(0, indexes[0] - 1)
          + "¡" + heapVarName
          + decodedExpression.slice(Math.min(decodedExpression.length, (indexes[0] - 1)
            + bracketContent.length + 2))

        break
      }
    }
  }


  for (let i = 0; i < decodedExpression.length; i++) {
    let l = decodedExpression.at(i)
    if (l == "\"") {
      quoteActive = !quoteActive
    }
    if (["&", "|", "⊕", "=", ">", "<", "≥", "≤", "+", "-", "/", "*", "~", "!", "⊂"].includes(l) && !quoteActive) {
      expressions.push(decodedExpression.slice(lastSave, i))
      expressions.push(l)
      lastSave = i + 1
    }

  }
  expressions.push(decodedExpression.slice(lastSave))

  while (expressions.length > 1) {
    let c1 = typeof expressions[0] == "string" ? expressions[0].trim() : expressions[0]
    let op = typeof expressions[1] == "string" ? expressions[1].trim() : expressions[1]
    let c2 = typeof expressions[2] == "string" ? expressions[2].trim() : expressions[2]

    if (!c1 || !op || !c2 || !["&", "|", "⊕", "=", ">", "<", "≥", "≤", "+", "-", "/", "*", "~", "!", "⊂"].includes(op)) { return false }

    let c1Value = JSONParseSafe(c1)
    let c2Value = JSONParseSafe(c2)
    c1Value = c1Value === null ? module.exports.accessPropertyByPath(target, c1) : c1Value
    c2Value = c2Value === null ? module.exports.accessPropertyByPath(target, c2) : c2Value

    let functions = {
      type: (value) => typeof value,
      not: (value) => !value ? 1 : 0,
      len: (value) => {

        return value?.length
      }
    }

    let finalValue = ({
      "&": () => (c1Value && c2Value) ? 1 : 0,
      "|": () => (c1Value || c2Value) ? 1 : 0,
      "⊕": () => ((c1Value && !c2Value) || (!c1Value && c2Value)) ? 1 : 0,
      "=": () => c1Value == c2Value ? 1 : 0,
      ">": () => {

        return c1Value > c2Value ? 1 : 0
      },
      "<": () => c1Value < c2Value ? 1 : 0,
      "≥": () => c1Value >= c2Value ? 1 : 0,
      "≤": () => c1Value <= c2Value ? 1 : 0,
      "+": () => c1Value + c2Value,
      "-": () => c1Value - c2Value,
      "!": () => {
        if (functions[c1Value]) {

          let heapVarName = "f_call" + Math.round(Math.random() * 100000000).toString("16") + Date.now()
          heap[heapVarName] = functions[c1Value](c2Value)
          return "¡" + heapVarName
        } else { return null }
      },//! is not "not" but function call
      "*": () => c1Value * c2Value,
      "/": () => c1Value / c2Value,
      "~": () => {
        if (typeof c2Value == "string") {
          return c2Value.split(c1Value).length > 1 ? 1 : 0
        } else if (typeof c2Value == "number") {
          return Math.abs(c2Value - c1Value) < (c2Value * 0.05) ? 1 : 0
        }
      },

      "⊂": () => {
        if (!Array.isArray(c2Value)) {
          return 0;
        }
        if (c2Value.includes(c1Value)) {
          return 1
        } else { return 0 }
      }
    })[op]
    expressions = [finalValue ? finalValue() : null, ...expressions.slice(3)]

  }
  let finalRes = JSONParseSafe(expressions[0])
  return finalRes === null ? expressions[0] : finalRes

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
        if (!await transformation[1](item)) { continue itemsLoop; }
      }
    }
    yield ({ ...item, index })
    count++
    if (count >= limit) { break; }
  }

}

async function paraSort(elements, compareFn) {
  let cookedComparisons = {}
  await Promise.all(elements.map(async (e, ei) => {
    await Promise.all(elements.map(async (se, sei) => {
      if (sei == ei) { return }
      let key = [ei, sei].sort().join("-")
      cookedComparisons[key] = cookedComparisons[key] || await compareFn(e, se)
    }))
  }))
  return ([...Array(elements.length).keys()]).sort((ei, sei) => {
    return cookedComparisons[[ei, sei].sort().join("-")]
  }).map(i => elements[i])


}
module.exports.paraSort = paraSort