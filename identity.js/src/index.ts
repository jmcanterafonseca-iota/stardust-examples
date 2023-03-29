import { Client, type MnemonicSecretManager } from "@iota/client-wasm/node/lib/index.js";
import { IotaDocument, IotaIdentityClient } from "@iota/identity-wasm/node/index.js";
import {
    type IEd25519Address, SingleNodeClient,
    ED25519_ADDRESS_TYPE, IndexerPluginClient, Bech32Helper, type IAliasOutput, TransactionHelper,
    TRANSACTION_ESSENCE_TYPE,
    TRANSACTION_PAYLOAD_TYPE,
    type IBasicOutput,
    type IUTXOInput,
    type ITransactionEssence,
    type ITransactionPayload,
    type IBlock,
    BASIC_OUTPUT_TYPE,
    ADDRESS_UNLOCK_CONDITION_TYPE,
    EXPIRATION_UNLOCK_CONDITION_TYPE,
    type ISignatureUnlock,
    SIGNATURE_UNLOCK_TYPE,
    ED25519_SIGNATURE_TYPE,
    DEFAULT_PROTOCOL_VERSION,
    STATE_CONTROLLER_ADDRESS_UNLOCK_CONDITION_TYPE,
    type IStateControllerAddressUnlockCondition
} from "@iota/iota.js";
import { Converter } from "@iota/util.js";
import { Bip39, Ed25519 } from "@iota/crypto.js";
import bigInt from "big-integer";

import { NeonPowProvider } from "@iota/pow-neon.js";


// const API_ENDPOINT = "https://api.testnet.shimmer.network";
const API_ENDPOINT = "http://52.213.240.168:14265";

