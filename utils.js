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
    let currentChunkResult = await fetch(config.gateways.arweaveGql, module.exports.makeTxQuery(min, tags, baseOnly, cursor)).then(res => res.json()).catch(e => null)
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

  let fromGql = await fetch(config.gateways.arweaveGql, module.exports.findTxQuery(txId)).then(res => res.json()).catch(e => null)
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

      let currentChunkResult = await fetch(bundlrGateway, module.exports.makeBundlrQuery(tags, cursor)).then(res => res.json()).catch(e => {
        // console.error(JSON.parse(module.exports.makeBundlrQuery(tags, cursor).body).query)
        console.error(e)
        return null
      })
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