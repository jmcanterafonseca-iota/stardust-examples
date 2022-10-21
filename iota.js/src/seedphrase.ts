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
    /* Generate a random mnemonic. */
    const randomMnemonic = Bip39.randomMnemonic();
    console.log("\tMnemonic:", randomMnemonic);

    const addressGeneratorAccountState = {
        accountIndex: 0,
        addressIndex: 0,
        isInternal: false
    };
    const paths: string[] = [];

    for (let i = 0; i < 6; i++) {
        const path = generateBip44Address(addressGeneratorAccountState);
        paths.push(path);

        console.log(`${path}`);
    }

    const baseSeed = Ed25519Seed.fromMnemonic(randomMnemonic);

    const keyPairs: IKeyPair[] = [];

    for (const path of paths) {
        const addressSeed = baseSeed.generateSeedFromPath(new Bip32Path(path));
        const addressKeyPair = addressSeed.keyPair();
        keyPairs.push(addressKeyPair);

        console.log(Converter.bytesToHex(addressKeyPair.privateKey, true));
        console.log(Converter.bytesToHex(addressKeyPair.publicKey, true));
    }

    const finalAddresses: { ed25519: string, bech32: string }[] = [];

    for (const keyPair of keyPairs) {
        const ed25519Address = new Ed25519Address(keyPair.publicKey);
        const publicKeyAddress = ed25519Address.toAddress();

        const bech32Addr = Bech32Helper.toBech32(ED25519_ADDRESS_TYPE, publicKeyAddress, "rms");

        const finalAddress = {
            ed25519: Converter.bytesToHex(publicKeyAddress, true),
            bech32: bech32Addr
        };

        finalAddresses.push(finalAddress);

        console.log(finalAddress);
    }
}

run()
    .then(() => console.log("Done"))
    .catch(err => console.error(err));
