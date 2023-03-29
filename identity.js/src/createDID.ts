import { Bip39, Bip32Path } from "@iota/crypto.js";
import {
    Bech32Helper,
    Ed25519Address,
    Ed25519Seed,
    ED25519_ADDRESS_TYPE,
    generateBip44Address,
} from "@iota/iota.js";
import { Converter, Base58 } from "@iota/util.js";

// const NODE_ENDPOINT = "http://localhost:9876";

const publicKeys: Uint8Array[] = [];
const privateKeys: Uint8Array[] = [];

const bech32Addresses: string[] = [];

async function run() {
    // This DID Document can also be created with the help of the IOTA Identity Library
    const did = {
        id: "did:0:0",
        verificationMethod: [{
            id: "did:0:0#sign-1",
            type: "Ed25519VerificationKey2018",
            controller: "did:0:0",
            publicKeyMultibase: ""
        }]
    }

    // From the menemonic a key pair
    // The account #0 will be controlling the DID
    // The account #1 will be the verification method
    // Write the key pairs to the std output
    const randomMnemonic = Bip39.randomMnemonic();
    console.log("\tMnemonic:", randomMnemonic);
    const baseSeed = Ed25519Seed.fromMnemonic(randomMnemonic);

    console.log();
    console.log("Generated Addresses using Bip44 Format");
    const addressGeneratorAccountState = {
        accountIndex: 0,
        addressIndex: 0,
        isInternal: false
    };

    for (let i = 0; i < 2; i++) {
        const path = generateBip44Address(addressGeneratorAccountState);

        console.log(`Address Index ${path}`);

        const addressSeed = baseSeed.generateSeedFromPath(new Bip32Path(path));
        const addressKeyPair = addressSeed.keyPair();

        publicKeys[i] = addressKeyPair.publicKey;
        privateKeys[i] = addressKeyPair.privateKey;

        console.log("\tPrivate Key", Converter.bytesToHex(addressKeyPair.privateKey, true));
        console.log("\tPublic Key", Converter.bytesToHex(addressKeyPair.publicKey, true));

        const indexEd25519Address = new Ed25519Address(addressKeyPair.publicKey);
        // Converting into bytes
        const indexPublicKeyAddress = indexEd25519Address.toAddress();
        console.log("\tAddress Ed25519", Converter.bytesToHex(indexPublicKeyAddress, true));
        bech32Addresses[i] = Bech32Helper.toBech32(ED25519_ADDRESS_TYPE, indexPublicKeyAddress, "tst");

        console.log("\tAddress Bech32", bech32Addresses[i]);
        console.log();
    }

    // Now converting the second private key into Base58 and multibase format and adding to the verification method
    did.verificationMethod[0].publicKeyMultibase = `z${Base58.encode(publicKeys[1])}`;

    console.log(JSON.stringify(did));

    // Posting data to the plugin
}

/*
async function postToPlugin(did: { [id: string]: unknown }) {
    
    const pluginRequest = {
        type: "DIDCreation",
        action: "Issue",
        doc: did,
        meta: {
            stateControllerAddress: bech32Addresses[0]
        }
    };
    
}
*/

export { };

run().then(() => console.log("Done")).catch(err => console.error(err));
