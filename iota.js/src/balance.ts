import {
    IndexerPluginClient, SingleNodeClient
} from "@iota/iota.js";
// import { NeonPowProvider } from "@iota/pow-neon.js";


const API_ENDPOINT = "https://api.testnet.shimmer.network";

// This address has some tokens from the Faucet
const bech32Address = process.argv[2];

if (!bech32Address) {
    console.error("Please provide a Bech32 address");
    process.exit(-1);
}

async function run() {
    const client = new SingleNodeClient(API_ENDPOINT, /* { powProvider: new NeonPowProvider() } */);
    const indexerPlugin = new IndexerPluginClient(client);

    const protocolInfo = await client.protocolInfo();

    const outputs = await indexerPlugin.basicOutputs({
        addressBech32: bech32Address,
        hasExpiration: false,
        hasTimelock: false,
        hasStorageDepositReturn: false
    });

    let counter = 0;
    for (const output of outputs.items) {
        const outputDetails = await client.output(output);
        console.log("Output: ", ++counter, "\n", outputDetails);
    }
}

run()
    .then(() => console.log("Done"))
    .catch(err => console.error(err));
