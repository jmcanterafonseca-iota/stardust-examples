# Stardust for iota.js developers : Part I Value Transactions

This series of how-to pages is intended to Javascript developers that want to get familiar with:

* the structure and functionality of transactions in Stardust (the IOTA protocol version that enables the [Shimmer network](https://shimmer.network))
* [iota.js](https://github.com/iotaledger/iota.js) primitives to issue those transactions

## Introduction

Starting from Chrysalis, IOTA is a UTXO-based (Unspent Transaction Output) Ledger. Each UTXO, aka **output**, has an associated number of tokens that determines its value. Thus, the permanent data on the ledger is composed by a set of records (*outputs*) that can be unlocked by the owner of its associated address, i.e. the one who knows the address' private key.  There can be different types of outputs as explained [here](https://wiki.iota.org/shimmer/learn/outputs). In this tutorial we will only talk about traditional value outputs (`IBasicOutput`). Outputs are generated by transactions that unlock and consume already existing outputs (which actually turn into inputs when consumed by a transaction) and generate new outputs. At pruning time *consumed outputs* will be removed by Nodes. However they might be stored permanently by Nodes counting with an [INX Chronicle](https://github.com/iotaledger/inx-chronicle) plugin. Each output in the Ledger has a unique identifier as it has each transaction that mutates the Ledger state by manipulating outputs.

## Storage cost

UTXOs need to be stored by Hornet Nodes, thus there is a storage cost. The Stardust protocol defines a parameter, named "vByte cost", that defines, in *Glow* (remember that a Glow corresponds to 10^-6 Shimmer), the cost of storage of each "virtual byte". As each output consumes a number of vBytes in the Ledger, it is a necessary condition for an output to cover with its value at least the vByte cost in the Ledger. This means that Nodes will reject, upfront, transactions which outputs do not meet this condition. For instance, in the current Shimmer network, you cannot just transact `1 Glow` to a new output because the storage cost of such an output will be higher. And that's when it comes into play *storage deposits* that will be introduced later on.

The size of a UTXO, and thus its cost, depends structurally on its type but also on additional data it may carry out, as we will be showing lately.

## Preparing the experimentation environment

In order to run a similar code than the one explained by this tutorial you need:

* [Node.js 16](https://nodejs.org/en/blog/release/v16.16.0/).

* The [`@iota/iota.js`](https://www.npmjs.com/package/@iota/iota.js) and auxiliary libraries,
[`@iota/crypto.js`](https://www.npmjs.com/package/@iota/crypto.js) [`@iota/util.js`](https://www.npmjs.com/package/@iota/util.js).

* Access to a Stardust Node (Hornet 2.0.0), for instance, the Shimmer testnet Nodes at [https://api.testnet.shimmer.network](https://api.testnet.shimmer.network).

* To run the Proof of Work (PoW) computation it would be advisable to count with the [`@iota/pow-neon.js`](https://www.npmjs.com/package/@iota/pow-neon.js) package. Another alternative is that you spin out your own Node configured to perform the PoW remotely.

* Optionally, the TypeScript compiler and related packages

An example `package.json` file is shown below:

```json
{
    "name": "tutorial",
    "version": "1.0.0",
    "scripts": {
        "dist": "tsc",
        "start": "node dist/index"
    },
    "dependencies": {
        "@iota/crypto.js": "2.0.0-rc.1",
        "@iota/iota.js": "2.0.0-rc.1",
        "@iota/util.js": "2.0.0-rc.1",
        "@iota/pow-neon.js": "2.0.0-rc.2"
    },
    "devDependencies": {
        "typescript": "^4.4.3",
        "@types/node": "18.7.23"
    }
}
```

## Generating addresses

In order to start transacting in the network it is needed to count with one or more addresses that can unlock outputs or receive new outputs. Addresses are derived from a public key and their associated outputs can be unlocked with the corresponding private key. As it happens with Firefly wallets, the idea is to be able to generate multiple addresses starting with an initial master secret (*seed phrase*), and, from that point on, use a hierarchical deterministic method to derive multiple addresses.

### Generating a seed phrase and an Ed25519 seed

The seed phrase is generated in accordance with the [BIP39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) specification and it is composed by a set of words, represented as a whitespace-separated string.

```typescript
// Default entropy length is 256
const randomMnemonic = Bip39.randomMnemonic();

console.log("Seed phrase:", randomMnemonic);
```

Once you have the seed phrase (aka BIP39 random mnemonic) the next step is to obtain a *Ed25519 master seed* from the seed phrase:

```typescript
const masterSeed = Ed25519Seed.fromMnemonic(randomMnemonic);
```

This Ed25519 master seed will be used later to generate as many Ed25519 key pairs as needed through the BIP32 deterministic method.

### Deterministic address paths (BIP32)

The aforementioned master seed can be used to generate, in a deterministic manner, addresses i.e. Ed25519 key pairs, generated through the [BIP32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki) method and structured as per the [BIP44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki) logical hierarchy. The `iota.js` library provides a method `generateBip44Address` that creates these BIP32 paths using an state object that it is updated on each call made. See example below

```typescript
const NUM_ADDR = 6;
const addressGeneratorAccountState = {
    accountIndex: 0,
    addressIndex: 0,
    isInternal: false
};
const paths: string[] = [];
for (let i = 0; i < NUM_ADDR; i++) {
    const path = generateBip44Address(addressGeneratorAccountState);
    paths.put(path);

    console.log(`${path}`);
}
```

That will generate the following BIP32 paths:

```text
m/44'/4218'/0'/0'/0'
m/44'/4218'/0'/1'/0'
m/44'/4218'/0'/0'/1'
m/44'/4218'/0'/1'/1'
m/44'/4218'/0'/0'/2'
m/44'/4218'/0'/1'/2'
```

* `44` is a constant that denotes *purpose*, (`0x8000002C`) following the [BIP43](https://github.com/bitcoin/bips/blob/master/bip-0043.mediawiki) recommendation.
* `4218` is the *coin type* defined for Shimmer
* the three following numbers are:

* the *account index*, as users can use these accounts to organize the funds in the same fashion as bank accounts; for donation purposes (where all addresses are considered public), for saving purposes, for common expenses etc.

* the *change index*, that allows to separate addresses used for external operations (ex. receive funds) or just for internal operations (ex. generate change).

* the *address index* that increments sequentially

In the example above it has been generated `6` address paths, for the account `0` and from index `0` to `2`, starting with one address for external operations and then alternating with another address for internal operations.

### Ed25519 key pairs for the addresses

For generating a Ed25519 key pair, first of all it is needed to generate a subsequent Ed25519 seed from a BIP32 path and from that point on the key pair can be derived.

```typescript
const keyPairs: IKeyPair[] = [];

for (const path of paths) {
    // Master seed was generated previously
    const addressSeed = masterSeed.generateSeedFromPath(new Bip32Path(path));
    const addressKeyPair = addressSeed.keyPair();
    keyPairs.push(addressKeyPair);

    console.log(Converter.bytesToHex(addressKeyPair.privateKey, true));
    console.log(Converter.bytesToHex(addressKeyPair.publicKey, true));
}
```

As the keys are generated as byte arrays (`UInt8Array`) it is necessary to encode them using displayable characters, in this case,  hexadecimal characters (`Converter.bytesToHex` function). The trailing `true` parameter indicates that the `0x` prefix shall be included in such a representation. Conversely, there is a `Converter.hexToBytes` function that allows to obtain the bytes (`UInt8Array`) corresponding to an hexadecimal representation.

You can observe that the key pairs generated are of the form:

`0x6f0fa2f7a9d5fbd221c20f54d944378acb871dcdeafc3761e73d7f0aa05c75356f8eeee559daa287ec40a3a7113e88df2fc27bc77819e6d3d146a7dc7a4e939c`
`0x6f8eeee559daa287ec40a3a7113e88df2fc27bc77819e6d3d146a7dc7a4e939c`

The Ed25519 private key contains `128` hex chars that corresponds to `64` bytes. Conversely, the public key can be represented using `64` hex chars i.e. `32` bytes.

At this point in time we have our asymmetric cryptography set but we need to generate the public addresses that will be used in the Shimmer network.

## Public addresses

As it usually happens in Blockchain, public addresses used are derived from a public key by hashing it. In Stardust, they are derived from the Ed25519 public key.

There are two different address formats:

* the Ed25519 format (which it is just a hash of the Ed25519 public key)

* an easy to be identified and error resistant format which complies with [BECH32](https://github.com/bitcoin/bips/blob/master/bip-0173.mediawiki). In the case of the [Shimmer mainnet](https://explorer.shimmer.network) the BECH32 human readable part (HRP) used is `smr`, whereas `rms` is used for the Shimmer testnet. Those HRPs are also provided as metadata elements of the `info` primitive of the protocol (more on this later).

```typescript
const publicAddresses: { ed25519: string, bech32: string }[] = [];

for (const keyPair of keyPairs) {
    const ed25519Address = new Ed25519Address(keyPair.publicKey);
    // Address in bytes
    const ed25519AddressBytes = ed25519Address.toAddress();
    // Conversion to BECH32
    const bech32Addr = Bech32Helper.toBech32(ED25519_ADDRESS_TYPE, ed25519AddressBytes, "rms");

    const publicAddress = {
        ed25519: Converter.bytesToHex(ed25519AddressBytes, true),
        bech32: bech32Addr
    };
    publicAddresses.push(publicAddress);

    console.log(publicAddress);
}
```

You can observe that the BECH32 address is generated from the Ed25519 address, which it is a hash of the public key.

Resulting in:

```text
{
  ed25519: '0x1696e3735e8871ce7086af6a9920e1a3b83cdf8b265adf449fc4bda86b91e2bb',
  bech32: 'rms1qqtfdcmnt6y8rnnss6hk4xfqux3ms0xl3vn94h6ynlztm2rtj83tk9qkzrx'
}
```

You can observe that the Ed25519 format has a length of `64` hex chars (32 bytes) as the Ed25519 public key. On the other hand the BECH32 address starts with `rms` or `smr` and continues with a `1` character.

At any point in time it is possible to transform the BECH32 address into a Ed25519 address as follows:

```typescript
const ed25519Addr = Bech32Helper.fromBech32(bech32Address, "rms").addressBytes;
```

However you cannot derive your Ed25519 public key, because it is a hash of such a public key, and hashes are irreversible functions.

## Sending funds to an initial address through the testnet faucet

Once we have a set of addresses, and in order to experiment with value transactions, it is necessary to have some funds. We are going to do our experiments with the [testnet](https://explorer.shimmer.network/testnet) and request some initial funds to the [testnet Shimmer faucet](https://faucet.testnet.shimmer.network/) to be transferred to an initial address.  

In our example we are going to use `rms1qp5kej93urfvrc5lhuay7jgupjwuwvxxunzwp59tvqg7nufqntcpxp26uj8` or `0x696cc8b1e0d2c1e29fbf3a4f491c0c9dc730c6e4c4e0d0ab6011e9f1209af013` in Ed25519 format.

Afterwards we can observe in the [Explorer](https://explorer.shimmer.network/testnet) that the balance of our address is now `1000 SMR` (the quantity transferred by the Faucet by default). Let's also analyze the information provided by the Explorer:

* The `1000 SMR` corresponds to an output with a certain Id and timestamp

* Such an output has been generated by a transaction signed by the faucet and which has a particular ID

* An storage deposit is reported. It corresponds to `42600 Glow` which it is the vByte cost for the output associated with our initial address.

## Querying output details

If you know an `output Id` you can query the details of such an output through the Node API and, thus, through the `iota.js` library.

First of all you can connect to your node as follows:

```typescript
const API_ENDPOINT = "https://api.testnet.shimmer.network";
const client = new SingleNodeClient(API_ENDPOINT, { powProvider: new NeonPowProvider() });
const protocolInfo = await client.protocolInfo();

console.log(protocolInfo);
```

In the code above we are using the `NeonPowProvider` that will be used to calculate the PoW when submitting blocks. The `NeonPowProvider` executes native code and calculates the PoW faster.

With the code above you can get some metadata of the network including the HRP for the BECH32 addresses as it was formerly explained:

```json
{
  "networkName": "testnet",
  "networkId": "8342982141227064571",
  "bech32Hrp": "rms",
  "minPowScore": 1500
}
```

Through the interface exposed by the `iota.js` `SingleNodeClient` you can get the details of your output, in our example:

```typescript
const outputID = "0xcba9a6616df8e8e323d8203ea5d1a42e2e7c64dc9ead6b59f5d26bdc301efa540000";
const outputDetails = await client.output(outputID);
console.log(outputDetails);
```

```json
{
    "metadata": {
        "blockId": "0x2b6a3301572f19e3596c2832e55c913ef9d3acc1ba345600ad76a8e4068b9f47",
        "transactionId": "0xcba9a6616df8e8e323d8203ea5d1a42e2e7c64dc9ead6b59f5d26bdc301efa54",
        "outputIndex": 0,
        "isSpent": false,
        "milestoneIndexBooked": 1692812,
        "milestoneTimestampBooked": 1666599405,
        "ledgerIndex": 1693193
    },
    "output": {
        "type": 3,
        "amount": "1000000000",
        "unlockConditions": [
            {
                "type": 0,
                "address": {
                    "type": 0,
                    "pubKeyHash": "0x696cc8b1e0d2c1e29fbf3a4f491c0c9dc730c6e4c4e0d0ab6011e9f1209af013"
                }
            }
        ]
    }
}
```

The output details contain two different groups of information:

* *metadata* that conveys the status of the output on the Ledger.

* the *output details* including the type of output (`3` for value, i.e. basic outputs), the amount (in Glows) and the unlock conditions. You can observe that the unlock conditions contain the (Ed22519) public key hash of our initial address address. That means that only the  one who controls the private key corresponding to that public key hash can unlock this output and use the corresponding funds. The protocol defines other possible unlock conditions that will be introduced later on.

## Transferring funds

In this example we are going to use the following addresses declared as constants (you can mimic these examples with your own generated addresses):

* Origin address: `rms1qp5kej93urfvrc5lhuay7jgupjwuwvxxunzwp59tvqg7nufqntcpxp26uj8` or `0x696cc8b1e0d2c1e29fbf3a4f491c0c9dc730c6e4c4e0d0ab6011e9f1209af013` in Ed25519 format.

* Destination address: `rms1qz7f4y6kje2xyykzxljfazqlc67mmy9apmrpgqu3nqsh9uz6qxcf2zqse0d` or `0xbc9a935696546212c237e49e881fc6bdbd90bd0ec6140391982172f05a01b095` in Ed25519 format.

```typescript
const sourceAddress = "0x696cc...";
const sourceAddressBech32 = "rms1qp5kej9...";
const sourceAddressPublicKey =  "0x5782872d...";
const sourceAddressPrivateKey = "0x003dd7e...";

const destAddress = "0xbc9a935...";
```

For transferring funds the following steps have to be taken:

* Select the output to be consumed (that will turn into a transaction input)

* Provide the signature that unlocks such an input

* Determine the new outputs that will be generated

* Provide the unlock conditions for such new outputs

* Wrap the inputs and outputs into a transaction essence

* Sign such a transaction essence with the corresponding private key so that those inputs can be unlocked

* Attach a transaction payload (essence + unlock conditions) into a block

* Submit such a block

### Preparing input

In our example the output to be consumed is the one that holds the initial funds transferred by the testnet Faucet. As the unit of measurement is the Glow it is needed to use a `BigInt` data type to perform arithmetic operations. In this case the value to be transferred is `50000` Glow.

An input is represented by the type `IUTXOInput` and can be easily obtained from an output ID as shown below.

```typescript
const consumedOutputId = "0xcba9a6616df8e8e323d8203ea5d1a42e2e7c64dc9ead6b59f5d26bdc301efa540000";
const outputDetails = await client.output(consumedOutputId);
const totalFunds = bigInt(outputDetails.output.amount);

const amountToSend = bigInt("50000");

const inputs: IUTXOInput[] = [];
        
inputs.push(TransactionHelper.inputFromOutputId(consumedOutputId));
```

### Preparing outputs

In this case two new outputs are generated:

* The output where the `50000` Glow will now reside (associated to the destination address)

* The output where the remaining funds will stay (associated to our original address)

```typescript

const outputs: IBasicOutput[] = [];

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
```

You can observe how a basic output is defined using the `type` field. Concerning the unlock conditions, we are using as unlock condition: "it shall be the one who controls the specified address" i.e the one who knows the corresponding private key.

The output that will hold the remaining funds is as follows. The amount of funds, obviously, will be the total funds of the original input minus the amount now hold by the new output. The unlock condition in this case will correspond to the original Ed25519 address.

```typescript
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
                pubKeyHash: originAddress
            }
        }
    ],
    features: []
};

outputs.push(basicOutput);
outputs.push(remainderBasicOutput);
```

### Creating a transaction payload

First of all a transaction essence has to be created as it will be used to calculate a hash for the corresponding signature.
The transaction essence must include the commitments to the inputs so that it is ensured that those outputs already exist at the time of submitting the transaction:

```typescript
const inputsCommitment = TransactionHelper.getInputsCommitment([outputDetails.output]);

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
```

Once the hash of the transaction essence is calculated the final transaction payload can be created by adding the corresponding signature unlock:

```typescript
const privateKey = Converter.hexToBytes(sourceAddressPrivateKey);
const signatureUnlock: ISignatureUnlock = {
    type: SIGNATURE_UNLOCK_TYPE,
    signature: {
        type: ED25519_SIGNATURE_TYPE,
        publicKey: sourceAddressPublicKey,
        signature: Converter.bytesToHex(Ed25519.sign(privateKey, essenceHash), true)
    }
};

const transactionPayload: ITransactionPayload = {
    type: TRANSACTION_PAYLOAD_TYPE,
    essence: transactionEssence,
    unlocks: [signatureUnlock]
};
```

You can observe that the signature unlock is composed by the **public key** corresponding to the source address (not the hash) and the signature represented in hex format. The public key is needed so that the Node receiving the transaction can properly verify the attached signature.

You need to understand that *for each input* there shall be one unlock in the transaction payload. Should other inputs be unlocked by the same signature then a `IReferenceUnlock` shall be used, as it will be explained later.

### Submit block

In order the transaction to be attached to the Tangle it needs to be added to a block. The parents of such a Block can be obtained from the Node through the `tips()` function or it can be left empty if you are using the `NeonPowProvider`.

```typescript
const block: IBlock = {
    protocolVersion: DEFAULT_PROTOCOL_VERSION,
    parents: [],
    payload: transactionPayload,
    nonce: "0",
};

const blockId = await client.blockSubmit(block);

console.log(blockId);
```

### Checking results

The results of the operation are:

* A new block identified by a certain `Block Id` (Block Ids are `32` bytes long i.e. `256` bit).
* A new transaction identified by a `transaction Id` (Transaction Ids are `32` bytes long).
* Two new outputs on the ledger, one associated to each address and identified by their corresponding Id (Output Ids are `34` bytes long).
* After confirmation of the transaction, the funds of the origin address will be `999.95 SMR` and the funds of the destination address will be `0.05 SMR`, as `50,000 Glow`, as `1 SMR` is `10^6` (`1M`) Glow.

You can check now the balance of both addresses using the Shimmer Explorer.

## Understanding deposits

You can try to execute again all the steps described above but using a new output Id, the one corresponding to value `999.95 SMR`. This time, instead of hardcoding the output Id, we can obtain the output Id through the [indexation plugin](https://github.com/iotaledger/inx-indexer). The indexation plugin keeps the correspondence between addresses and their associated outputs so it is easy to obtain the balance of an address.

```typescript
const client = new SingleNodeClient(API_ENDPOINT, { powProvider: new NeonPowProvider() });
const indexerPlugin = new IndexerPluginClient(client);
const outputList = await indexerPlugin.basicOutputs({
    addressBech32: sourceAddressBech32
});

console.log(outputList.items[0]);
```

With that code you can obtain the new output Id and execute all the steps described above. As a result the address `rms1qp5kej93urfvrc5lhuay7jgupjwuwvxxunzwp59tvqg7nufqntcpxp26uj8` (our origin address) will end up with a balance of `999.90 SMR` while the address `rms1qz7f4y6kje2xyykzxljfazqlc67mmy9apmrpgqu3nqsh9uz6qxcf2zqse0d` will end up with a balance of `0.10 SMR`.

If you check the balance of the second address, the one with  `0.10 SMR` the storage deposit now is `85200 Glow` whereas the storage deposit of the origin address is just `42600 Glow`. Why? Because the first address has its funds scattered into multiple outputs and each output consumes ledger storage thus its deposit is higher. This drawback can be overcome by merging the two outputs into one of value `100,000 Glow` i.e. `0.10 SMR`.

## Sweeping outputs to reduce deposits

At this moment, as we would like to reduce our storage deposit, it is feasible to sweep our two outputs into a single output that will contain `0.10 SMR` by combining each `0.05 SMR` existing output. To do so it is necessary to create a new transaction which inputs will be the two existing outputs as follows:

### Obtaining existing outputs

We can obtain the existing outputs by using the indexer plugin. In this case we are expecting two outputs

```typescript
const indexerPlugin = new IndexerPluginClient(client);
const outputList = await indexerPlugin.basicOutputs({
    addressBech32: destinationAddressBech32
});

const consumedOutputId1 = outputList.items[0];
const consumedOutputId2 = outputList.items[1];
```

We know in advance that each output will hold an amount of `0.05 SMR` but we can also query each output and obtain its amount:

```typescript
const output1 = await client.output(consumedOutputId1);
const output2 = await client.output(consumedOutputId2);

// The two outputs are combined into only one output (final amount will be 100000 Glow, 0.1 Shimmer)
const amount1 = bigInt(output1.output.amount);
const amount2 = bigInt(output2.output.amount);
```

### Defining the combined output

The new output will hold the sum amount of `output1` and `output2`.

The unlock conditions correspond to the controller of our original address. That means that in this case you are not transferring funds to another address but just to the same address, but collapsed into a single output.

Please note that you could also have transferred our new output to another address controlled by ourselves. Remember that with the initial seed multiple deterministic addresses can be generated.

```typescript
const combinedOutput: IBasicOutput = {
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
```

### Sweep Transaction payload

To generate the sweep transaction you need to convert your initial outputs to inputs, generate a commitment and create a transaction essence.

```typescript
const inputs: IUTXOInput[] = [];

inputs.push(TransactionHelper.inputFromOutputId(consumedOutputId1));
inputs.push(TransactionHelper.inputFromOutputId(consumedOutputId2));

const inputsCommitment = TransactionHelper.getInputsCommitment([output1.output, output2.output]);

const transactionEssence: ITransactionEssence = {
    type: TRANSACTION_ESSENCE_TYPE,
    networkId: protocolInfo.networkId,
    inputs,
    inputsCommitment,
    outputs: [combinedOutput]    
};
```

Now you need to calculate the hash of the transaction essence and provide the unlock conditions for each input. To provide the unlock conditions it is necessary the public key and private key of your address, so that a proper digital signature can be generated.
In this particular case the unlock conditions will be the same for each input and that's why it is used a "Reference unlock condition".

```typescript
const wsTsxEssence = new WriteStream();
serializeTransactionEssence(wsTsxEssence, transactionEssence);
const essenceFinal = wsTsxEssence.finalBytes();

const essenceHash = Blake2b.sum256(essenceFinal);

const destAddressPubKey = "0x....";
const destAddressPrivateKey = "0x....";

// Main unlock condition 
const unlock1: ISignatureUnlock = {
    type: SIGNATURE_UNLOCK_TYPE,
     signature: {
        type: ED25519_SIGNATURE_TYPE,
        publicKey: destAddressPubKey,
        signature: Converter.bytesToHex(Ed25519.sign(Converter.hexToBytes(destAddressPrivateKey), essenceHash), true)
    }
};

const unlock2: IReferenceUnlock = {
    type: REFERENCE_UNLOCK_TYPE,
    reference: 0
};

const transactionPayload: ITransactionPayload = {
    type: TRANSACTION_PAYLOAD_TYPE,
    essence: transactionEssence,
    unlocks: [unlock1, unlock2]
};
```

Now your transaction payload is ready to be submitted as a block as it has been shown previously in this tutorial. After such transaction is confirmed you can observe that now the storage deposit has reduced to `42600` Glow but the balance of our address keeps being `0.1 SMR`.
