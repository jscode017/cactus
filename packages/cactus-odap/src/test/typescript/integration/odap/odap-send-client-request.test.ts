import test, { Test } from "tape";
import { randomBytes } from "crypto";
import secp256k1 from "secp256k1";
/*import {

} from "../../../../main/typescript/public-api";*/
import { OdapGateway } from "../../../../main/typescript/gateway/odap-gateway";
import { SendClientRequestMessage } from "../../../../main/typescript/public-api";
test("dummy test for odap send client request", async (t: Test) => {
  const odapConstructor = {
    name: "cactus-plugin#odapGateway",
    dltIDs: ["dummy"],
  };
  const clientOdapGateWay = new OdapGateway(odapConstructor);
  //TODO: how to discover the servergateway, how to call by its api?
  const serverOdapGateWay = new OdapGateway(odapConstructor);
  let dummyPrivKeyBytes = randomBytes(32);
  while (!secp256k1.privateKeyVerify(dummyPrivKeyBytes)) {
    dummyPrivKeyBytes = randomBytes(32);
  }
  const dummyPubKeyBytes = secp256k1.publicKeyCreate(dummyPrivKeyBytes);
  const dummyPubKey = clientOdapGateWay.bufArray2HexStr(dummyPubKeyBytes);
  const odapClientRequest: SendClientRequestMessage = {
    version: "0.0.0",
    loggingProfile: "dummy",
    accessControlProfile: "dummy",
    applicationProfile: "dummy",
    payLoadProfile: {
      assetProfile: "dummy",
      capabilities: "",
    },
    assetProfile: "dummy",
    assetControlProfile: "dummy",
    beneficiaryPubkey: dummyPubKey,
    clientDltSystem: "dummy",
    clientIdentityPubkey: clientOdapGateWay.pubKey,
    originatorPubkey: dummyPubKey,
    recipientGateWayDltSystem: "dummy",
    recipientGateWayPubkey: serverOdapGateWay.pubKey,
    serverDltSystem: "dummy",
    serverIdentityPubkey: dummyPubKey,
    sourceGateWayDltSystem: "dummy",
  };
  t.doesNotThrow(
    async () =>
      await clientOdapGateWay.SendClientRequest(
        odapClientRequest,
        serverOdapGateWay,
      ),
    "does not throw if lock evidence proccessed",
  );
});
