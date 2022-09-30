import {
    DEFAULT_PROTOCOL_VERSION,
    IBlock,
    ITaggedDataPayload, SingleNodeClient, TAGGED_DATA_PAYLOAD_TYPE
} from "@iota/iota.js";
// import { NodePowProvider } from "@iota/pow-node.js";
import { NeonPowProvider } from "@iota/pow-neon.js";

import { Converter } from "@iota/util.js";


const API_ENDPOINT = "https://api.testnet.shimmer.network";

// This address has some tokens from the Faucet
const data = process.argv[2];

if (!data) {
    console.error("Please provide Data");
    process.exit(-1);
}

async function run() {
    const client = new SingleNodeClient(API_ENDPOINT, { powProvider: new NeonPowProvider() } );

    // And now submitting a block with the transaction payload
    const dataPayload: ITaggedDataPayload = {
        type: TAGGED_DATA_PAYLOAD_TYPE,
        tag: Converter.utf8ToHex("JMCF", true),
        data: Converter.utf8ToHex(data, true),
    };

    // const tips = await client.tips();

    // 8. Create Block
    const block: IBlock = {
        protocolVersion: DEFAULT_PROTOCOL_VERSION,
        parents: [],
        payload: dataPayload,
        nonce: "0",
    };
    console.log("Block: ", block);

    // 9. Submit block with pow
    console.log("Calculating PoW, submitting block...");
    const blockId = await client.blockSubmit(block);
    console.log("Submitted blockId is: ", blockId);
}

run()
    .then(() => console.log("Done"))
    .catch(err => console.error(err));
