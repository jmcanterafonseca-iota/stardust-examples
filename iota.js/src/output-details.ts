import { Bip32Path, Bip39, Blake2b, Ed25519 } from "@iota/crypto.js";
import {
    Bech32Helper,
    Ed25519Address,
    Ed25519Seed,
    ED25519_ADDRESS_TYPE,
    generateBip44Address,
    IKeyPair,
    SingleNodeClient,
} from "@iota/iota.js";
import { Converter } from "@iota/util.js";
import { stringify } from "querystring";

const API_ENDPOINT = "https://api.testnet.shimmer.network";

async function run() {
    const client = new SingleNodeClient(API_ENDPOINT);
    const protocolInfo = await client.protocolInfo();
    console.log(protocolInfo);

    const outputID = "0xcba9a6616df8e8e323d8203ea5d1a42e2e7c64dc9ead6b59f5d26bdc301efa540000";
    const outputDetails = await client.output(outputID);
    console.log(JSON.stringify(outputDetails));
}


run()
    .then(() => console.log("Done"))
    .catch(err => console.error(err));
