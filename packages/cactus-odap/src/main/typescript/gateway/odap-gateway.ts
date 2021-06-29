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
import { Secp256k1Keys } from "@hyperledger/cactus-common";
interface SessionData {
  initializationMsgHash?: string;
  loggingProfile?: string;
  accessControlProfile?: string;
  applicationProfile?: string;
  assetProfile?: string;
  initializationRequestMsgSignature?: string;
  sourceGateWayPubkey?: string;
  sourceGateWayDltSystem?: string;
  recipientGateWayPubkey?: string;
  recipientGateWayDltSystem?: string;
  initialMsgRcvTimeStamp?: string;
  initialMsgProcessedTimeStamp?: string;

  originatorPubkey?: string;
  beneficiaryPubkey?: string;
  clientIdentityPubkey?: string;
  serverIdentityPubkey?: string;
  //in transfer commence request
  clientDltSystem?: string;
  serverDltSystem?: string;
  commenceReqHash?: string;
  commenceAckHash?: string;
  clientSignatureForCommenceReq?: string;
  serverSignatureForCommenceAck?: string;

  lockEvidenceClaim?: string;
  clientSignatureForLockEvidence?: string;
  serverSignatureForLockEvidence?: string;

  lockEvidenceAckHash?: string;

  clientSignatureForCommitPreparation?: string;
  commitPrepareReqHash?: string;
  commitPrepareAckHash?: string;
  serverSignatureForCommitPreparation?: string;

  commitFinalClaim?: string;
  clientSignatureForCommitFinal?: string;
  commitAckClaim?: string;
  serverSignatureForCommitFinal?: string;
  commitFinalReqHash?: string;
  commitFinalAckHash?: string;
}
export interface OdapGatewayConstructorOptions {
  name: string;
  dltIDs: string[];
}
export interface OdapGatewayKeyPairs {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}
export class OdapGateway {
  name: string;
  sessions: Map<string, SessionData>;
  pubKey: string;
  privKey: string;
  //map[]object, object refer to a state
  //of a specific comminications
  private supportedDltIDs: string[];
  public constructor(options: OdapGatewayConstructorOptions) {
    this.name = options.name;
    this.supportedDltIDs = options.dltIDs;
    this.sessions = new Map();
    const keyPairs: OdapGatewayKeyPairs = Secp256k1Keys.generateKeyPairsBuffer();
    this.pubKey = this.bufArray2HexStr(keyPairs.publicKey);
    this.privKey = this.bufArray2HexStr(keyPairs.privateKey);
  }
  public async odapGatewaySign(msg: string): Promise<string> {
    const signObj = secp256k1.ecdsaSign(
      Buffer.from(SHA256(msg).toString(), `hex`),
      Buffer.from(this.privKey, `hex`),
    );
    return signObj.signature.toString();
  }
  public async sign(msg: string, privKey: string): Promise<string> {
    const signature = secp256k1.ecdsaSign(
      new Uint8Array(Buffer.from(SHA256(msg).toString(), `hex`)),
      Buffer.from(privKey, `hex`),
    ).signature;
    return this.bufArray2HexStr(signature);
  }
  public bufArray2HexStr(array: Uint8Array): string {
    return Buffer.from(array).toString("hex");
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

    const ack = {
      sessionID: sessionID,
      initialRequestMessageHash: InitializationRequestMessageHash,
      timeStamp: recvTimestamp,
      processedTimeStamp: processedTimestamp,
    };
    await this.storeDataAfterInitializationRequest(req, ack, sessionID);
    return ack;
  }
  public async lockEvidenceTransferCommence(
    req: TransferCommenceMessage,
  ): Promise<TransferCommenceResponseMessage> {
    this.checkValidtransferCommenceRequest(req, req.sessionID);

    const commenceReqHash = SHA256(JSON.stringify(req)).toString();

    const ack: TransferCommenceResponseMessage = {
      messageType: "urn:ietf:odap:msgtype:transfer-commenceack-msg",
      clientIdentityPubkey: req.clientIdentityPubkey,
      serverIdentityPubkey: req.serverIdentityPubkey,
      hashCommenceRequest: commenceReqHash,
      serverSignature: "",
    };
    const serverSignature = await this.odapGatewaySign(JSON.stringify(ack));
    ack.serverSignature = serverSignature;
    await this.storeDataAfterTransferCommence(req, ack, req.sessionID);
    return ack;
  }
  public async lockEvidence(
    req: LockEvidenceMessage,
  ): Promise<LockEvidenceResponseMessage> {
    await this.checkValidLockEvidenceRequest(req, req.sessionID);

    const lockEvidenceReqHash = SHA256(JSON.stringify(req)).toString();

    const ack: LockEvidenceResponseMessage = {
      messageType: "urn:ietf:odap:msgtype:lock-evidence-req-msg",
      clientIdentityPubkey: req.clientIdentityPubkey,
      serverIdentityPubkey: req.serverIdentityPubkey,
      hashLockEvidenceRequest: lockEvidenceReqHash,
      serverSignature: "",
    };
    const serverSignature = await this.odapGatewaySign(JSON.stringify(ack));
    ack.serverSignature = serverSignature;
    //TODO: pass in a real sessionID
    await this.storeDataAfterLockEvidenceRequest(req, ack, req.sessionID);
    return ack;
  }
  public async CommitPrepare(
    req: CommitPreparationMessage,
  ): Promise<CommitPreparationResponse> {
    await this.checkValidCommitPreparationRequest(req, req.sessionID);

    const hashCommitPrepare = SHA256(JSON.stringify(req)).toString();
    const ack: CommitPreparationResponse = {
      messageType: "urn:ietf:odap:msgtype:commit-prepare-ack-msg",
      clientIdentityPubkey: req.clientIdentityPubkey,
      serverIdentityPubkey: req.serverIdentityPubkey,
      hashCommitPrep: hashCommitPrepare,
      serverSignature: "",
    };
    ack.serverSignature = await this.sign(JSON.stringify(ack), this.privKey);
    this.storeDataAfterCommitPreparationRequest(req, ack, req.sessionID);
    return ack;
  }

