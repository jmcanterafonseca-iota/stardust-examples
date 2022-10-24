import { Bip32Path, Bip39, Blake2b, Ed25519 } from "@iota/crypto.js";
import {
    ADDRESS_UNLOCK_CONDITION_TYPE,
    BASIC_OUTPUT_TYPE,
    Bech32Helper,
    Ed25519Address,
    Ed25519Seed,
    ED25519_ADDRESS_TYPE,
    ED25519_SIGNATURE_TYPE,
    generateBip44Address,
    IBasicOutput,
    IKeyPair,
    ITransactionEssence,
    IUTXOInput,
    serializeTransactionEssence,
    SIGNATURE_UNLOCK_TYPE,
    SingleNodeClient,
    TransactionHelper,
    TRANSACTION_ESSENCE_TYPE,
} from "@iota/iota.js";
import { Converter } from "@iota/util.js";
import bigInt from "big-integer";
import { WriteStream } from "fs";
import { stringify } from "querystring";

const API_ENDPOINT = "https://api.testnet.shimmer.network";

async function run() {
    const client = new SingleNodeClient(API_ENDPOINT);
    const protocolInfo = await client.protocolInfo();

    const destAddress = "0x";

    const sourceAddressPrivateKey = "0x";
    const outputID = "0xcba9a6616df8e8e323d8203ea5d1a42e2e7c64dc9ead6b59f5d26bdc301efa540000";

    const input 

    const inputs: IUTXOInput[] = [];
    const outputs: IBasicOutput[] = [];

    const amountToSend = bigInt("50000");

    // New output
    const basicOutput: IBasicOutput = {
        type: BASIC_OUTPUT_TYPE,
        amount: amountToSend.toString(),
        nativeTokens: [],
        unlockConditions: [
            {
                type: ADDRESS_UNLOCK_CONDITION_TYPE,
                address: {
                    type: ED25519_ADDRESS_TYPE,
                    pubKeyHash: destAddress
                }
            }
        ],
        features: []
    };

     // The remaining output remains in the origin address
     const remainderBasicOutput: IBasicOutput = {
        type: BASIC_OUTPUT_TYPE,
        amount: inputAmount.minus(amountToSend).toString(),
        nativeTokens: [],
        unlockConditions: [
            {
                type: ADDRESS_UNLOCK_CONDITION_TYPE,
                address: {
                    type: ED25519_ADDRESS_TYPE,
                    pubKeyHash: Converter.bytesToHex(originAddress.addressBytes, true)
                }
            }
        ],
        features: []
    };

    

    // 4. Get inputs commitment
    const inputsCommitment = TransactionHelper.getInputsCommitment(consumedOutputs);

    // 5.Create transaction essence
    const transactionEssence: ITransactionEssence = {
        type: TRANSACTION_ESSENCE_TYPE,
        networkId: protocolInfo.networkId,
        inputs,
        inputsCommitment,
        outputs: [basicOutput, remainderBasicOutput]
    };

    const wsTsxEssence = new WriteStream();
    serializeTransactionEssence(wsTsxEssence, transactionEssence);
    const essenceFinal = wsTsxEssence.finalBytes();

    const essenceHash = Blake2b.sum256(essenceFinal);
    console.log("Essence Hash", essenceHash);

    console.log("Transaction Essence: ", transactionEssence);

    const unlocks: UnlockTypes[] = [];

    // Main unlock condition 
    const unlockCondition: ISignatureUnlock = {
        type: SIGNATURE_UNLOCK_TYPE,
        signature: {
            type: ED25519_SIGNATURE_TYPE,
            publicKey: publicKeyOriginHex,
            signature: Converter.bytesToHex(Ed25519.sign(privateKeyOrigin, essenceHash), true)
        }
    };
}


run()
    .then(() => console.log("Done"))
    .catch(err => console.error(err));
