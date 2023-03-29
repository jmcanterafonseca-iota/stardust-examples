import { Ed25519 } from "@iota/crypto.js";
import { Converter } from "@iota/util.js";


const essence = process.argv[2];
const privateKey = process.argv[3];

const essenceBytes = Converter.hexToBytes(essence)

console.log(Converter.bytesToHex(Ed25519.sign(Converter.hexToBytes(privateKey), essenceBytes), true));


