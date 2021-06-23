import test, { Test } from "tape";
import { randomBytes } from "crypto";
import secp256k1 from "secp256k1";
/*import {

} from "../../../../main/typescript/public-api";*/
import { OdapGateway } from "../../../../main/typescript/gateway/odap-gateway";
test("dummy test for transfer initiation flow", async (t: Test) => {
  /*
    run a gateway(now only call function)
    send initiation flow
    recv initiation ack
    */
  const odapConstructor = {
    name: "cactus-plugin#odapGateway",
    dltIDs: ["dummy"],
  };
  const odapGateWay = new OdapGateway(odapConstructor);
  const dummyPrivKeyBytes = randomBytes(32);
  const dummyPubKeyBytes = secp256k1
    .publicKeyCreate(dummyPrivKeyBytes)
    .toString();

  const initializationRequestMessage = {
    version: "0.0.0",
    loggingProfile: ["dummy"],
    accessControlProfile: ["dummy"],
    initializationRequestMessageSignature:
      "TODO: modify this later, now just let test run", //secp256k1.ecdsaSign(Buffer.from("0x000", `hex`),dummyPrivKeyBytes),
    sourceGatewayPubkey: dummyPubKeyBytes,
    sourceGateWayDltSystem: "dummy array",
    recipientGateWayPubkey: dummyPubKeyBytes,
    recipientGateWayDltSystem: "dummy array",
  };
  const ackMessage = await odapGateWay.initiateTransfer(
    initializationRequestMessage,
  );
  t.equals(
    ackMessage.sessionID,
    "would filled out this later",
    "sessionID equals",
  );
});
