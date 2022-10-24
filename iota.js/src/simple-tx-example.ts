import { Bip32Path, Bip39, Blake2b, Ed25519 } from "@iota/crypto.js";
import {
    ADDRESS_UNLOCK_CONDITION_TYPE,
    BASIC_OUTPUT_TYPE,
    DEFAULT_PROTOCOL_VERSION,
    ED25519_ADDRESS_TYPE,
    ED25519_SIGNATURE_TYPE,
    IBasicOutput,
    IBlock,
    ISignatureUnlock,
    ITransactionEssence,
    ITransactionPayload,
    IUTXOInput,
    serializeTransactionEssence,
    SIGNATURE_UNLOCK_TYPE,
    SingleNodeClient,
    TransactionHelper,
    TRANSACTION_ESSENCE_TYPE,
    TRANSACTION_PAYLOAD_TYPE,
} from "@iota/iota.js";
import { Converter, WriteStream } from "@iota/util.js";
import bigInt from "big-integer";

const API_ENDPOINT = "https://api.testnet.shimmer.network";

async function run() {
    const client = new SingleNodeClient(API_ENDPOINT);
    const protocolInfo = await client.protocolInfo();

    // For performing transactions
    const sourceAddress = "0x696cc8b1e0d2c1e29fbf3a4f491c0c9dc730c6e4c4e0d0ab6011e9f1209af013";
    const destAddress = "0xbc9a935696546212c237e49e881fc6bdbd90bd0ec6140391982172f05a01b095";
    const sourceAddressPublicKey = "0x5782872db1a2192748e4973a2571e7466d2ec26e54bb9859244f90a25c198eec";
    const sourceAddressPrivateKey = "0x003dd7e81dfd214e2a873322157aaa82a2db5a685a32720d65f2621fbffb67215782872db1a2192748e4973a2571e7466d2ec26e54bb9859244f90a25c198eec";

    const consumedOutputId = "0xcba9a6616df8e8e323d8203ea5d1a42e2e7c64dc9ead6b59f5d26bdc301efa540000";
    const outputDetails = await client.output(consumedOutputId);
    const totalFunds = bigInt(outputDetails.output.amount);

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
        amount: totalFunds.minus(amountToSend).toString(),
        nativeTokens: [],
        unlockConditions: [
            {
                type: ADDRESS_UNLOCK_CONDITION_TYPE,
                address: {
                    type: ED25519_ADDRESS_TYPE,
                    pubKeyHash: sourceAddress
                }
            }
        ],
        features: []
    };

    outputs.push(basicOutput);
    outputs.push(remainderBasicOutput);

    // 4. Get inputs commitment
    const inputsCommitment = TransactionHelper.getInputsCommitment([outputDetails.output]);

    // 5.Create transaction essence
    const transactionEssence: ITransactionEssence = {
        type: TRANSACTION_ESSENCE_TYPE,
        networkId: protocolInfo.networkId,
        inputs,
        inputsCommitment,
        outputs
    };

    const wsTsxEssence = new WriteStream();
    serializeTransactionEssence(wsTsxEssence, transactionEssence);
    const essenceFinal = wsTsxEssence.finalBytes();

    const essenceHash = Blake2b.sum256(essenceFinal);
    console.log("Essence Hash", essenceHash);

    console.log("Transaction Essence: ", transactionEssence);

    // Main unlock condition 
    const unlockCondition: ISignatureUnlock = {
        type: SIGNATURE_UNLOCK_TYPE,
        signature: {
            type: ED25519_SIGNATURE_TYPE,
            publicKey: sourceAddressPublicKey,
            signature: Converter.bytesToHex(Ed25519.sign(Converter.hexToBytes(sourceAddressPrivateKey), essenceHash), true)
        }
    };

    const transactionPayload: ITransactionPayload = {
        type: TRANSACTION_PAYLOAD_TYPE,
        essence: transactionEssence,
        unlocks: [unlockCondition]
    };

     // Create Block
     const block: IBlock = {
        protocolVersion: DEFAULT_PROTOCOL_VERSION,
        parents: [],
        payload: transactionPayload,
        nonce: "0",
    };

    console.log("Calculating PoW, submitting block...");
    const blockId = await client.blockSubmit(block);

    console.log(blockId);
}


run()
    .then(() => console.log("Done"))
    .catch(err => console.error(err));