  public async CommitFinal(
    req: CommitFinalMessage,
  ): Promise<CommitFinalResponseMessage> {
    await this.checkValidCommitFinalRequest(req, req.sessionID);

    const hashCommitFinal = SHA256(JSON.stringify(req)).toString();
    const ack: CommitFinalResponseMessage = {
      messageType: "urn:ietf:odap:msgtype:commit-final-msg",
      serverIdentityPubkey: req.serverIdentityPubkey,
      commitAcknowledgementClaim: "",
      hashCommitFinal: hashCommitFinal,
      serverSignature: "",
    };

    ack.serverSignature = await this.sign(JSON.stringify(ack), this.privKey);
    this.storeDataAfterCommitFinalRequest(req, ack, req.sessionID);
    return ack;
  }

  public async TransferComplete(
    req: TransferCompleteMessage,
  ): Promise<TransferCompletMessageResponse> {
    await this.CheckValidTransferCompleteRequest(req, req.sessionID);

    return { ok: "true" };
  }

  public checkValidInitializationRequest(
    req: InitializationRequestMessage,
  ): void {
    const fntag = "${this.className()}#checkValidInitializationRequest()";
    const sourceSignature = new Uint8Array(
      Buffer.from(req.initializationRequestMessageSignature, "hex"),
    );
    const sourcePubkey = new Uint8Array(
      Buffer.from(req.sourceGatewayPubkey, "hex"),
    );

    const reqForSourceSignatureVerification = req;
    reqForSourceSignatureVerification.initializationRequestMessageSignature =
      "";
    if (
      !secp256k1.ecdsaVerify(
        sourceSignature,
        Buffer.from(
          SHA256(JSON.stringify(reqForSourceSignatureVerification)).toString(),
          "hex",
        ),
        sourcePubkey,
      )
    ) {
      throw new Error(`${fntag}, signature verify failed`);
    }

    if (!this.supportedDltIDs.includes(req.sourceGateWayDltSystem)) {
      throw new Error(
        `${fntag}, source gate way dlt system is not supported in this gateway`,
      );
    }

    if (!this.supportedDltIDs.includes(req.recipientGateWayDltSystem)) {
      throw new Error(
        `${fntag}, recipient gate way dlt system is not supported in this gateway`,
      );
    }
  }
  public async storeDataAfterInitializationRequest(
    msg: InitializationRequestMessage,
    ack: InitialMessageAck,
    sessionID: string,
  ): Promise<void> {
    const sessionData: SessionData = {};

    sessionData.initializationMsgHash = SHA256(JSON.stringify(msg)).toString();

    sessionData.initializationRequestMsgSignature =
      msg.initializationRequestMessageSignature;
    sessionData.sourceGateWayPubkey = msg.sourceGatewayPubkey;
    sessionData.sourceGateWayDltSystem = msg.sourceGateWayDltSystem;
    sessionData.recipientGateWayPubkey = msg.recipientGateWayPubkey;
    sessionData.recipientGateWayDltSystem = msg.recipientGateWayDltSystem;
    sessionData.applicationProfile = msg.applicationProfile;
    sessionData.accessControlProfile = msg.accessControlProfile;
    sessionData.loggingProfile = msg.loggingProfile;
    sessionData.assetProfile = msg.payloadProfile.assetProfile;
    sessionData.initialMsgRcvTimeStamp = ack.timeStamp;
    sessionData.initialMsgProcessedTimeStamp = ack.processedTimeStamp;
    this.sessions.set(sessionID, sessionData);
  }
  public checkValidtransferCommenceRequest(
    req: TransferCommenceMessage,
    sessionID: string,
  ): void {
    const fntag = "${this.className}#checkValidtransferCommenceRequest()";
    if (req.messageType != "urn:ietf:odap:msgtype:transfer-commence-msg") {
      throw new Error(`${fntag}, wrong message type for transfer commence`);
    }

    const clientSignature = new Uint8Array(
      Buffer.from(req.clientSignature, "hex"),
    );
    const clientPubkey = new Uint8Array(
      Buffer.from(req.clientIdentityPubkey, "hex"),
    );

    const reqForClientSignatureVerification = req;
    reqForClientSignatureVerification.clientSignature = "";
    if (
      !secp256k1.ecdsaVerify(
        clientSignature,
        Buffer.from(
          SHA256(JSON.stringify(reqForClientSignatureVerification)).toString(),
          "hex",
        ),
        clientPubkey,
      )
    ) {
      throw new Error(`${fntag}, signature verify failed`);
    }

    if (!this.supportedDltIDs.includes(req.senderDltSystem)) {
      throw new Error(
        `${fntag}, sender dlt system is not supported in this gateway`,
      );
    }

    if (!this.supportedDltIDs.includes(req.recipientDltSystem)) {
      throw new Error(
        `${fntag}, recipient dlt system is not supported in this gateway`,
      );
    }

    const sessionData = this.sessions.get(sessionID);
    if (sessionData === undefined) {
      throw new Error(`${fntag}, sessionID non exist`);
    }

    const isPrevMsgHash: boolean =
      sessionData.initializationMsgHash !== undefined &&
      sessionData.initializationMsgHash == req.hashPrevMessage;
    if (!isPrevMsgHash) {
      throw new Error(`${fntag}, previous message hash not match`);
    }

    if (sessionData.assetProfile === undefined) {
      throw new Error(`${fntag}, assetProfile not sent from previous request`);
    }

    const assetProfileHash = SHA256(sessionData.assetProfile).toString();
    const isAssetProfileHashMatch = assetProfileHash === req.hashAssetProfile;
    if (!isAssetProfileHashMatch) {
      throw new Error(`${fntag}, assetProfile hash not match`);
    }
  }
  public async storeDataAfterTransferCommence(
    msg: TransferCommenceMessage,
    ack: TransferCommenceResponseMessage,
    sessionID: string,
  ): Promise<void> {
    const fntag = "${this.className}#()storeDataAfterTransferCommence";
    if (!this.sessions.has(sessionID)) {
      throw new Error(`${fntag}, sessionID not exist`);
    }

    const sessionData = this.sessions.get(sessionID);
    if (sessionData === undefined) {
      throw new Error(`${fntag}, session data undefined`);
    }

    //in transfer commence request
    sessionData.clientDltSystem = msg.senderDltSystem;
    sessionData.serverDltSystem = msg.recipientDltSystem;

    sessionData.clientSignatureForCommenceReq = msg.clientSignature;
    sessionData.serverSignatureForCommenceAck = ack.serverSignature;

    sessionData.originatorPubkey = msg.originatorPubkey;
    sessionData.beneficiaryPubkey = msg.beneficiaryPubkey;
    sessionData.serverIdentityPubkey = msg.serverIdentityPubkey;
    sessionData.clientIdentityPubkey = msg.clientIdentityPubkey;

    sessionData.commenceReqHash = ack.hashCommenceRequest;
    sessionData.commenceAckHash = SHA256(JSON.stringify(ack)).toString();

    this.sessions.set(sessionID, sessionData);
  }
  public async checkValidLockEvidenceRequest(
    req: LockEvidenceMessage,
    sessionID: string,
  ): Promise<void> {
    const fntag = "${this.className()}#checkValidLockEvidenceRequest()";

    if (req.messageType != "urn:ietf:odap:msgtype:lock-evidence-req-msg") {
      throw new Error(`${fntag}, wrong message type for lock evidence`);
    }

    const clientSignature = new Uint8Array(
      Buffer.from(req.clientSignature, "hex"),
    );

    const clientPubkey = new Uint8Array(
      Buffer.from(req.clientIdentityPubkey, "hex"),
    );

    const reqForClientSignatureVerification = req;
    reqForClientSignatureVerification.clientSignature = "";
    if (
      !secp256k1.ecdsaVerify(
        clientSignature,
        Buffer.from(
          SHA256(JSON.stringify(reqForClientSignatureVerification)).toString(),
          `hex`,
        ),
        clientPubkey,
      )
    ) {
      throw new Error(`${fntag}, signature verify failed`);
    }

    const isLockEvidenceClaimValid = await this.checkValidLockEvidenceClaim(req.lockEvidenceClaim);
    if (!isLockEvidenceClaimValid) {
      throw new Error(`${fntag} invalid of server identity pubkey`);
    }
    const sessionData = this.sessions.get(sessionID);
    if (sessionData === undefined) {
      throw new Error(`${fntag}, sessionID non exist`);
    }

    const isPrevAckHash: boolean =
      sessionData.commenceAckHash !== undefined &&
      sessionData.commenceAckHash == req.hashCommenceAckRequest;
    if (!isPrevAckHash) {
      throw new Error(`${fntag}, previous ack hash not match`);
    }
  }

