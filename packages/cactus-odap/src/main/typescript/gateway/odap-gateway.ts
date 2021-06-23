import {
  CommitFinalMessage,
  CommitFinalResponseMessage,
  CommitPreparationMessage,
  CommitPreparationResponse,
  InitializationRequestMessage,
  InitialMessageAck,
  LockEvidenceMessage,
  LockEvidenceResponseMessage,
  TransferCommenceMessage,
  TransferCommenceResponseMessage,
  TransferCompleteMessage,
  TransferCompletMessageResponse,
} from "../generated/openapi/typescript-axios";
import { v4 as uuidV4 } from "uuid";
import { time } from "console";
import { SHA256 } from "crypto-js";
import secp256k1 from "secp256k1";
interface Session {
  messageHashes?: string[];
}
export interface OdapGateWayConstructorOptions {
  name: string;
  dltIDs: string[];
}
export class OdapGateway {
  name: string;
  sessions: Map<string, Session>;
  //map[]object, object refer to a state
  //of a specific comminications
  private supportedDltIDs: string[];
  //TODO: use one object as only parameter of constructor
  public constructor(options: OdapGateWayConstructorOptions) {
    this.name = options.name;
    this.supportedDltIDs = options.dltIDs;
    this.sessions = new Map();
  }
  public async initiateTransfer(
    req: InitializationRequestMessage,
  ): Promise<InitialMessageAck> {
    const recvTimestamp: string = time.toString();
    const InitializationRequestMessageHash = SHA256(
      JSON.stringify(req),
    ).toString();
    this.checkValidInitializationRequest(req);

    const processedTimestamp: string = time.toString();
    const sessionID = uuidV4();
    return {
      sessionID: sessionID,
      initialRequestMessageHash: InitializationRequestMessageHash,
      timeStamp: recvTimestamp,
      processedTimeStamp: processedTimestamp,
    };
  }
  public async LockEvidenceTransferCommence(
    req: TransferCommenceMessage,
  ): Promise<TransferCommenceResponseMessage> {
    this.checkValidtransferCommenceRequest(req);

    return { MessageType: "urn:ietf:odap:msgtype:transfer-commence-msg" };
  }
  public async LockEvidence(
    req: LockEvidenceMessage,
  ): Promise<LockEvidenceResponseMessage> {
    const validLockEvidenceRequest = await this.CheckValidLockEvidenceRequest(
      req,
    );
    if (!validLockEvidenceRequest) {
      throw new Error(`transfer commence message type not match`);
    }
    return { MessageType: "urn:ietf:odap:msgtype:lock-evidence-req-msg" };
  }
  public async CommitPrepare(
    req: CommitPreparationMessage,
  ): Promise<CommitPreparationResponse> {
    const validCommitPreparationRequest = await this.CheckValidCommitPreparationRequest(
      req,
    );
    if (!validCommitPreparationRequest) {
      throw new Error(`commit preparation message type not match`);
    }
    return { MessageType: "urn:ietf:odap:msgtype:commit-prepare-ack-msg" };
  }

  public async CommitFinal(
    req: CommitFinalMessage,
  ): Promise<CommitFinalResponseMessage> {
    const validCommitFinalRequest = await this.CheckValidCommitPreparationRequest(
      req,
    );
    if (!validCommitFinalRequest) {
      throw new Error(`commit final message type not match`);
    }
    return { MessageType: "urn:ietf:odap:msgtype:commit-final-msg" };
  }

  public async TransferComplete(
    req: TransferCompleteMessage,
  ): Promise<TransferCompletMessageResponse> {
    const validTransferCompleteRequest = await this.CheckValidTransferCompleteRequest(
      req,
    );
    if (!validTransferCompleteRequest) {
      throw new Error(`transfer complete message type not match`);
    }
    return {};
  }

