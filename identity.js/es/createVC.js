// Copyright 2020-2022 IOTA Stiftung
// SPDX-License-Identifier: Apache-2.0
import { Credential, ProofOptions, IotaDocument, IotaIdentityClient, IotaDID } from "@iota/identity-wasm/node/index.js";
import { Client } from "@iota/client-wasm/node/lib/index.js";
import { Converter } from "@iota/util.js";
async function run() {
    const client = new Client({
        primaryNode: "http://52.213.240.168:14265",
        localPow: true,
    });
    const didClient = new IotaIdentityClient(client);
    const issuerDid = "did:iota:tst:0xb32ef16d25db941915022e546be87c40a5976ae087426692003d0e414bf586df";
    const privateKey = "0x913c96b5900c843c26aabf9f3db1e99c3d9ed5294738a396911012d46971a07798e4b853c1fd4877bb18ff0bc30efdb5c40afc614831655552d39e761359f5d6";
    const elements = issuerDid.split(":");
    const did = IotaDID.fromAliasId(elements[elements.length - 1], elements[elements.length - 2]);
    const issuerDocument = await didClient.resolveDid(did);
    console.log("Resolved DID document:", JSON.stringify(issuerDocument, null, 2));
    // Create a credential subject indicating the degree earned by Alice, linked to their DID.
    const subject = {
        id: "did:iota:tst:0x6abe6ef35e4dfd4242f932d6fbe1b1ae01b87a1b42a49329141602a9222980de",
        name: "Alice",
        degreeName: "Bachelor of Science and Arts",
        degreeType: "BachelorDegree",
        GPA: "4.0",
    };
    // Create an unsigned `UniversityDegree` credential for Alice
    const unsignedVc = new Credential({
        id: "https://example.edu/credentials/3732",
        type: "UniversityDegreeCredential",
        issuer: issuerDid,
        credentialSubject: subject,
    });
    const privateKeyBytes = Converter.hexToBytes(privateKey);
    // Sign Credential.
    let signedVc;
    try {
        signedVc = issuerDocument.signCredential(unsignedVc, privateKeyBytes, "#sign-1", ProofOptions.default());
    }
    catch (error) {
        console.error(error);
        return;
    }
    // The issuer is now sure that the credential they are about to issue satisfies their expectations.
    // The credential is then serialized to JSON and transmitted to the holder in a secure manner.
    // Note that the credential is NOT published to the IOTA Tangle. It is sent and stored off-chain.
    const credentialJSON = signedVc.toJSON();
    console.log(`Issued credential: ${JSON.stringify(credentialJSON, null, 2)}`);
}
run().then(() => console.log("Done")).catch(err => console.error(err));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRlVkMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvY3JlYXRlVkMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsb0NBQW9DO0FBQ3BDLHNDQUFzQztBQUV0QyxPQUFPLEVBQ0gsVUFBVSxFQUNWLFlBQVksRUFDWixZQUFZLEVBQUUsa0JBQWtCLEVBQzlCLE9BQU8sRUFDWixNQUFNLG1DQUFtQyxDQUFDO0FBRTNDLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUU3RCxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sZUFBZSxDQUFDO0FBRTFDLEtBQUssVUFBVSxHQUFHO0lBQ2QsTUFBTSxNQUFNLEdBQUcsSUFBSSxNQUFNLENBQUM7UUFDdEIsV0FBVyxFQUFFLDZCQUE2QjtRQUMxQyxRQUFRLEVBQUUsSUFBSTtLQUNqQixDQUFDLENBQUM7SUFDSCxNQUFNLFNBQVMsR0FBRyxJQUFJLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBRWpELE1BQU0sU0FBUyxHQUFHLGlGQUFpRixDQUFDO0lBQ3BHLE1BQU0sVUFBVSxHQUFHLG9JQUFvSSxDQUFDO0lBRXhKLE1BQU0sUUFBUSxHQUFHLFNBQVMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDdEMsTUFBTSxHQUFHLEdBQUcsT0FBTyxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsRUFBRSxRQUFRLENBQUMsUUFBUSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzlGLE1BQU0sY0FBYyxHQUFpQixNQUFNLFNBQVMsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDckUsT0FBTyxDQUFDLEdBQUcsQ0FBQyx3QkFBd0IsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLGNBQWMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUUvRSwwRkFBMEY7SUFDMUYsTUFBTSxPQUFPLEdBQUc7UUFDWixFQUFFLEVBQUUsaUZBQWlGO1FBQ3JGLElBQUksRUFBRSxPQUFPO1FBQ2IsVUFBVSxFQUFFLDhCQUE4QjtRQUMxQyxVQUFVLEVBQUUsZ0JBQWdCO1FBQzVCLEdBQUcsRUFBRSxLQUFLO0tBQ2IsQ0FBQztJQUVGLDZEQUE2RDtJQUM3RCxNQUFNLFVBQVUsR0FBRyxJQUFJLFVBQVUsQ0FBQztRQUM5QixFQUFFLEVBQUUsc0NBQXNDO1FBQzFDLElBQUksRUFBRSw0QkFBNEI7UUFDbEMsTUFBTSxFQUFFLFNBQVM7UUFDakIsaUJBQWlCLEVBQUUsT0FBTztLQUM3QixDQUFDLENBQUM7SUFFSCxNQUFNLGVBQWUsR0FBRyxTQUFTLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBRXpELG1CQUFtQjtJQUNuQixJQUFJLFFBQVEsQ0FBQztJQUViLElBQUk7UUFDQSxRQUFRLEdBQUcsY0FBYyxDQUFDLGNBQWMsQ0FBQyxVQUFVLEVBQUUsZUFBZSxFQUFFLFNBQVMsRUFBRSxZQUFZLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztLQUM1RztJQUNELE9BQU8sS0FBSyxFQUFFO1FBQ1YsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNyQixPQUFPO0tBQ1Y7SUFFRCxtR0FBbUc7SUFDbkcsOEZBQThGO0lBQzlGLGlHQUFpRztJQUNqRyxNQUFNLGNBQWMsR0FBRyxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUM7SUFDekMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxzQkFBc0IsSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUNqRixDQUFDO0FBSUQsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMifQ==