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
    ISignatureUnlock,
    ITransactionEssence,
    ITransactionPayload,
    IUTXOInput,
    METADATA_FEATURE_TYPE,
    SENDER_FEATURE_TYPE,
    serializeTransactionEssence,
    SIGNATURE_UNLOCK_TYPE,
    SingleNodeClient,
    TAG_FEATURE_TYPE,
    TIMELOCK_UNLOCK_CONDITION_TYPE,
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
    const nodeInfo = await client.info();

    // For performing transactions
    const sourceAddress = "0x696cc8b1e0d2c1e29fbf3a4f491c0c9dc730c6e4c4e0d0ab6011e9f1209af013";
    const sourceAddressBech32 = "rms1qp5kej93urfvrc5lhuay7jgupjwuwvxxunzwp59tvqg7nufqntcpxp26uj8";
    const sourceAddressPublicKey = "0x5782872db1a2192748e4973a2571e7466d2ec26e54bb9859244f90a25c198eec";
    const sourceAddressPrivateKey = "0x003dd7e81dfd214e2a873322157aaa82a2db5a685a32720d65f2621fbffb67215782872db1a2192748e4973a2571e7466d2ec26e54bb9859244f90a25c198eec";

    const inputs: IUTXOInput[] = [];
    const outputs: IBasicOutput[] = [];

    const dataStored = {
        type: "Annotation",
        custodian: "C456789"
    };

    const tag = {
        asset: "A1111"
    };

    // New output
    const dataOutput: IBasicOutput = {
        type: BASIC_OUTPUT_TYPE,
        amount: "0",
        nativeTokens: [],
        unlockConditions: [
            {
                type: ADDRESS_UNLOCK_CONDITION_TYPE,
                address: {
                    type: ED25519_ADDRESS_TYPE,
                    pubKeyHash: sourceAddress
                }
            },
            {
                type: TIMELOCK_UNLOCK_CONDITION_TYPE,
                unixTime: 4294967295
            }
        ],
        features: [
            {
                type: SENDER_FEATURE_TYPE,
                address: {
                    type: ED25519_ADDRESS_TYPE,
                    pubKeyHash: sourceAddress
                }
            },
            {
                type: METADATA_FEATURE_TYPE,
                data: Converter.utf8ToHex(JSON.stringify(dataStored), true)
            },
            {
                type: TAG_FEATURE_TYPE,
                tag: Converter.utf8ToHex(JSON.stringify(tag), true)
            }
        ]
    };

    const outputStorageCost = bigInt(TransactionHelper.getStorageDeposit(dataOutput, nodeInfo.protocol.rentStructure));
    dataOutput.amount = outputStorageCost.toString();

    const indexerPlugin = new IndexerPluginClient(client);
    const outputList = await indexerPlugin.basicOutputs({
        addressBech32: sourceAddressBech32
    });


    let consumedOutputId;
    // Get the output to be consumed
    let consumedOutput: IBasicOutput | undefined;
    for (const output of outputList.items) {
        const outputData = await client.output(output);
        if (bigInt(outputData.output.amount).greater(outputStorageCost)) {
            consumedOutputId = output;
            consumedOutput = outputData.output as IBasicOutput;
        }
    }

    if (!consumedOutputId || !consumedOutput) {
        throw new Error("Output to cover sotrage costs not found");
    }

    console.log(consumedOutputId);

    inputs.push(TransactionHelper.inputFromOutputId(consumedOutputId));

    const totalFunds = bigInt(consumedOutput.amount);

    // The remaining output remains in the origin address
    const remainderBasicOutput: IBasicOutput = {
        type: BASIC_OUTPUT_TYPE,
        amount: totalFunds.minus(outputStorageCost).toString(),
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

    outputs.push(dataOutput);
    outputs.push(remainderBasicOutput);

    // 4. Get inputs commitment
    const inputsCommitment = TransactionHelper.getInputsCommitment([consumedOutput]);

    // 5.Create transaction essence
    const transactionEssence: ITransactionEssence = {
        type: TRANSACTION_ESSENCE_TYPE,
        networkId: TransactionHelper.networkIdFromNetworkName(nodeInfo.protocol.networkName),
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
