---
description: "Mint a new Alias Output with iota.js."
image: /img/client_banner.png
keywords:
- tutorial
- alias
- output
- mint
---

# Mint a new Alias Output

An Alias Output can be used to store a proof of the world state that is included on the Ledger and never pruned. For instance, it can contain a hash or digital signature as a commitment to the state of a certain data element or a data set, as it happens with Smart Contracts. Such proof can be used by a data validator to ensure that the concerned data has not been tampered with. When there is a change in the concerned data, a transition to a new state can be recorded on the ledger by a new transaction that generate a new alias output that incorporating a new proof and increasing the state index but with the same Alias ID. 

. Provided the size of the proof in bytes does not change in between state changes, the Alias Output does not need to increase its storage deposit. An Alias Output has an associated Alias ID 

In order to create a new Alias Output it is needed:

* A not spent [Output]() that holds enough funds for the minimal storage deposit needed for the new Alias Output. In the testnet you can provision funds through the Faucet, as we explained in our [previous tutorial](https://wiki.iota.org/shimmer/iotajs/tutorials/value-transactions/request-funds-from-the-faucet/).

* The key pair corresponding to the Shimmer address that owns the former Output.

* A State Controller Address. The State Controller address private key will be used to unlock the Alias Output so that it can transition to a new state when needed. We explained in our [previous tutorial](https://wiki.iota.org/shimmer/iotajs/tutorials/value-transactions/generate-addresses/) how to create addresses.

* A Governor Address. We explained in our [previous tutorial](https://wiki.iota.org/shimmer/iotajs/tutorials/value-transactions/generate-addresses/) how to create addresses.

* The data you want to store on the Alias Output (represented as an hexadecimal string)

```typescript
const consumedOutputId = "0x45678...";

// Ed25519 Addresses (PubKeyHash)
const sourceAddress = "0x377a...";

// Ed25519 Key pairs
const sourceAddressPublicKey = "0x1be6ea...";
const sourceAddressPrivateKey = "0xb2a5c46a...";

// Ed25519 Addresses (PubKeyHash)
const stateControllerAddress = "0x647f7a9fd831c6e6034e7e5496a50aed17ef7d2add200bb4cfde7649ce2b0aaf";
const governorAddress = "0x22847390aad479d34d52e4fb58a01d752887ae0247708f7e66b488c5b5ba2751";
```

## Define the Alias Output

The Alias output to be minted can be defined as follows:

```typescript
const initialAliasId = new Uint8Array(new ArrayBuffer(32));

// New output. Alias output. 
const aliasOutput: IAliasOutput = {
    type: ALIAS_OUTPUT_TYPE,
    amount: amountToSend.toString(),
    aliasId: Converter.bytesToHex(initialAliasId, true),
    stateMetadata: "0x12345678",
    stateIndex: 0,
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
```

You can observe that `aliasId` is initialized to an hexadecimal string that represents 32 bytes set to `0`. That is the way to ask for a new alias output to be minted. The `stateIndex` is initialized to `0` as this is the initial state. In the unlock conditions the state controller address and the governor addresses are specified in their Ed25519 hashed representation.

## Define the Transaction Essence

The transaction we are defining involves an input (the output that holds at least enough funds to cover the storage deposit of new alias output), and two outputs. The new alias output to be minted and another output with the remaining funds from the original input (that can only be unlocked with the original address that controls the funds). Observe that in this case we are assigning manually an amount to send to the alias output (`60000 Glow`) so that it covers its storage deposit. In a real world scenario you may need to do an automatic calculation of the storage deposit as per the byte rent costs published by your node.

For calculating the remaining funds a query is made against the node to obtain the details of the consumed output. 

```typescript
 const inputs: IUTXOInput[] = [];

const outputs: (IAliasOutput | IBasicOutput)[] = [];

// The amount of funds to be sent to an alias output so that it covers its byte costs
const amountToSend = bigInt("60000");

inputs.push(TransactionHelper.inputFromOutputId(consumedOutputId));

// Details the of consumed Output
const consumedOutputDetails = await client.output(consumedOutputId);
const totalFunds = bigInt(consumedOutputDetails.output.amount);

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

outputs.push(aliasOutput);
outputs.push(remainderBasicOutput);

// Get inputs commitment
const inputsCommitment = TransactionHelper.getInputsCommitment([consumedOutputDetails.output]);

// Create transaction essence
const transactionEssence: ITransactionEssence = {
    type: TRANSACTION_ESSENCE_TYPE,
    networkId: protocolInfo.networkId,
    inputs,
    inputsCommitment,
    outputs
};
```

## Issue the Transaction

Once the transaction essence is defined the transaction can be issued the same way as we did in [previous tutorials](). The essence has to be signed with so that the original output is unlocked.

```typescript
const wsTsxEssence = new WriteStream();
serializeTransactionEssence(wsTsxEssence, transactionEssence);
const essenceFinal = wsTsxEssence.finalBytes();

const essenceHash = Blake2b.sum256(essenceFinal);
   
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

const blockId = await client.blockSubmit(block);
console.log("Block Id:", blockId);
```

## Calculate the Alias ID

It is important to understand that the new Alias Id is derived from the id of the new output and the id of the new output is derived from the id of the transaction. The id of the transaction is a hash of the transaction payload. 

Remember that the alias ID remains constant and known by every node software regardless the transitions (outputs generated) that may happen. 

```typescript
const blockData: IBlock = await client.block(blockId);
const blockTransactionPayload = blockData.payload as ITransactionPayload;

const transactionId = computeTransactionIdFromTransactionPayload(blockTransactionPayload);
const outputId = TransactionHelper.outputIdFromTransactionData(transactionId, 0);
console.log("Output Id:", outputId);

const addrHash = Blake2b.sum256(Converter.hexToBytes(outputId));
console.log("Alias Address (Hex format):", Converter.bytesToHex(addrHash, true));
console.log("Alias Address (Bech32 format):", Bech32Helper.toBech32(ALIAS_ADDRESS_TYPE, addrHash, protocolInfo.bech32Hrp));

function computeTransactionIdFromTransactionPayload(payload: ITransactionPayload) {
  const tpWriteStream = new WriteStream();
    serializeTransactionPayload(tpWriteStream, payload);
    return Converter.bytesToHex(Blake2b.sum256(tpWriteStream.finalBytes()), true);
}
```
