import { Blake2b, Ed25519 } from "@iota/crypto.js";
import {
    ADDRESS_UNLOCK_CONDITION_TYPE,
    ALIAS_OUTPUT_TYPE,
    BASIC_OUTPUT_TYPE,
    DEFAULT_PROTOCOL_VERSION,
    ED25519_ADDRESS_TYPE,
    ED25519_SIGNATURE_TYPE,
    GOVERNOR_ADDRESS_UNLOCK_CONDITION_TYPE,
    IAliasOutput,
    IBasicOutput,
    IBlock,
    ISignatureUnlock,
    ITransactionEssence,
    ITransactionPayload,
    IUTXOInput,
    serializeTransactionEssence,
    SIGNATURE_UNLOCK_TYPE,
    SingleNodeClient,
    STATE_CONTROLLER_ADDRESS_UNLOCK_CONDITION_TYPE,
    TransactionHelper,
    TRANSACTION_ESSENCE_TYPE,
    TRANSACTION_PAYLOAD_TYPE,
} from "@iota/iota.js";
import { NeonPowProvider } from "@iota/pow-neon.js";
import { Converter, WriteStream } from "@iota/util.js";
import bigInt from "big-integer";

const API_ENDPOINT = "https://api.testnet.shimmer.network";

// The aliasId on the Ledger 
const aliasId = process.argv[2];
if (!aliasId) {
    console.error("Please provide an alias Id to transition");
    process.exit(-1);
}

const stateIndexStr = process.argv[3];
if (!stateIndexStr) {
    console.error("Please provide an state index to transition");
    process.exit(-1);
}

const stateIndex = Number(stateIndexStr);

async function run() {
    const client = new SingleNodeClient(API_ENDPOINT, { powProvider: new NeonPowProvider() });
    const protocolInfo = await client.protocolInfo();

    const stateControllerPrivateKey = "";
    // Ed25519 Addresses (PubKeyHash)
    const stateControllerAddress = "0x647f7a9fd831c6e6034e7e5496a50aed17ef7d2add200bb4cfde7649ce2b0aaf";

    const governorAddress = "";

    const sourceAddressPublicKey = "";
    const sourceAddressPrivateKey = "";

    const inputs: IUTXOInput[] = [];

    const outputs: IAliasOutput[] = [];

    // The amount of funds tob e sent to an alias output
    const amountToSend = bigInt("60000");

    const consumedOutputDetails = await client.output("");

    // New output. Alias output. 
    const aliasOutput: IAliasOutput = {
        type: ALIAS_OUTPUT_TYPE,
        amount: amountToSend.toString(),
        aliasId,
        stateIndex,
        foundryCounter: 0,
        unlockConditions: [
            {
                type: STATE_CONTROLLER_ADDRESS_UNLOCK_CONDITION_TYPE,
                address: {
                    type: ED25519_ADDRESS_TYPE,
                    pubKeyHash: stateControllerAddress
                }
            },
            {
                type: GOVERNOR_ADDRESS_UNLOCK_CONDITION_TYPE,
                address: {
                    type: ED25519_ADDRESS_TYPE,
                    pubKeyHash: governorAddress
                }
            }
        ]
    };

    outputs.push(aliasOutput);

    // 4. Get inputs commitment
    const inputsCommitment = TransactionHelper.getInputsCommitment([consumedOutputDetails.output]);

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
    console.log("Block Id:", blockId);
}


run()
    .then(() => console.log("Done"))
    .catch(err => console.error(err));
