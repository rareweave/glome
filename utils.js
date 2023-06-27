let { fetch } = require('ofetch')
let { hash } = require("blake3")
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
  transactions(${cursor ? 'after:"' + cursor + '",' : ''}sort:HEIGHT_ASC, first:100, block: { min:${min} },tags:[${tags.map(tag => (`{ name: "${tag[0]}", values: ${typeof tag[1] == 'string' ? '["' + tag[1] + '"]' : JSON.stringify(tag[1].length ? tag[1] : ["empty"])} }`)).join("\n")}]${baseOnly ? ',bundledIn:null' : ''}) {
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
    let currentChunkResult = await fetch(config.gateways.arweaveGql, module.exports.makeTxQuery(min, tags, baseOnly, cursor)).catch(e => null).then(res => res.json())
    hasNextPage = currentChunkResult?.data?.transactions?.pageInfo?.hasNextPage
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

  let fromGql = await fetch(config.gateways.arweaveGql, module.exports.findTxQuery(txId)).catch(e => null).then(res => res.json())
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
      }).then(res => res.json())
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
  let fromGateway = await fetch(config.gateways.arweaveGateway + txId).catch(e => null).then(res => res.text())
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

module.exports.quickExpressionFilter = (expression, target) => {
  let decodedExpression = Buffer.from(expression).toString("utf8")
  let decodedExpressionCopy = Buffer.from(expression).toString("utf8")

  let expressions = []
  let decodedExpressionArr = [...decodedExpression]
  let lastSave = 0
  let lBrackets = []
  for (let i = 0; i < decodedExpressionArr.length; i++) {
    let l = decodedExpressionArr[i]
    if (l == "(") {
      lBrackets.push(i)
    } else if (l == ")") {
      let indexes = [lBrackets.pop() + 1, i];
      let bracketContent = decodedExpressionCopy.slice(...indexes)
      decodedExpression = String(decodedExpression.slice(0, indexes[0] - 1) + module.exports.quickExpressionFilter(bracketContent, target) + decodedExpression.slice(indexes[1] + 1)).padEnd(indexes[1] - indexes[0], " ")
    }
  }
  let quoteActive = false
  for (let i = 0; i < decodedExpression.length; i++) {
    let l = decodedExpression[i]
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

    let c1Value = JSONParseSafe(c1) || module.exports.accessPropertyByPath(target, c1)
    let c2Value = JSONParseSafe(c2) || module.exports.accessPropertyByPath(target, c2)

    let finalValue = ({
      "&": () => (c1Value && c2Value) ? 1 : 0,
      "|": () => (c1Value || c2Value) ? 1 : 0,
      "⊕": () => ((c1Value && !c2Value) || (!c1Value && c2Value)) ? 1 : 0,
      "=": () => c1Value == c2Value ? 1 : 0,
      ">": () => c1Value > c2Value ? 1 : 0,
      "<": () => c1Value < c2Value ? 1 : 0,
      "≥": () => c1Value >= c2Value ? 1 : 0,
      "≤": () => c1Value <= c2Value ? 1 : 0,
      "+": () => c1Value + c2Value,
      "-": () => c1Value - c2Value,
      "!": () => c1Value == "#" ? (c2Value ? 0 : 1) : null,
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
  return expressions[0]

}

function JSONParseSafe(content) {
  let result
  try {
    result = JSON.parse(content)
  } catch (e) {
    result = null
    return result
  }
  return result
}