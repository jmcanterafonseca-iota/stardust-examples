import { Client } from "@iota/client-wasm/node/lib/index.js";
import { IotaDocument, IotaIdentityClient } from "@iota/identity-wasm/node/index.js";
import { SingleNodeClient, ED25519_ADDRESS_TYPE, IndexerPluginClient, Bech32Helper, TransactionHelper, TRANSACTION_ESSENCE_TYPE, TRANSACTION_PAYLOAD_TYPE, BASIC_OUTPUT_TYPE, ADDRESS_UNLOCK_CONDITION_TYPE, EXPIRATION_UNLOCK_CONDITION_TYPE, SIGNATURE_UNLOCK_TYPE, ED25519_SIGNATURE_TYPE, DEFAULT_PROTOCOL_VERSION, STATE_CONTROLLER_ADDRESS_UNLOCK_CONDITION_TYPE } from "@iota/iota.js";
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
    const networkHrp = await didClient.getNetworkHrp();
    console.log("HRP", networkHrp);
    // DID State Controller and address with the funds
    const ed25519Addr = "0xdd1c4b9557a4da993e2360c1321f7ac62350c93fae4388514506c5823a3ba579";
    // Public key of the owner of the funds
    const pubKeyAddr = "0x3c688dab588b7a1f5f9cf911575ed08dd34fc8606fa4ba2397d562f8cc709b7b";
    const privateKeyAddr = "0x80df9df0b0b6cdb2e979b74def662c81bab3e884278dd021f943dd9cda609f743c688dab588b7a1f5f9cf911575ed08dd34fc8606fa4ba2397d562f8cc709b7b";
    // The temp wallet that will receive funds to fund the DID
    const mnemonic = Bip39.randomMnemonic();
    const secretManager = {
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
    const walletAddressEd25519 = Bech32Helper.fromBech32(walletAddressBech32, networkHrp);
    const iotaJsClient = new SingleNodeClient(API_ENDPOINT, { powProvider: new NeonPowProvider() });
    const nodeInfo = await iotaJsClient.info();
    const document = new IotaDocument(networkHrp);
    console.log(document.id);
    const didOutputControllerAddress = {
        type: ED25519_ADDRESS_TYPE,
        pubKeyHash: ed25519Addr
    };
    const walletAddressEd25519Addr = {
        type: ED25519_ADDRESS_TYPE,
        pubKeyHash: Converter.bytesToHex(walletAddressEd25519.addressBytes, true)
    };
    const identityOutput = await didClient.newDidOutput(walletAddressEd25519Addr, document);
    const stateControllerUnlockIndex = identityOutput.unlockConditions
        .findIndex(unlockCondition => unlockCondition.type === STATE_CONTROLLER_ADDRESS_UNLOCK_CONDITION_TYPE);
    const newStateController = {
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
    const spentOutput = spentOutputDetails.output;
    const amount = bigInt(cost);
    if (bigInt(spentOutput.amount).lesser(bigInt(cost))) {
        throw new Error("Not enough funds");
    }
    const txInputs = [];
    const txOutputs = [];
    txInputs.push(TransactionHelper.inputFromOutputId(spentOutputId));
    const didFundsOutput = {
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
    const transactionEssence = {
        type: TRANSACTION_ESSENCE_TYPE,
        networkId: TransactionHelper.networkIdFromNetworkName(nodeInfo.protocol.networkName),
        inputs: txInputs,
        inputsCommitment,
        outputs: txOutputs
    };
    const essenceHash = TransactionHelper.getTransactionEssenceHash(transactionEssence);
    // Main unlock condition 
    const unlockCondition = {
        type: SIGNATURE_UNLOCK_TYPE,
        signature: {
            type: ED25519_SIGNATURE_TYPE,
            publicKey: pubKeyAddr,
            signature: Converter.bytesToHex(Ed25519.sign(Converter.hexToBytes(privateKeyAddr), essenceHash), true)
        }
    };
    const transactionPayload = {
        type: TRANSACTION_PAYLOAD_TYPE,
        essence: transactionEssence,
        unlocks: [unlockCondition]
    };
    // Create Block
    const block = {
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
run().then(() => console.log("Done")).catch(err => console.error(err));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLE1BQU0sRUFBOEIsTUFBTSxxQ0FBcUMsQ0FBQztBQUN6RixPQUFPLEVBQUUsWUFBWSxFQUFFLGtCQUFrQixFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDckYsT0FBTyxFQUNtQixnQkFBZ0IsRUFDdEMsb0JBQW9CLEVBQUUsbUJBQW1CLEVBQUUsWUFBWSxFQUFxQixpQkFBaUIsRUFDN0Ysd0JBQXdCLEVBQ3hCLHdCQUF3QixFQU14QixpQkFBaUIsRUFDakIsNkJBQTZCLEVBQzdCLGdDQUFnQyxFQUVoQyxxQkFBcUIsRUFDckIsc0JBQXNCLEVBQ3RCLHdCQUF3QixFQUN4Qiw4Q0FBOEMsRUFFakQsTUFBTSxlQUFlLENBQUM7QUFDdkIsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUMxQyxPQUFPLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQ2pELE9BQU8sTUFBTSxNQUFNLGFBQWEsQ0FBQztBQUVqQyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFHcEQsOERBQThEO0FBQzlELE1BQU0sWUFBWSxHQUFHLDZCQUE2QixDQUFDO0FBRW5ELEtBQUssVUFBVSxHQUFHO0lBQ2QsTUFBTSxNQUFNLEdBQUcsSUFBSSxNQUFNLENBQUM7UUFDdEIsV0FBVyxFQUFFLFlBQVk7UUFDekIsUUFBUSxFQUFFLElBQUk7S0FDakIsQ0FBQyxDQUFDO0lBRUgsTUFBTSxTQUFTLEdBQUcsSUFBSSxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUVqRCwyREFBMkQ7SUFDM0QsTUFBTSxVQUFVLEdBQVcsTUFBTSxTQUFTLENBQUMsYUFBYSxFQUFFLENBQUM7SUFDM0QsT0FBTyxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsVUFBVSxDQUFDLENB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