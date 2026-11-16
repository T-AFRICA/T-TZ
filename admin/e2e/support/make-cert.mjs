// TEST ONLY. Writes a throwaway self-signed TLS certificate for 127.0.0.1 /
// localhost into the folder given as the first argument (cert.pem, key.pem).
// The browser tests and the local preview use it for the stand-in country
// service, because the admin calls a country over HTTPS only. The folder is
// in the system's temporary directory and is removed after the run; neither
// file is ever in the repository.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { generate } from "selfsigned";

const dir = process.argv[2];
if (!dir) throw new Error("usage: node make-cert.mjs <folder>");
const pems = await generate([{ name: "commonName", value: "localhost" }], {
  keyType: "ec",
  algorithm: "sha256",
  extensions: [
    { name: "basicConstraints", cA: true },
    { name: "keyUsage", digitalSignature: true, keyCertSign: true },
    {
      name: "subjectAltName",
      altNames: [
        { type: 2, value: "localhost" },
        { type: 7, ip: "127.0.0.1" },
      ],
    },
  ],
});
writeFileSync(join(dir, "cert.pem"), pems.cert);
writeFileSync(join(dir, "key.pem"), pems.private);
