const { Client, initLogger } = require("@iota/client");

const SHIMMER_TESTNET_NODE = "https://api.testnet.shimmer.network";

// In this example we will get information about the node
async function run() {
    initLogger();

    // Node info
    const client = new Client({
        nodes: [SHIMMER_TESTNET_NODE],
        localPow: true,
    });

    try {
        const nodeInfo = await client.getInfo();
    } catch (error) {
        console.error("Error:", error);
    }

    // Generate a random BIP39 mnemonic for addresses (seed)
    const mnemonic = process.argv[2];
    console.log(mnemonic);

    console.log(await client.mnemonicToHexSeed(mnemonic));
}

run().then(() => process.exit());
