import { Blake2b, Ed25519 } from "@iota/crypto.js";
import {
    ADDRESS_UNLOCK_CONDITION_TYPE,
    DEFAULT_PROTOCOL_VERSION,
    ED25519_ADDRESS_TYPE,
    ED25519_SIGNATURE_TYPE,
    IBlock,
    IndexerPluginClient,
    INftOutput,
    ISignatureUnlock,
    ITransactionEssence,
    ITransactionPayload,
    IUTXOInput,
    SIGNATURE_UNLOCK_TYPE,
    SingleNodeClient,
    STORAGE_DEPOSIT_RETURN_UNLOCK_CONDITION_TYPE,
    TransactionHelper,
    TRANSACTION_ESSENCE_TYPE,
    TRANSACTION_PAYLOAD_TYPE,
} from "@iota/iota.js";
import { NeonPowProvider } from "@iota/pow-neon.js";
import { Converter, WriteStream } from "@iota/util.js";

const API_ENDPOINT = "https://api.testnet.shimmer.network";

// The aliasId on the Ledger 
const nftId = process.argv[2];
if (!nftId) {
    console.error("Please provide an NFT ID to perform transition");
    process.exit(-1);
}

async function run() {
    const client = new SingleNodeClient(API_ENDPOINT, { powProvider: new NeonPowProvider() });
    const nodeInfo = await client.info();

    const nftOwnerAddr = "";
    const nftOwnerPubKey = "";
    const nftOwnerPrivateKey = "";

    const nftBuyerAddr = "";

    const inputs: IUTXOInput[] = [];
    const outputs: INftOutput[] = [];

    const indexerPlugin = new IndexerPluginClient(client);
    const outputList = await indexerPlugin.nft(nftId);
    const consumedOutputId = outputList.items[0];
    console.log("Consumed Output Id", consumedOutputId);

    const initialNftOutputDetails = await client.output(consumedOutputId);

    const initialNftOutput: INftOutput = initialNftOutputDetails.output as INftOutput;

    // New output. Alias output. 
    const nextNftOutput: INftOutput = JSON.parse(JSON.stringify(initialNftOutput));
    nextNftOutput.unlockConditions = [
        {
            type: ADDRESS_UNLOCK_CONDITION_TYPE,
            address: {
                type: ED25519_ADDRESS_TYPE,
                pubKeyHash: nftBuyerAddr
            }
        },
        {
            type: STORAGE_DEPOSIT_RETURN_UNLOCK_CONDITION_TYPE,
            amount: nextNftOutput.amount,
            returnAddress: {
                type: ED25519_ADDRESS_TYPE,
                pubKeyHash: nftOwnerAddr
            }
        }
    ];

    nextNftOutput.nftId = nftId;

    inputs.push(TransactionHelper.inputFromOutputId(consumedOutputId));
    outputs.push(nextNftOutput);

    // 4. Get inputs commitment
    const inputsCommitment = TransactionHelper.getInputsCommitment([initialNftOutput]);

    const transactionEssence: ITransactionEssence = {
        type: TRANSACTION_ESSENCE_TYPE,
        networkId: TransactionHelper.networkIdFromNetworkName(nodeInfo.protocol.networkName),
        inputs,
        inputsCommitment,
        outputs
    };

   const essenceHash = TransactionHelper.getTransactionEssenceHash(transactionEssence);

    // Main unlock condition 
    const unlockCondition: ISignatureUnlock = {
        type: SIGNATURE_UNLOCK_TYPE,
        signature: {
            type: ED25519_SIGNATURE_TYPE,
            publicKey: nftOwnerPubKey,
            signature: Converter.bytesToHex(Ed25519.sign(Converter.hexToBytes(nftOwnerPrivateKey), essenceHash), true)
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
