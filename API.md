# Glome HTTP API

Let's assume `$nodeAddress` to be `http(https)://glome_node_ip:glome_node_port`
Typical `$nodeAddress` would look like: `https://1.2.3.4` or `http://1.2.3.4:1234`

## Endpoints

Fetch contract state:
``$nodeAddress/state/:contract_id``

Download all contract interactions:
``$nodeAddress/interactions/:contract_id``

Fetch contracts that have specified code ID:
``$nodeAddress/contracts-under-code/:code_id``

Query parameters:

`limit`:*Number* (0 < limit <= 300)

Limits how much contracts can be returned by endpoint. Defaults to 300.

`offset` *Number*

Offsets contracts returned by endpoint. Useful for pagination.

`expandStates`:*Boolean*
This param will expand contract states in response. If not provided, endpoint will return only contract IDs.

`filterScript`:*[FilterScript](#filterscript)* (base64url encoded)

`sortScript`:*[SortScript](#sortscript)* (base64url encoded)

Fetch all contracts that glome has:
``$nodeAddress/all-contracts``

Query parameters:

`limit`:*Number* (0 < limit <= 300)

Limits how much contracts can be returned by endpoint. Defaults to 300.

`offset` *Number*

Offsets contracts returned by endpoint. Useful for pagination.

`expandStates`:*Boolean*
This param will expand contract states in response. If not provided, endpoint will return only contract IDs.

`filterScript`:*[FilterScript](#filterscript)* (base64url encoded)

`sortScript`:*[SortScript](#sortscript)* (base64url encoded)

## API types

### FilterScript

FilterScript is a very simple filtering script that will allow you to filter out contracts by its state.

FilterScript looks like this: `state.something="test"&(state.number>10)`

It doesn't follow PEMDAS or other inexplicit order, however you can still use brackets for defining priority.

Note that it also doesn't follow it with operators like &, so you have to put expressions in brackets explicitly. 

We believe that explicitly defined order of operations is best for understanding.

Currently supported operators are: `&`, `|`, `⊕`, `=`, `>`, `<`, `≥`, `≤`, `+`, `-`, `/`, `*`, `~`, `!`, `⊂`

Context is contained of `state`, which is contract's state, and `contractId`, which is contract id.

Your FilterScript should return either `true` or `1` for contract to be included in query result.

### SortScript

SortScript is essentially same as FilterScript, but with different context.

Context for SortScript is `firstContract` and `secondContract`, which are object with fields `state` and `contractId`.

You should return `1` if `firstContract` should be before `secondContract` in query reply, `0` if it doesn't matter (will be returned depending on their position in database), `-1` if `secondContract` should be before `firstContract`. 