async function run() {
    const client = new Client({
        primaryNode: API_ENDPOINT,
        localPow: true
    });

    const didClient = new IotaIdentityClient(client);

    // Get the Bech32 human-readable part (HRP) of the network.
    const networkHrp: string = await didClient.getNetworkHrp();
    console.log("HRP", networkHrp);

    // DID State Controller and address with the funds
    const ed25519Addr = "0xdd1c4b9557a4da993e2360c1321f7ac62350c93fae4388514506c5823a3ba579";
    // Public key of the owner of the funds
    const pubKeyAddr = "0x3c688dab588b7a1f5f9cf911575ed08dd34fc8606fa4ba2397d562f8cc709b7b";
    const privateKeyAddr = "0x80df9df0b0b6cdb2e979b74def662c81bab3e884278dd021f943dd9cda609f743c688dab588b7a1f5f9cf911575ed08dd34fc8606fa4ba2397d562f8cc709b7b";

    // The temp wallet that will receive funds to fund the DID
    const mnemonic = Bip39.randomMnemonic();
    const secretManager: MnemonicSecretManager = {
        mnemonic
    };
    // Address where the funds are transferred
    const walletAddressBech32 = (await client.generateAddresses(secretManager, {
        accountIndex: 0,
        range: {
            start: 0,
            end: 1,
        },
    }))[0];
    const walletAddressEd25519 = Bech32Helper.fromBech32(walletAddressBech32, networkHrp)

    const iotaJsClient = new SingleNodeClient(API_ENDPOINT, { powProvider: new NeonPowProvider() });
    const nodeInfo = await iotaJsClient.info();

    const document = new IotaDocument(networkHrp);
    console.log(document.id);

    const didOutputControllerAddress: IEd25519Address = {
        type: ED25519_ADDRESS_TYPE,
        pubKeyHash: ed25519Addr
    };

    const walletAddressEd25519Addr: IEd25519Address = {
        type: ED25519_ADDRESS_TYPE,
        pubKeyHash: Converter.bytesToHex(walletAddressEd25519.addressBytes, true)
    };

    const identityOutput: IAliasOutput = await didClient.newDidOutput(walletAddressEd25519Addr, document);

    const stateControllerUnlockIndex = identityOutput.unlockConditions
        .findIndex(unlockCondition => unlockCondition.type === STATE_CONTROLLER_ADDRESS_UNLOCK_CONDITION_TYPE);

    const newStateController: IStateControllerAddressUnlockCondition = {
        type: STATE_CONTROLLER_ADDRESS_UNLOCK_CONDITION_TYPE,
        address: didOutputControllerAddress
    };

    identityOutput.unlockConditions[stateControllerUnlockIndex] = newStateController;

    console.log(JSON.stringify(identityOutput));

    const cost = TransactionHelper.getStorageDeposit(identityOutput, nodeInfo.protocol.rentStructure);

    console.log("Cost of Funding DID", cost);

    // Now trying to find an Output to fund
    const indexerPlugin = new IndexerPluginClient(iotaJsClient);
    const outputList = await indexerPlugin.basicOutputs({
        addressBech32: Bech32Helper.toBech32(ED25519_ADDRESS_TYPE, Converter.hexToBytes(ed25519Addr), networkHrp)
    });

    if (outputList.items.length === 0) {
        throw new Error("No outputs available");
    }

    const spentOutputId = outputList.items[0];
    const spentOutputDetails = await iotaJsClient.output(spentOutputId);
    const spentOutput: IBasicOutput = spentOutputDetails.output as IBasicOutput;

    const amount = bigInt(cost);

    if (bigInt(spentOutput.amount).lesser(bigInt(cost))) {
        throw new Error("Not enough funds");
    }

    const txInputs: IUTXOInput[] = [];
    const txOutputs: IBasicOutput[] = [];

    txInputs.push(TransactionHelper.inputFromOutputId(spentOutputId));

    const didFundsOutput: IBasicOutput = {
        type: BASIC_OUTPUT_TYPE,
        amount: amount.toString(),
        unlockConditions: [
            {
                type: ADDRESS_UNLOCK_CONDITION_TYPE,
                address: {
                    type: ED25519_ADDRESS_TYPE,
                    pubKeyHash: Converter.bytesToHex(walletAddressEd25519.addressBytes, true)
                }
            },
            {
                type: EXPIRATION_UNLOCK_CONDITION_TYPE,
                returnAddress: {
                    type: ED25519_ADDRESS_TYPE,
                    pubKeyHash: ed25519Addr
                },
                unixTime: Math.round(Date.now() / 1000) + 120
            }
        ]
    };

    const remainderOutput = JSON.parse(JSON.stringify(spentOutput));
    remainderOutput.amount = bigInt(spentOutput.amount).minus(bigInt(cost));

    txOutputs.push(didFundsOutput);
    txOutputs.push(remainderOutput);

    const inputsCommitment = TransactionHelper.getInputsCommitment([spentOutputDetails.output]);

    const transactionEssence: ITransactionEssence = {
        type: TRANSACTION_ESSENCE_TYPE,
        networkId: TransactionHelper.networkIdFromNetworkName(nodeInfo.protocol.networkName),
        inputs: txInputs,
        inputsCommitment,
        outputs: txOutputs
    };

    const essenceHash = TransactionHelper.getTransactionEssenceHash(transactionEssence);

    // Main unlock condition 
    const unlockCondition: ISignatureUnlock = {
        type: SIGNATURE_UNLOCK_TYPE,
        signature: {
            type: ED25519_SIGNATURE_TYPE,
            publicKey: pubKeyAddr,
            signature: Converter.bytesToHex(Ed25519.sign(Converter.hexToBytes(privateKeyAddr), essenceHash), true)
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
    const blockId = await iotaJsClient.blockSubmit(block);
    console.log("Block Id:", blockId);

    setTimeout(async () => {
        const published = await didClient.publishDidOutput(secretManager, identityOutput);
        console.log("Published DID document:", JSON.stringify(published, null, 2));
    }, 6000);
}

export { };

run().then(() => console.log("Done")).catch(err => console.error(err));
