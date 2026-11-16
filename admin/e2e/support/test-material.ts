import { execFileSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * TEST ONLY. The throwaway key material of one run of the browser tests or
 * the local preview, made on first use and remembered in this process's
 * environment so the processes it starts share it:
 *   - the key pair the admin signs country requests with (the private half
 *     goes to the admin server under test, the public half to the stand-in
 *     country);
 *   - a self-signed TLS certificate for the stand-in country, in a
 *     temporary folder the admin server trusts through NODE_EXTRA_CA_CERTS.
 * Nothing is written inside the repository and no real country or
 * deployment holds any of it.
 */
export interface TestMaterial {
  signingPrivateKey: string;
  signingPublicKey: string;
  signingKeyId: string;
  tlsDir: string;
  tlsCertFile: string;
  tls: { cert: string; key: string };
}

export function testMaterial(): TestMaterial {
  if (!process.env.E2E_ADMIN_SIGNING_PRIVATE || !process.env.E2E_ADMIN_SIGNING_PUBLIC) {
    const pair = generateKeyPairSync("ec", { namedCurve: "P-256" });
    process.env.E2E_ADMIN_SIGNING_PRIVATE = pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    process.env.E2E_ADMIN_SIGNING_PUBLIC = pair.publicKey.export({ type: "spki", format: "pem" }).toString();
  }
  if (!process.env.E2E_COUNTRY_TLS_DIR) {
    const dir = mkdtempSync(join(tmpdir(), "tronic-admin-tls-"));
    execFileSync(process.execPath, [join(__dirname, "make-cert.mjs"), dir], { stdio: "inherit" });
    process.env.E2E_COUNTRY_TLS_DIR = dir;
  }
  const tlsDir = process.env.E2E_COUNTRY_TLS_DIR;
  const tlsCertFile = join(tlsDir, "cert.pem");
  return {
    signingPrivateKey: process.env.E2E_ADMIN_SIGNING_PRIVATE,
    signingPublicKey: process.env.E2E_ADMIN_SIGNING_PUBLIC,
    signingKeyId: "e2e",
    tlsDir,
    tlsCertFile,
    tls: { cert: readFileSync(tlsCertFile, "utf8"), key: readFileSync(join(tlsDir, "key.pem"), "utf8") },
  };
}
