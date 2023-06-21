# Glome HTTP API

Let's assume `$nodeAddress` to be `http(https)://glome_node_ip:glome_node_port`
Typical `$nodeAddress` would look like: `https://1.2.3.4` or `http://1.2.3.4:1234`

Fetch contract state:
``$nodeAddress/state/:contract_id``

Download all contract interactions:
``$nodeAddress/interactions/:contract_id``

Fetch contracts that have specified code ID:
``$nodeAddress/contracts-under-code/:code_id``