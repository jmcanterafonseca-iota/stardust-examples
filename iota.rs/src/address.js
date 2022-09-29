const { Client, initLogger, CoinType, SHIMMER_TESTNET_BECH32_HRP } = require("@iota/client");

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
        console.log(nodeInfo);
    } catch (error) {
        console.error("Error:", error);
    }

    // Generate a random BIP39 mnemonic for addresses (seed)
    const mnemonic = await client.generateMnemonic();
    console.log(mnemonic);

    const secretManager = {
        Mnemonic: mnemonic,
    };

     // Generate addresses with providing all inputs, that way it can also be done offline without a node.
     const addresses = await client.generateAddresses(
        secretManager,
        {
            coinType: CoinType.Shimmer,
            accountIndex: 0,
            range: {
                start: 0,
                end: 10,
            },
            internal: false,
            // Generating addresses with client.generateAddresses(secretManager, {}), will by default get the bech32_hrp (Bech32
            // human readable part) from the node info, generating it "offline" requires setting it in the generateAddressesOptions
            bech32Hrp: SHIMMER_TESTNET_BECH32_HRP,
        },
    );
    console.log(
        'List of offline generated public addresses:',
        addresses,
    );

    client.mnemonicToHexSeed(mnemonic);
}

run().then(() => process.exit());
