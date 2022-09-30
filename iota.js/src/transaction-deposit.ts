import { Blake2b, Ed25519 } from "@iota/crypto.js";
import {
    ADDRESS_UNLOCK_CONDITION_TYPE,
    BASIC_OUTPUT_TYPE,
    Bech32Helper,
    DEFAULT_PROTOCOL_VERSION,
    ED25519_ADDRESS_TYPE,
    ED25519_SIGNATURE_TYPE,
    IBasicOutput,
    IBlock,
    IndexerPluginClient, ITransactionEssence, ITransactionPayload, IUTXOInput, serializeTransactionEssence, SIGNATURE_UNLOCK_TYPE, SingleNodeClient, STORAGE_DEPOSIT_RETURN_UNLOCK_CONDITION_TYPE, TransactionHelper, TRANSACTION_ESSENCE_TYPE, TRANSACTION_PAYLOAD_TYPE, UnlockTypes
} from "@iota/iota.js";
import { NeonPowProvider } from "@iota/pow-neon.js";
// import { NodePowProvider } from "@iota/pow-node.js";
import { Converter, WriteStream } from "@iota/util.js";
import bigInt from "big-integer";

const API_ENDPOINT = "https://api.testnet.shimmer.network";

// Amount in glows
const amount = process.argv[2];
if (!amount) {
    console.error("Please provide an amount");
    process.exit(-1);
}

// Storage deposit 42600 glow
const STORAGE_DEPOSIT = 46800;

// This address has some tokens from the Faucet
const bech32AddressOrigin =      "rms1qr7ke3dtfwcasepx9fxsxeqfz35vnmqmt9drxry775c8wemtld9f6vjflfn";
const bech32AddressDestination = "rms1qpqrdquq8q984e0t8tj0s04rpz6jy6xt0zqkw3hxq7hztlmysjcrkvsnshz";

const publicKeyOriginHex  = "0xfb6305c2ed1120831395687d32d42ec4ba06419cf30725bf82743490fd099835";
const privateKeyOriginHex = "0x900ab3e9f9735543adcfcba1cfaf9a2d4645bde1b3306d3b3d50480945f1a051fb6305c2ed1120831395687d32d42ec4ba06419cf30725bf82743490fd099835";

const privateKeyOrigin = Converter.hexToBytes(privateKeyOriginHex);

async function run() {
    const client = new SingleNodeClient(API_ENDPOINT, { powProvider: new NeonPowProvider() });
    const indexerPlugin = new IndexerPluginClient(client);

    const protocolInfo = await client.protocolInfo();

    const outputs = await indexerPlugin.basicOutputs({
        addressBech32: bech32AddressOrigin,
        hasExpiration: false,
        hasTimelock: false,
        hasStorageDepositReturn: false
    });

    // The output we are going to use to transfer the funds
    const consumedOutputId = outputs.items[0];
    const consumedOutput = (await client.output(consumedOutputId)).output;

    // Prepare Inputs for the transaction
    const input: IUTXOInput = TransactionHelper.inputFromOutputId(consumedOutputId);
    console.log("Input: ", input, '\n');

    // ED25519 destination address
    const destAddress = Bech32Helper.fromBech32(bech32AddressDestination, "rms");
    if (!destAddress?.addressBytes) {
        console.error("Cannot convert destination address");
        return;
    }

    // ED25519 origin address
    const originAddress = Bech32Helper.fromBech32(bech32AddressOrigin, "rms");
    if (!originAddress?.addressBytes) {
        console.error("Cannot convert origin address");
        return;
    }

    // 0.05 Shimmies sent
    let amountAsNumber = Number.parseInt(amount);
    if (amountAsNumber < STORAGE_DEPOSIT) {
        amountAsNumber += STORAGE_DEPOSIT;
    }

    const amountToSend = bigInt(amountAsNumber);

    // Then create the new output
    const basicOutput: IBasicOutput = {
        type: BASIC_OUTPUT_TYPE,
        amount: amountToSend.toString(),
        nativeTokens: [],
        unlockConditions: [
            {
                type: ADDRESS_UNLOCK_CONDITION_TYPE,
                address: {
                    type: ED25519_ADDRESS_TYPE,
                    pubKeyHash: Converter.bytesToHex(destAddress.addressBytes, true)
                }
            },
            // If this output is unlocked then that amount will return to the origin addr
            {
                type: STORAGE_DEPOSIT_RETURN_UNLOCK_CONDITION_TYPE,
                returnAddress:  {
                    type: ED25519_ADDRESS_TYPE,
                    pubKeyHash: Converter.bytesToHex(originAddress.addressBytes, true)
                }, 
                amount: bigInt(STORAGE_DEPOSIT).toString()
            }
        ],
        features: []
    };

    // The remaining output remains in the origin address
    const remainderBasicOutput: IBasicOutput = {
        type: BASIC_OUTPUT_TYPE,
        amount: bigInt(consumedOutput.amount).minus(amountToSend).toString(),
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
    const inputsCommitment = TransactionHelper.getInputsCommitment([consumedOutput]);

    // 5.Create transaction essence
    const transactionEssence: ITransactionEssence = {
        type: TRANSACTION_ESSENCE_TYPE,
        networkId: protocolInfo.networkId,
        inputs: [input],
        inputsCommitment,
        outputs: [basicOutput, remainderBasicOutput],
        payload: undefined
    };

    const wsTsxEssence = new WriteStream();
    serializeTransactionEssence(wsTsxEssence, transactionEssence);
    const essenceFinal = wsTsxEssence.finalBytes();

    const essenceHash = Blake2b.sum256(essenceFinal);
    console.log("Essence Hash", essenceHash);

    console.log("Transaction Essence: ", transactionEssence);

    // Unlock conditions
    const unlockCondition: UnlockTypes = {
        type: SIGNATURE_UNLOCK_TYPE,
        signature: {
            type: ED25519_SIGNATURE_TYPE,
            publicKey: publicKeyOriginHex,
            signature: Converter.bytesToHex(Ed25519.sign(privateKeyOrigin, essenceHash), true)
        }
    };

    // Unlock conditions
    const unlockCondition2: UnlockTypes = {
        type: STORAGE_DEPOSIT_RETURN_UNLOCK_CONDITION_TYPE,
        reference: 890
    };

    // And now submitting a block with the transaction payload
    const transactionPayload: ITransactionPayload = {
        type: TRANSACTION_PAYLOAD_TYPE,
        essence: transactionEssence,
        unlocks: [unlockCondition]
    };
    console.log("Transaction payload: ", transactionPayload);

    const tips = await client.tips();

    // 8. Create Block
    const block: IBlock = {
        protocolVersion: DEFAULT_PROTOCOL_VERSION,
        parents: tips.tips,
        payload: transactionPayload,
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
