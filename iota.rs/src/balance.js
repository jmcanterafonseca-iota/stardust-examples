const {
  Client,
  initLogger,
  CoinType,
  SHIMMER_TESTNET_BECH32_HRP,
} = require("@iota/client");

const SHIMMER_TESTNET_NODE = "https://api.testnet.shimmer.network";

// In this example we will get information about the node
async function run() {
  initLogger();

  // Node info
  const client = new Client({
    nodes: [SHIMMER_TESTNET_NODE],
    localPow: true,
  });

  // Get output ids of basic outputs that can be controlled by this address without further unlock constraints
  const outputIds = await client.basicOutputIds([
    {
      address:
        "rms1qzz5vsrj08afw7l8pd4es6u7mrx9ts6mech62y0mc6mqm7uyssh6jnqljf2",
    },
    { hasExpiration: false },
    { hasTimelock: false },
    { hasStorageDepositReturn: false },
  ]);
  console.log("Output ids: ", outputIds, "\n");

  const addressOutputs = await client.getOutputs(outputIds);
  console.log("Address outputs: ", JSON.stringify(addressOutputs));
}

run().then(() => process.exit());