  public checkValidInitializationRequest(
    req: InitializationRequestMessage,
  ): void {
    const fntag = "${this.className}#checkValidInitializationRequest()";

    const uintSourceGatewayPubkey = Uint8Array.from(
      Buffer.from(req.sourceGatewayPubkey, "hex"),
    );
    if (!secp256k1.privateKeyVerify(uintSourceGatewayPubkey)) {
      throw new Error(`${fntag} invalid format of source gateway pubkey`);
    }

    const uintRecipientGatewayPubkey = Uint8Array.from(
      Buffer.from(req.recipientGateWayPubkey, "hex"),
    );
    if (!secp256k1.privateKeyVerify(uintRecipientGatewayPubkey)) {
      throw new Error(`${fntag}, invalid format of recipient gateway pubkey`);
    }

    if (!(req.sourceGateWayDltSystem in this.supportedDltIDs)) {
      throw new Error(
        `${fntag}, source gate way dlt system is not supported in this gateway`,
      );
    }

    if (!(req.sourceGateWayDltSystem in this.supportedDltIDs)) {
      throw new Error(
        `${fntag}, source gate way dlt system is not supported in this gateway`,
      );
    }

    if (!(req.recipientGateWayDltSystem in this.supportedDltIDs)) {
      throw new Error(
        `${fntag}, recipient gate way dlt system is not supported in this gateway`,
      );
    }
  }
  public checkValidtransferCommenceRequest(req: TransferCommenceMessage): void {
    const fntag = "${this.className}#checkValidtransferCommenceRequest()";
    if (req.messageType != "urn:ietf:odap:msgtype:transfer-commence-msg") {
      throw new Error(`${fntag}, wrong message type for transfer commence`);
    }

    const uintOriginatorPubkey = Uint8Array.from(
      Buffer.from(req.originatorPubkey, "hex"),
    );
    if (!secp256k1.privateKeyVerify(uintOriginatorPubkey)) {
      throw new Error(`${fntag} invalid format of originator pubkey`);
    }

    const uintBeneficiaryPubkey = Uint8Array.from(
      Buffer.from(req.originatorPubkey, "hex"),
    );
    if (!secp256k1.privateKeyVerify(uintBeneficiaryPubkey)) {
      throw new Error(`${fntag} invalid format of beneficiary pubkey`);
    }

    if (!(req.senderDltSystem in this.supportedDltIDs)) {
      throw new Error(
        `${fntag}, sender dlt system is not supported in this gateway`,
      );
    }

    if (!(req.recipientDltSystem in this.supportedDltIDs)) {
      throw new Error(
        `${fntag}, recipient dlt system is not supported in this gateway`,
      );
    }

    const uintClientIdentityPubkey = Uint8Array.from(
      Buffer.from(req.clientIdentityPubkey, "hex"),
    );
    if (!secp256k1.privateKeyVerify(uintClientIdentityPubkey)) {
      throw new Error(`${fntag} invalid format of client identity pubkey`);
    }

    const uintServerIdentityPubkey = Uint8Array.from(
      Buffer.from(req.serverIdentityPubkey, "hex"),
    );
    if (!secp256k1.privateKeyVerify(uintServerIdentityPubkey)) {
      throw new Error(`${fntag} invalid format of server identity pubkey`);
    }
  }
  public async CheckValidTransferCompleteRequest(
    req: TransferCompleteMessage,
  ): Promise<boolean> {
    return (
      req.MessageType == "urn:ietf:odap:msgtype:commit-transfer-complete-msg"
    );
  }
  public async CheckValidCommitFinalRequest(
    req: CommitFinalMessage,
  ): Promise<boolean> {
    return req.MessageType == "urn:ietf:odap:msgtype:commit-final-msg";
  }
  public async CheckValidCommitPreparationRequest(
    req: CommitPreparationMessage,
  ): Promise<boolean> {
    return req.MessageType == "urn:ietf:odap:msgtype:commit-prepare-ack-msg";
  }
  public async CheckValidLockEvidenceRequest(
    req: LockEvidenceMessage,
  ): Promise<boolean> {
    return req.MessageType == "urn:ietf:odap:msgtype:lock-evidence-req-msg";
  }
}
