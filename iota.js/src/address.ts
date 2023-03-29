import { Bip32Path, Bip39, Blake2b, Ed25519 } from "@iota/crypto.js";
import {
    Bech32Helper,
    Ed25519Address,
    Ed25519Seed,
    ED25519_ADDRESS_TYPE,
    generateBip44Address,
    SingleNodeClient,
} from "@iota/iota.js";
import { Converter } from "@iota/util.js";

// const API_ENDPOINT = "https://api.testnet.shimmer.network";
const API_ENDPOINT = "http://52.213.240.168:14265";

async function run() {
    const client = new SingleNodeClient(API_ENDPOINT);

    const info = await client.info();

    let randomMnemonic = process.argv[2];

    if (!randomMnemonic) {
        /* Generate a random mnemonic. */
        randomMnemonic = Bip39.randomMnemonic();
    }

    console.log("\tMnemonic:", randomMnemonic);

    // Generate the seed from the Mnemonic
    const baseSeed = Ed25519Seed.fromMnemonic(randomMnemonic);

    // Generate the next addresses for your account.
    console.log();
    console.log("Generated Addresses using Bip44 Format");
    const addressGeneratorAccountState = {
        accountIndex: 0,
        addressIndex: 0,
        isInternal: false
    };
    for (let i = 0; i < 6; i++) {
        const path = generateBip44Address(addressGeneratorAccountState);

        console.log(`Address Index ${path}`);

        const addressSeed = baseSeed.generateSeedFromPath(new Bip32Path(path));
        const addressKeyPair = addressSeed.keyPair();

        console.log("\tPrivate Key", Converter.bytesToHex(addressKeyPair.privateKey, true));
        console.log("\tPublic Key", Converter.bytesToHex(addressKeyPair.publicKey, true));

        const indexEd25519Address = new Ed25519Address(addressKeyPair.publicKey);
        // Converting into bytes
        const indexPublicKeyAddress = indexEd25519Address.toAddress();
        console.log("\tAddress Ed25519", Converter.bytesToHex(indexPublicKeyAddress, true));
        console.log(
            "\tAddress Bech32",
            Bech32Helper.toBech32(ED25519_ADDRESS_TYPE, indexPublicKeyAddress, "ebsi")
        );
        console.log();
    }

    console.log();
    console.log("Generated Addresses manually using Bip44 Format");
    console.log();
}

run()
    .then(() => console.log("Done"))
    .catch(err => console.error(err));
