# Glome setup

Prerequisites: Node.js, yarn, open ports.

Firstly, clone glome repository:

```sh
cd ~/
git clone https://github.com/rareweave/glome glome
cd glome 
```

After you cloned repository, you need to install dependencies:

```sh
yarn # or npm install
```

Then create config, you can clone boilerplate from `config.json5.example`:

```sh
cp ./config.json5.example ./config.json5
```

Now you need to setup config. You can do it from any desired text editor: 
```sh
nano ./config.json5
```

You can see multiple parameters there. `port` is parameter responsible for on which port glome will expose its [HTTP api](./API.md).

`allowed` param is responsible for which contracts will glome sync. You can specify contract ids in `allowed.contractIds` or (and) you can specify code ids in `allowed.contractSourceIds`. This will automatically sync all contracts under specified code ids.

`arweaveConfig` is the param responsible for config passed to [arweave-js](https://github.com/ArweaveTeam/arweave-js) instance.

`gateways` is param responsible for gateways that Glome will use.
`gateways.bundlr` is array of Bundlr graphql endpoints. 
`gateways.arweaveGql` is Arweave GraphQL endpoint.
`gateways.arweaveGateway` is Arweave Gateway endpoint.

After configuring config, you can save config.json5 file and run Glome:

```sh
node index.js # If you want to use glome not for dev purposes but on your production environment, it's very good idea to configure it as a daemon or use process managing services like pm2 to run it in background 
```

It will show logs of synchronizing interactions, evaluating contracts, etc. 

Congratulations! You've just run your first glome node! You now can check [HTTP API](./API.md) to understand how to use Glome. 

Also check out [our discord server](https://discord.gg/2esZrmXsqs) if you experience some issues with Glome, or want to have deep dive in it, stay updated on its news.