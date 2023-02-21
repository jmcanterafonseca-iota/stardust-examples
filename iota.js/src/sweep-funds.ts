import { Blake2b, Ed25519 } from "@iota/crypto.js";
import {
    ADDRESS_UNLOCK_CONDITION_TYPE,
    BASIC_OUTPUT_TYPE,
    DEFAULT_PROTOCOL_VERSION,
    ED25519_ADDRESS_TYPE,
    ED25519_SIGNATURE_TYPE,
    IBasicOutput,
    IBlock,
    IndexerPluginClient,
    IReferenceUnlock,
    ISignatureUnlock,
    ITransactionEssence,
    ITransactionPayload,
    IUTXOInput,
    REFERENCE_UNLOCK_TYPE,
    serializeTransactionEssence,
    SIGNATURE_UNLOCK_TYPE,
    SingleNodeClient,
    TransactionHelper,
    TRANSACTION_ESSENCE_TYPE,
    TRANSACTION_PAYLOAD_TYPE,
} from "@iota/iota.js";
import { NeonPowProvider } from "@iota/pow-neon.js";
import { Converter, WriteStream } from "@iota/util.js";
import bigInt from "big-integer";

const API_ENDPOINT = "https://api.testnet.shimmer.network";

async function run() {
    const client = new SingleNodeClient(API_ENDPOINT, { powProvider: new NeonPowProvider() });
    const info = await client.info();

    // For performing transactions
    const sourceAddressBech32 = "rms1qpj8775lmqcudesrfel9f949ptk30mma9twjqza5el08vjww9v927ywt70u";
    const destAddress = "0x647f7a9fd831c6e6034e7e5496a50aed17ef7d2add200bb4cfde7649ce2b0aaf";
    const sourceAddressPublicKey = "0x55419a2a5a78703a31b00dc1d2c0c463df372728e4b36560ce6fd38255f05bfa";
    const sourceAddressPrivateKey = "0xa060fffb21412a1d1a1afee3e0f4a3ac152a0098bbf1c5096bfad72e45fa4e4455419a2a5a78703a31b00dc1d2c0c463df372728e4b36560ce6fd38255f05bfa";

    const inputs: IUTXOInput[] = [];
    const outputs: IBasicOutput[] = [];


    const indexerPlugin = new IndexerPluginClient(client);
    const outputList = await indexerPlugin.basicOutputs({
        addressBech32: sourceAddressBech32
    });

    const consumedOutputId1 = outputList.items[0];
    const consumedOutputId2 = outputList.items[1];

    inputs.push(TransactionHelper.inputFromOutputId(consumedOutputId1));
    inputs.push(TransactionHelper.inputFromOutputId(consumedOutputId2));

    const output1 = await client.output(consumedOutputId1);
    const output2 = await client.output(consumedOutputId2);

    // The two outputs are combined into only one output
    const amount1 = bigInt(output1.output.amount);
    const amount2 = bigInt(output2.output.amount);

    // New output
    const basicOutput: IBasicOutput = {
        type: BASIC_OUTPUT_TYPE,
        amount: amount1.add(amount2).toString(),
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

    outputs.push(basicOutput);

    // 4. Get inputs commitment
    const inputsCommitment = TransactionHelper.getInputsCommitment([output1.output, output2.output]);

    // 5.Create transaction essence
    const transactionEssence: ITransactionEssence = {
        type: TRANSACTION_ESSENCE_TYPE,
        networkId: TransactionHelper.networkIdFromNetworkName(info.protocol.networkName),
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
    const unlockCondition1: ISignatureUnlock = {
        type: SIGNATURE_UNLOCK_TYPE,
        signature: {
            type: ED25519_SIGNATURE_TYPE,
            publicKey: sourceAddressPublicKey,
            signature: Converter.bytesToHex(Ed25519.sign(Converter.hexToBytes(sourceAddressPrivateKey), essenceHash), true)
        }
    };

    const unlockCondition2: IReferenceUnlock = {
        type: REFERENCE_UNLOCK_TYPE,
        reference: 0
    };

    const transactionPayload: ITransactionPayload = {
        type: TRANSACTION_PAYLOAD_TYPE,
        essence: transactionEssence,
        unlocks: [unlockCondition1, unlockCondition2]
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
