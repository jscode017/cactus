import test, { Test } from "tape";

/*import {

} from "../../../../main/typescript/public-api";*/
import { OdapGateway } from "../../../../main/typescript/gateway/odap-gateway";
test("dummy test for lock evidence transfer commence method", async (t: Test) => {
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
  const transferCommenceMessage = {
    messageType: "",
    originatorPubkey: "",
    beneficiaryPubkey: "",
    senderDltSystem: "",
    recipientDltSystem: "",
    clientIdentityPubkey: "",
    serverIdentityPubkey: "",
    hashAssetProfile: "",
    assetUnit: 1,
    hashPrevMessage: "",
    clientTransferNumber: 1,
    clientSignature: "",
  };
  t.throws(
    () => odapGateWay.LockEvidenceTransferCommence(transferCommenceMessage),
    /transfer commence message type not match/,
    "Check for message type not match OK",
  );
  transferCommenceMessage.messageType =
    "urn:ietf:odap:msgtype:transfer-commence-msg";
  t.doesNotThrow(() =>
    odapGateWay.LockEvidenceTransferCommence(transferCommenceMessage),
  );
  /*const transferCommenceResponseMessage = await odapGateWay.LockEvidenceTransferCommence(
    transferCommenceMessage,
  );
  t.equal(
    transferCommenceResponseMessage.MessageType,
    transferCommenceMessage.MessageType,
    "transfer commence response message type match",
  );*/
});
