# Glome

[Setup guide](./SETUP.md)

[Glome API](./API.md)

Glome is the effecient, performant, scalable and flexible smart contract engine/gateway for permanent interaction logs (primarily for Arweave and Bundlr). Brought to you by the [RareWeave](https://github.com/rareweave) team.

It follows the [SmartWeave protocol](https://github.com/ArweaveTeam/SmartWeave) and offers drop-in replacement for the original SmartWeave core.

Glome has several advantages over existing solutions like the [original SmartWeave](https://github.com/ArweaveTeam/SmartWeave), [3em](https://3em.exm.dev), [Warp contracts](https://warp.cc), [EXM](https://exm.dev).

Key differences:

- Performance
  Other solutions in most cases use [lazy evaluation](https://www.coindesk.com/tech/2020/06/11/with-arweaves-lazy-approach-to-smart-contracts-its-version-of-web3-does-more/), which is not very performance-friendly paradigm. 
  Arweave gateways offer amazing graphql interface, however due to size of the weave, indexing (as well as querying indexed data) is complex task that can not be performed instantly. 
  Sometimes it can take up to 7 seconds to perform single graphql query.
  The solution we came up to is quite simple: Download transactions and cache them, as well as their execution result.
  This solution came from us thinking of how blockchains are being built. 
  When we fetch user's balance on bitcoin network, we don't fetch all transactions related to his address from the genesis: Our bitcoin node already synchronized all the transactions and evaluated balances, so it can give you balance right away.
  That gave us a thought of a "SmartWeave node", that would cache interactions with contract, evaluate it, and allow querying already prepared result.
  Anybody still can install the smartweave node (glome), so it's not permissionful, but still gains performance boost.
- Scalability
  Some solutions, like [Warp](https://warp.cc) (sequencer/DRE) and [EXM](https://exm.dev) use the exact opposite to lazy evaluation pattern of evaluation, where their nodes sync all of the smartweave contracts and they keep track of every single contract. While this system has some advantages over lazy evaluation, it's not scalable. If you think of it, it's extremely cheap to deploy SmartWeave contract, and it means it results to heavier and heavier nodes.
  At the scale of millions of contracts, it will be practically impossible to run smartweave node that would execute every single smartweave contract (We still can split it for hundreds of nodes which will trust each other, but only few entities will be able to run it due to enormous operation cost).
  Glome is not the type of node that executes everything. You can configure which contracts it will execute (in config.json5), and its execution scope will be limited to that. 
  It ensures high horizontal scalability of Glome-run smart contracts, as each smart contract based service has to maintain own node and execute exclusively what it needs. 
- Decentralization
  Glome node (for any contract) can be run not only by smart contract dev, but by any user. In theory it's also possible for each user to run combination of light arweave node, light bundlr node, and glome. 
  This makes Glome fully permissionless and limits failure points to Arweave and Bundlr.

Glome is first node to use [Bundlr](https://bundlr.network) for instant transactions and its timestamping system for transactions ordering.
However, as glome is flexible, it allows disabling bundled interactions (or not bundled interactions).
You can do it by placing something like this in the start of your `handle()` function:

```js
ContractAssert(!SmartWeave.transaction.bundled,"No bundled transactions allowed")
```

Or disabling non-bundled transactions:

```js
ContractAssert(SmartWeave.transaction.bundled,"Only bundled transactions allowed")
```
There are several reasons for disabling either bundled or not bundled transactions ("Base transactions"). 
Main reason for disabling not bundled transactions can be probablistic PoW consensus (which means forkability of ledger) and slow 2 minute blocktime (compared to PoS networks and Bundlr, while for other PoW chains it can be considered fast).

This means you have to wait 8-15 blocks before being sure of contract's state when using base transactions, which can be frustrating user experience as it would mean user would have to wait ~20 minutes before being sure his interaction is fine.

Main reason for disabling bundled interactions and living with base-only transactions would be high decrease in Nakamoto coeffecient of your contracts.
It is so because at the moment of writing this doc (21.06.2023), Bundlr is **not** decentralized yet, meaning that your smart contract's Nakamoto coeffecient would equal to 1 if you choose to filter-out all base interactions and use only Bundlr as source of interactions load.

In future, it is going to change as Bundlr will transit to PoS-like network.
While this transition will most defenitely change Nakamoto coeffecient to some reasonable amount, PoS networks tend to be still much more centralized than PoW networks (Like Bitcoin or Arweave).
For comparison, the most decentralized PoS network as of moment of writing is Cardano, with Nakamoto coefficient of 35, while decentralization leader among PoW blockchains, Bitcoin, has 7000+.

To be fair, most of time you might not need such big Nakamoto coeffecient. Most of smart contracts operate on PoS blockchains at the moment of writing.
It would be reasonable to assume that if you run your smart contract Bundlr-only, it can be approximately compared by decentralization with contracts run on such PoS blockchains as Solana, Cardano, Ethereum, Polygon, etc.

However, in some cases, you might want full decentralization of Arweave network, which you can achieve by either blocking bundled interactions or combining interactions from both Arweave and Bundlr (but this variant requires deeper technical expertise in blockchains, finalization mechanisms, principles of how Arweave/Bundlr).

[Discord](https://discord.gg/2esZrmXsqs) [Twitter](https://twitter.com/rareweave) 