  public async checkValidLockEvidenceClaim(
    lockEvidenceClaim: string,
  ): Promise<boolean> {
    return lockEvidenceClaim !== undefined;
  }
  public async storeDataAfterLockEvidenceRequest(
    req: LockEvidenceMessage,
    ack: LockEvidenceResponseMessage,
    sessionID: string,
  ): Promise<void> {
    const fntag = "${this.className}#()storeDataAfterLockEvidenceRequest";
    if (!this.sessions.has(sessionID)) {
      throw new Error(`${fntag}, sessionID not exist`);
    }

    const sessionData = this.sessions.get(sessionID);
    if (sessionData === undefined) {
      throw new Error(`${fntag}, session data undefined`);
    }

    sessionData.lockEvidenceClaim = req.lockEvidenceClaim;
    sessionData.clientSignatureForLockEvidence = req.clientSignature;
    sessionData.serverSignatureForLockEvidence = ack.serverSignature;

    this.sessions.set(sessionID, sessionData);
  }
  public async checkValidCommitPreparationRequest(
    req: CommitPreparationMessage,
    sessionID: string,
  ): Promise<void> {
    const fntag = "${this.className()}#checkValidCommitPreparationRequest()";

    if (req.messageType != "urn:ietf:odap:msgtype:commit-prepare-msg") {
      throw new Error(`${fntag}, wrong message type for commit prepare`);
    }

    const clientSignature = new Uint8Array(
      Buffer.from(req.clientSignature, "hex"),
    );

    const clientPubkey = new Uint8Array(
      Buffer.from(req.clientIdentityPubkey, "hex"),
    );

    const reqForClientSignatureVerification = req;
    reqForClientSignatureVerification.clientSignature = "";
    if (
      !secp256k1.ecdsaVerify(
        clientSignature,
        Buffer.from(
          SHA256(JSON.stringify(reqForClientSignatureVerification)).toString(),
          `hex`,
        ),
        clientPubkey,
      )
    ) {
      throw new Error(`${fntag}, signature verify failed`);
    }

    const sessionData = this.sessions.get(sessionID);
    if (sessionData === undefined) {
      throw new Error(`${fntag}, sessionID non exist`);
    }

    const isPrevAckHash: boolean =
      sessionData.lockEvidenceAckHash !== undefined &&
      sessionData.lockEvidenceAckHash == req.hashLockEvidenceAck;
    if (!isPrevAckHash) {
      throw new Error(`${fntag}, previous ack hash not match`);
    }
  }
  public async storeDataAfterCommitPreparationRequest(
    req: CommitPreparationMessage,
    ack: CommitPreparationResponse,
    sessionID: string,
  ): Promise<void> {
    const fntag = "${this.className}#()storeDataAfterCommitPreparationRequest";
    if (!this.sessions.has(sessionID)) {
      throw new Error(`${fntag}, sessionID not exist`);
    }

    const sessionData = this.sessions.get(sessionID);
    if (sessionData === undefined) {
      throw new Error(`${fntag}, session data undefined`);
    }

    sessionData.commitPrepareReqHash = ack.hashCommitPrep;
    sessionData.commitPrepareAckHash = JSON.stringify(ack);
    sessionData.clientSignatureForCommitPreparation = req.clientSignature;
    sessionData.serverSignatureForCommitPreparation = ack.serverSignature;
    this.sessions.set(sessionID, sessionData);
  }
  public async checkValidCommitFinalRequest(
    req: CommitFinalMessage,
    sessionID: string,
  ): Promise<void> {
    const fntag = "${this.className()}#checkValidCommitFinalRequest()";

    if (req.messageType != "urn:ietf:odap:msgtype:commit-final-msg") {
      throw new Error(`${fntag}, wrong message type for commit final`);
    }

    const clientSignature = new Uint8Array(
      Buffer.from(req.clientSignature, "hex"),
    );

    const clientPubkey = new Uint8Array(
      Buffer.from(req.clientIdentityPubkey, "hex"),
    );

    const reqForClientSignatureVerification = req;
    reqForClientSignatureVerification.clientSignature = "";
    if (
      !secp256k1.ecdsaVerify(
        clientSignature,
        Buffer.from(
          SHA256(JSON.stringify(reqForClientSignatureVerification)).toString(),
          `hex`,
        ),
        clientPubkey,
      )
    ) {
      throw new Error(`${fntag}, signature verify failed`);
    }

    const sessionData = this.sessions.get(sessionID);
    if (sessionData === undefined) {
      throw new Error(`${fntag}, sessionID non exist`);
    }

    const isPrevAckHash: boolean =
      sessionData.commitPrepareAckHash !== undefined &&
      sessionData.commitPrepareAckHash == req.hashCommitPrepareAck;
    if (!isPrevAckHash) {
      throw new Error(`${fntag}, previous ack hash not match`);
    }
  }
  public async storeDataAfterCommitFinalRequest(
    req: CommitFinalMessage,
    ack: CommitFinalResponseMessage,
    sessionID: string,
  ): Promise<void> {
    const fntag = "${this.className}#()storeDataAfterCommitFinalRequest";
    if (!this.sessions.has(sessionID)) {
      throw new Error(`${fntag}, sessionID not exist`);
    }

    const sessionData = this.sessions.get(sessionID);
    if (sessionData === undefined) {
      throw new Error(`${fntag}, session data undefined`);
    }
    sessionData.commitFinalClaim = req.commitFinalClaim;
    sessionData.commitAckClaim = ack.commitAcknowledgementClaim;
    sessionData.clientSignatureForCommitFinal = req.clientSignature;
    sessionData.serverSignatureForCommitFinal = ack.serverSignature;
    sessionData.commitFinalReqHash = ack.hashCommitFinal;
    sessionData.commitPrepareAckHash = JSON.stringify(ack);
    this.sessions.set(sessionID, sessionData);
  }
  public async CheckValidTransferCompleteRequest(
    req: TransferCompleteMessage,
    sessionID: string,
  ): Promise<void> {
    const fntag = "${this.className()}#checkValidTransferCompleteRequest()";

    if (
      req.messageType != "urn:ietf:odap:msgtype:commit-transfer-complete-msg"
    ) {
      throw new Error(`${fntag}, wrong message type for transfer complete`);
    }

    const clientSignature = new Uint8Array(
      Buffer.from(req.clientSignature, "hex"),
    );

    const clientPubkey = new Uint8Array(
      Buffer.from(req.clientIdentityPubkey, "hex"),
    );

    const reqForClientSignatureVerification = req;
    reqForClientSignatureVerification.clientSignature = "";
    if (
      !secp256k1.ecdsaVerify(
        clientSignature,
        Buffer.from(
          SHA256(JSON.stringify(reqForClientSignatureVerification)).toString(),
          `hex`,
        ),
        clientPubkey,
      )
    ) {
      throw new Error(`${fntag}, signature verify failed`);
    }

    const sessionData = this.sessions.get(sessionID);
    if (sessionData === undefined) {
      throw new Error(`${fntag}, sessionID non exist`);
    }

    const isCommmitFinalAckHash: boolean =
      sessionData.commitFinalAckHash !== undefined &&
      sessionData.commitFinalAckHash == req.hashCommitFinalAck;
    if (!isCommmitFinalAckHash) {
      throw new Error(`${fntag}, previous commit final ack hash not match`);
    }

    const isTransferCommenceHash: boolean =
      sessionData.commenceReqHash !== undefined &&
      sessionData.commenceReqHash == req.hashTransferCommence;
    if (!isTransferCommenceHash) {
      throw new Error(`${fntag}, previous transfer commence hash not match`);
    }
  }
}
