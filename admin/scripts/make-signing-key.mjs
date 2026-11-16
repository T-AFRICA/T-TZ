// pnpm --filter @tronic/admin run signing-key [folder]
//
// Makes the key pair the Central Admin signs country requests with, on the
// owner's own machine, and writes it to a folder OUTSIDE this repository
// (default: "tronic-central-admin-keys" in the user's home folder):
//
//   COUNTRY_API_SIGNING_KEY.pem    the private key: for the ADMIN deployment only
//   CENTRAL_ADMIN_VERIFY_KEY.pem   the public key: for each COUNTRY's storefront deployment
//   WHERE-THESE-GO.txt             which value goes into which variable
//
// Each file is named after the variable its content goes into. The script
// prints where the files are and never what is in them. It refuses to
// write over an existing key: a key that is in use must not be replaced by
// accident. Nothing here is sent anywhere.
import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const folder = resolve(process.argv[2] ?? join(homedir(), "tronic-central-admin-keys"));

const inside = relative(repositoryRoot, folder);
if (inside === "" || (!inside.startsWith("..") && !/^[A-Za-z]:/.test(inside))) {
  console.error("Choose a folder outside the repository: keys must never be next to the code.");
  process.exit(1);
}

const privateFile = join(folder, "COUNTRY_API_SIGNING_KEY.pem");
const publicFile = join(folder, "CENTRAL_ADMIN_VERIFY_KEY.pem");
const notesFile = join(folder, "WHERE-THESE-GO.txt");
for (const file of [privateFile, publicFile]) {
  if (existsSync(file)) {
    console.error(`A key already exists in ${folder}.`);
    console.error("Nothing was changed. To make a new pair, give another folder name, or move the old files away first.");
    process.exit(1);
  }
}

const now = new Date();
const keyId = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
const pair = generateKeyPairSync("ec", { namedCurve: "P-256" });

mkdirSync(folder, { recursive: true });
writeFileSync(privateFile, pair.privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
writeFileSync(publicFile, pair.publicKey.export({ type: "spki", format: "pem" }));
writeFileSync(
  notesFile,
  [
    "TRONIC Central Admin: signing key pair",
    `Made on ${now.toISOString().slice(0, 10)}. Key name (the same in both places): ${keyId}`,
    "",
    "1. ADMIN deployment (Vercel project of the admin) - environment variables:",
    "     COUNTRY_API_SIGNING_KEY      = the whole content of COUNTRY_API_SIGNING_KEY.pem",
    `     COUNTRY_API_SIGNING_KEY_ID   = ${keyId}`,
    "",
    "2. Each COUNTRY's storefront deployment (for example Tanzania) - environment variables:",
    "     CENTRAL_ADMIN_VERIFY_KEY     = the whole content of CENTRAL_ADMIN_VERIFY_KEY.pem",
    `     CENTRAL_ADMIN_VERIFY_KEY_ID  = ${keyId}`,
    "",
    "Copy each file's whole content, including the BEGIN and END lines.",
    "Redeploy both projects after saving the variables.",
    "",
    "COUNTRY_API_SIGNING_KEY.pem is the secret one. It belongs in the admin deployment and nowhere else:",
    "not in a country's deployment, not in the repository, not in a chat or an email.",
    "Once it is saved in the admin deployment, keep this folder somewhere safe or delete the private file.",
    "",
  ].join("\n"),
);

console.log("Key pair made. Nothing was sent anywhere.");
console.log(`  Folder:        ${folder}`);
console.log("  Private key:   COUNTRY_API_SIGNING_KEY.pem    (admin deployment only)");
console.log("  Public key:    CENTRAL_ADMIN_VERIFY_KEY.pem   (each country's storefront deployment)");
console.log(`  Key name:      ${keyId}`);
console.log("  Instructions:  WHERE-THESE-GO.txt");
