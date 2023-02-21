import {
    DEFAULT_PROTOCOL_VERSION,
    IBlock,
    ITaggedDataPayload,
    SingleNodeClient,
    TAGGED_DATA_PAYLOAD_TYPE,
} from "@iota/iota.js";
import { NeonPowProvider } from "@iota/pow-neon.js";
import { Converter, WriteStream } from "@iota/util.js";

const API_ENDPOINT = "https://api.testnet.shimmer.network";

async function run() {
    const client = new SingleNodeClient(API_ENDPOINT, { powProvider: new NeonPowProvider() });
    const nodeInfo = await client.info();
   
    const dataStored = {
        type: "Annotation",
        custodian: "C456789"
    };

    const dataPayload: ITaggedDataPayload = {
        type: TAGGED_DATA_PAYLOAD_TYPE,
        tag: Converter.utf8ToHex("A1111", true),
        data: Converter.utf8ToHex(JSON.stringify(dataStored), true)
    };

    // Create Block
    const block: IBlock = {
        protocolVersion: DEFAULT_PROTOCOL_VERSION,
        parents: [],
        payload: dataPayload,
        nonce: "0",
    };

    console.log("Calculating PoW, submitting block...");
    const blockId = await client.blockSubmit(block);

    console.log(blockId);
}


run()
    .then(() => console.log("Done"))
    .catch(err => console.error(err));
