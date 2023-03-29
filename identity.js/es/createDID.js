import { Bip39, Bip32Path } from "@iota/crypto.js";
import { Bech32Helper, Ed25519Address, Ed25519Seed, ED25519_ADDRESS_TYPE, generateBip44Address, } from "@iota/iota.js";
import { Converter, Base58 } from "@iota/util.js";
// const NODE_ENDPOINT = "http://localhost:9876";
const publicKeys = [];
const privateKeys = [];
const bech32Addresses = [];
async function run() {
    // This DID Document can also be created with the help of the IOTA Identity Library
    const did = {
        id: "did:0:0",
        verificationMethod: [{
                id: "did:0:0#sign-1",
                type: "Ed25519VerificationKey2018",
                controller: "did:0:0",
                publicKeyMultibase: ""
            }]
    };
    // From the menemonic a key pair
    // The account #0 will be controlling the DID
    // The account #1 will be the verification method
    // Write the key pairs to the std output
    const randomMnemonic = Bip39.randomMnemonic();
    console.log("\tMnemonic:", randomMnemonic);
    const baseSeed = Ed25519Seed.fromMnemonic(randomMnemonic);
    console.log();
    console.log("Generated Addresses using Bip44 Format");
    const addressGeneratorAccountState = {
        accountIndex: 0,
        addressIndex: 0,
        isInternal: false
    };
    for (let i = 0; i < 2; i++) {
        const path = generateBip44Address(addressGeneratorAccountState);
        console.log(`Address Index ${path}`);
        const addressSeed = baseSeed.generateSeedFromPath(new Bip32Path(path));
        const addressKeyPair = addressSeed.keyPair();
        publicKeys[i] = addressKeyPair.publicKey;
        privateKeys[i] = addressKeyPair.privateKey;
        console.log("\tPrivate Key", Converter.bytesToHex(addressKeyPair.privateKey, true));
        console.log("\tPublic Key", Converter.bytesToHex(addressKeyPair.publicKey, true));
        const indexEd25519Address = new Ed25519Address(addressKeyPair.publicKey);
        // Converting into bytes
        const indexPublicKeyAddress = indexEd25519Address.toAddress();
        console.log("\tAddress Ed25519", Converter.bytesToHex(indexPublicKeyAddress, true));
        bech32Addresses[i] = Bech32Helper.toBech32(ED25519_ADDRESS_TYPE, indexPublicKeyAddress, "tst");
        console.log("\tAddress Bech32", bech32Addresses[i]);
        console.log();
    }
    // Now converting the second private key into Base58 and multibase format and adding to the verification method
    did.verificationMethod[0].publicKeyMultibase = `z${Base58.encode(publicKeys[1])}`;
    console.log(JSON.stringify(did));
    // Posting data to the plugin
}
run().then(() => console.log("Done")).catch(err => console.error(err));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRlRElELmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2NyZWF0ZURJRC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQ25ELE9BQU8sRUFDSCxZQUFZLEVBQ1osY0FBYyxFQUNkLFdBQVcsRUFDWCxvQkFBb0IsRUFDcEIsb0JBQW9CLEdBQ3ZCLE1BQU0sZUFBZSxDQUFDO0FBQ3ZCLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFLE1BQU0sZUFBZSxDQUFDO0FBRWxELGlEQUFpRDtBQUVqRCxNQUFNLFVBQVUsR0FBaUIsRUFBRSxDQUFDO0FBQ3BDLE1BQU0sV0FBVyxHQUFpQixFQUFFLENBQUM7QUFFckMsTUFBTSxlQUFlLEdBQWEsRUFBRSxDQUFDO0FBRXJDLEtBQUssVUFBVSxHQUFHO0lBQ2QsbUZBQW1GO0lBQ25GLE1BQU0sR0FBRyxHQUFHO1FBQ1IsRUFBRSxFQUFFLFNBQVM7UUFDYixrQkFBa0IsRUFBRSxDQUFDO2dCQUNqQixFQUFFLEVBQUUsZ0JBQWdCO2dCQUNwQixJQUFJLEVBQUUsNEJBQTRCO2dCQUNsQyxVQUFVLEVBQUUsU0FBUztnQkFDckIsa0JBQWtCLEVBQUUsRUFBRTthQUN6QixDQUFDO0tBQ0wsQ0FBQTtJQUVELGdDQUFnQztJQUNoQyw2Q0FBNkM7SUFDN0MsaURBQWlEO0lBQ2pELHdDQUF3QztJQUN4QyxNQUFNLGNBQWMsR0FBRyxLQUFLLENBQUMsY0FBYyxFQUFFLENBQUM7SUFDOUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxhQUFhLEVBQUUsY0FBYyxDQUFDLENBQUM7SUFDM0MsTUFBTSxRQUFRLEdBQUcsV0FBVyxDQUFDLFlBQVksQ0FBQyxjQUFjLENBQUMsQ0FBQztJQUUxRCxPQUFPLENBQUMsR0FBRyxFQUFFLENBQUM7SUFDZCxPQUFPLENBQUMsR0FBRyxDQUFDLHdDQUF3QyxDQUFDLENBQUM7SUFDdEQsTUFBTSw0QkFBNEIsR0FBRztRQUNqQyxZQUFZLEVBQUUsQ0FBQztRQUNmLFlBQVksRUFBRSxDQUFDO1FBQ2YsVUFBVSxFQUFFLEtBQUs7S0FDcEIsQ0FBQztJQUVGLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUU7UUFDeEIsTUFBTSxJQUFJLEdBQUcsb0JBQW9CLENBQUMsNEJBQTRCLENBQUMsQ0FBQztRQUVoRSxPQUFPLENBQUMsR0FBRyxDQUFDLGlCQUFpQixJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBRXJDLE1BQU0sV0FBVyxHQUFHLFFBQVEsQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQ3ZFLE1BQU0sY0FBYyxHQUFHLFdBQVcsQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUU3QyxVQUFVLENBQUMsQ0FBQyxDQUFDLEdBQUcsY0FBYyxDQUFDLFNBQVMsQ0FBQztRQUN6QyxXQUFXLENBQUMsQ0FBQyxDQUFDLEdBQUcsY0FBYyxDQUFDLFVBQVUsQ0FBQztRQUUzQyxPQUFPLENBQUMsR0FBRyxDQUFDLGVBQWUsRUFBRSxTQUFTLENBQUMsVUFBVSxDQUFDLGNBQWMsQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUNwRixPQUFPLENBQUMsR0FBRyxDQUFDLGNBQWMsRUFBRSxTQUFTLENBQUMsVUFBVSxDQUFDLGNBQWMsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUVsRixNQUFNLG1CQUFtQixHQUFHLElBQUksY0FBYyxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUN6RSx3QkFBd0I7UUFDeEIsTUFBTSxxQkFBcUIsR0FBRyxtQkFBbUIsQ0FBQyxTQUFTLEVBQUUsQ0FBQztRQUM5RCxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQixFQUFFLFNBQVMsQ0FBQyxVQUFVLENBQUMscUJBQXFCLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUNwRixlQUFlLENBQUMsQ0FBQyxDQUFDLEdBQUcsWUFBWSxDQUFDLFFBQVEsQ0FBQyxvQkFBb0IsRUFBRSxxQkFBcUIsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUUvRixPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixFQUFFLGVBQWUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3BELE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQztLQUNqQjtJQUVELCtHQUErRztJQUMvRyxHQUFHLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLENBQUMsa0JBQWtCLEdBQUcsSUFBSSxNQUFNLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7SUFFbEYsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFFakMsNkJBQTZCO0FBQ2pDLENBQUM7QUFtQkQsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMifQ==