/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import type { Server } from "http";
import type { Server as SecureServer } from "https";
import { Optional } from "typescript-optional";
import { Express } from "express";
import {
  Secp256k1Keys,
  Logger,
  Checks,
  //LogLevelDesc,
  LoggerProvider,
  JsObjectSigner,
  IJsObjectSignerOptions,
} from "@hyperledger/cactus-common";
import { DefaultApi as ObjectStoreIpfsApi } from "@hyperledger/cactus-plugin-object-store-ipfs";
/*import {
  PluginLedgerConnectorBesu,
  DefaultApi as BesuApi,
} from "@hyperledger/cactus-plugin-ledger-connector-besu";*/

/*import {
  PluginLedgerConnectorFabric,
  DefaultApi as FabricApi,
  DefaultEventHandlerStrategy,
} from "@hyperledger/cactus-plugin-ledger-connector-fabric";*/
import {
  ICactusPlugin,
  IPluginWebService,
  IWebServiceEndpoint,
  Configuration,
} from "@hyperledger/cactus-core-api";
import {
  CommitFinalMessage,
  CommitFinalResponseMessage,
  CommitPreparationMessage,
  CommitPreparationResponse,
  InitializationRequestMessage,
  //InitializationRequestMessagePayloadProfile,
  InitialMessageAck,
  LockEvidenceMessage,
  LockEvidenceResponseMessage,
  SendClientRequestMessage,
  TransferCommenceMessage,
  TransferCommenceResponseMessage,
  TransferCompleteMessage,
  TransferCompletMessageResponse,
  DefaultApi as OdapApi,
  AssetProfile,
} from "../generated/openapi/typescript-axios";
import { v4 as uuidV4 } from "uuid";
import { time } from "console";
import { SHA256 } from "crypto-js";
import secp256k1 from "secp256k1";
import { CommitFinalEndpointV1 } from "../web-services/commit-final-endpoint";
import { CommitPrepareEndpointV1 } from "../web-services/commite-prepare-endpoint";
import { LockEvidenceEndpointV1 } from "../web-services/lock-evidence-endpoint";
import { LockEvidencePrepareEndpointV1 } from "../web-services/lock-evidence-transfer-commence-endpoint";
import { TransferCompleteEndpointV1 } from "../web-services/transfer-complete";
import { TransferInitiationEndpointV1 } from "../web-services/transfer-initiation-endpoint";
import { SendClientRequestEndpointV1 } from "../web-services/send-client-request";
import { PluginRegistry } from "@hyperledger/cactus-core";
import {
  DefaultApi as FabricApi,
  FabricContractInvocationType,
  FabricSigningCredential,
  RunTransactionRequest as FabricRunTransactionRequest,
} from "@hyperledger/cactus-plugin-ledger-connector-fabric";
import {
  DefaultApi as BesuApi,
  Web3SigningCredential,
  EthContractInvocationType,
  InvokeContractV1Request as BesuInvokeContractV1Request,
} from "@hyperledger/cactus-plugin-ledger-connector-besu";
const log = LoggerProvider.getOrCreate({
  level: "INFO",
  label: "odap-logger",
});
interface SessionData {
  step?: number;
  initializationMsgHash?: string;
  loggingProfile?: string;
  accessControlProfile?: string;
  applicationProfile?: string;
  assetProfile?: AssetProfile;
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

  isFabricAssetDeleted?: boolean;
  isFabricAssetLocked?: boolean;
  isBesuAssetCreated?: boolean;
  fabricAssetID?: string;
  fabricAssetSize?: number;

  besuAssetID?: string;
}
export interface OdapGatewayConstructorOptions {
  name: string;
  dltIDs: string[];
  instanceId: string;
  ipfsPath?: string;

  fabricPath?: string;
  besuPath?: string;
  fabricSigningCredential?: FabricSigningCredential;
  fabricChannelName?: string;
  fabricContractName?: string;
  besuContractName?: string;
  besuWeb3SigningCredential?: Web3SigningCredential;
  besuKeychainId?: string;

  fabricAssetID?: string;
  besuAssetID?: string;
}
export interface OdapGatewayKeyPairs {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}
interface OdapHermesLog {
  phase: string;
  step: string;
  operation: string;
  nodes: string;
}
export class OdapGateway implements ICactusPlugin, IPluginWebService {
  name: string;
  sessions: Map<string, SessionData>;
  pubKey: string;
  privKey: string;
  public static readonly CLASS_NAME = "OdapGateWay";
  private readonly log: Logger;
  private readonly instanceId: string;
  public ipfsApi?: ObjectStoreIpfsApi;
  public fabricApi?: FabricApi;
  public besuApi?: BesuApi;
  public pluginRegistry: PluginRegistry;

  private endpoints: IWebServiceEndpoint[] | undefined;
  //map[]object, object refer to a state
  //of a specific comminications
  private supportedDltIDs: string[];
  private odapSigner: JsObjectSigner;
  private fabricAssetLocked: boolean;
  private fabricAssetDeleted: boolean;
  private besuAssetCreated: boolean;
  private fabricSigningCredential?: FabricSigningCredential;
  private fabricChannelName?: string;
  private fabricContractName?: string;
  private besuContractName?: string;
  private besuWeb3SigningCredential?: Web3SigningCredential;
  private besuKeychainId?: string;

  private fabricAssetID?: string;
  private besuAssetID?: string;
  public constructor(options: OdapGatewayConstructorOptions) {
    const fnTag = `${this.className}#constructor()`;
    Checks.truthy(options, `${fnTag} arg options`);
    Checks.truthy(options.instanceId, `${fnTag} arg options.instanceId`);
    Checks.nonBlankString(options.instanceId, `${fnTag} options.instanceId`);

    const level = "INFO";
    const label = this.className;
    this.log = LoggerProvider.getOrCreate({ level, label });
    this.instanceId = options.instanceId;
    this.name = options.name;
    this.supportedDltIDs = options.dltIDs;
    this.sessions = new Map();
    const keyPairs: OdapGatewayKeyPairs = Secp256k1Keys.generateKeyPairsBuffer();
    this.pubKey = this.bufArray2HexStr(keyPairs.publicKey);
    this.privKey = this.bufArray2HexStr(keyPairs.privateKey);
    const odapSignerOptions: IJsObjectSignerOptions = {
      privateKey: this.privKey,
      signatureFunc: this.odapSignatureFunc,
      logLevel: "debug",
    };
    this.odapSigner = new JsObjectSigner(odapSignerOptions);
    this.fabricAssetDeleted = false;
    this.fabricAssetLocked = false;
    this.besuAssetCreated = false;

    this.pluginRegistry = new PluginRegistry();
    if (options.ipfsPath != undefined) {
      {
        const config = new Configuration({ basePath: options.ipfsPath });
        const apiClient = new ObjectStoreIpfsApi(config);
        this.ipfsApi = apiClient;
      }
    }
    if (options.fabricPath != undefined) {
      {
        const config = new Configuration({ basePath: options.fabricPath });
        const apiClient = new FabricApi(config);
        this.fabricApi = apiClient;
        const notEnoughFabricParams: boolean =
          options.fabricSigningCredential == undefined ||
          options.fabricChannelName == undefined ||
          options.fabricContractName == undefined ||
          options.fabricAssetID == undefined;
        if (notEnoughFabricParams) {
          throw new Error(
            `${fnTag}, fabric params missing should have: signing credentials, contract name, channel name, asset ID`,
          );
        }
        this.fabricSigningCredential = options.fabricSigningCredential;
        this.fabricChannelName = options.fabricChannelName;
        this.fabricContractName = options.fabricContractName;
        this.fabricAssetID = options.fabricAssetID;
      }
    }
    if (options.besuPath != undefined) {
      const config = new Configuration({ basePath: options.besuPath });
      const apiClient = new BesuApi(config);
      this.besuApi = apiClient;
      const notEnoughBesuParams: boolean =
        options.besuContractName == undefined ||
        options.besuWeb3SigningCredential == undefined ||
        options.besuKeychainId == undefined ||
        options.besuAssetID == undefined;
      if (notEnoughBesuParams) {
        throw new Error(
          `${fnTag}, besu params missing should have: signing credentials, contract name, key chain ID, asset ID`,
        );
      }
      this.besuContractName = options.besuContractName;
      this.besuWeb3SigningCredential = options.besuWeb3SigningCredential;
      this.besuKeychainId = options.besuKeychainId;
      this.besuAssetID = options.besuAssetID;
    }
  }
  public async Revert(sessionID: string): Promise<void> {
    const sessionData = this.sessions.get(sessionID);
    if (sessionData == undefined) return;
    if (sessionData.isFabricAssetDeleted) {
      if (this.fabricApi == undefined) return;
      await this.fabricApi.runTransactionV1({
        signingCredential: this.fabricSigningCredential,
        channelName: this.fabricChannelName,
        contractName: this.fabricContractName,
        invocationType: FabricContractInvocationType.Send,
        methodName: "CreateAsset",
        params: [sessionData.fabricAssetID, sessionData.fabricAssetSize],
      } as FabricRunTransactionRequest);
    } else if (sessionData.isFabricAssetLocked) {
      if (this.fabricApi == undefined) return;
      await this.fabricApi.runTransactionV1({
        signingCredential: this.fabricSigningCredential,
        channelName: this.fabricChannelName,
        contractName: this.fabricContractName,
        invocationType: FabricContractInvocationType.Send,
        methodName: "UnLockAsset",
        params: [sessionData.fabricAssetID],
      } as FabricRunTransactionRequest);
    } else if (sessionData.isBesuAssetCreated) {
      //DO we really need this?
      if (this.besuApi == undefined) return;
      await this.besuApi.invokeContractV1({
        contractName: this.besuContractName,
        invocationType: EthContractInvocationType.Send,
        methodName: "deleteAsset",
        gas: 1000000,
        params: [this.besuAssetID],
        signingCredential: this.besuWeb3SigningCredential,
        keychainId: this.besuKeychainId,
      } as BesuInvokeContractV1Request);
    }
    return;
  }
  public get className(): string {
    return OdapGateway.CLASS_NAME;
  }
  /*public getAspect(): PluginAspect {
    return PluginAspect.WEB_SERVICE;
  }*/
  public async onPluginInit(): Promise<unknown> {
    return;
  }
  async registerWebServices(app: Express): Promise<IWebServiceEndpoint[]> {
    const webServices = await this.getOrCreateWebServices();
    await Promise.all(webServices.map((ws) => ws.registerExpress(app)));
    return webServices;
  }

  public async getOrCreateWebServices(): Promise<IWebServiceEndpoint[]> {
    if (Array.isArray(this.endpoints)) {
      return this.endpoints;
    }

    const transferinitiation = new TransferInitiationEndpointV1({
      gateway: this,
    });
    const lockEvidencePreparation = new LockEvidencePrepareEndpointV1({
      gateway: this,
    });
    const lockEvidence = new LockEvidenceEndpointV1({ gateway: this });
    const commitPreparation = new CommitPrepareEndpointV1({
      gateway: this,
    });
    const commitFinal = new CommitFinalEndpointV1({ gateway: this });
    const transferComplete = new TransferCompleteEndpointV1({
      gateway: this,
    });
    const sendClientrequest = new SendClientRequestEndpointV1({
      gateway: this,
    });
    this.endpoints = [
      transferinitiation,
      lockEvidencePreparation,
      lockEvidence,
      commitPreparation,
      commitFinal,
      transferComplete,
      sendClientrequest,
    ];
    return this.endpoints;
  }

  public getHttpServer(): Optional<Server | SecureServer> {
    return Optional.empty();
  }

  public async shutdown(): Promise<void> {
    this.log.info(`Shutting down ${this.className}...`);
  }

  public getInstanceId(): string {
    return this.instanceId;
  }

  public getPackageName(): string {
    return "@hyperledger/cactus-odap-odap-gateway-business-logic-plugin";
  }

  public async odapGatewaySign(msg: string): Promise<string> {
    /*const signObj = secp256k1.ecdsaSign(
      Buffer.from(SHA256(msg).toString(), `hex`),
      Buffer.from(this.privKey, `hex`),
    );
    return this.bufArray2HexStr(signObj.signature);*/
    return this.odapSigner.sign(msg);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public odapSignatureFunc(msg: any, pkey: any): any {
    const signObj = secp256k1.ecdsaSign(
      Buffer.from(SHA256(msg).toString(), `hex`),
      Buffer.from(pkey, `hex`),
    );
    return Buffer.from(signObj.signature).toString("hex");
    //return this.bufArray2HexStr(signObj.signature);
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
  public async publishOdapProof(ID: string, proof: string): Promise<void> {
    if (this.ipfsApi == undefined) return;
    const res = await this.ipfsApi.setObjectV1({
      key: ID,
      value: proof,
    });
    const resStatusOk = res.status > 199 && res.status < 300;
    if (!resStatusOk) {
      throw new Error("${fnTag}, error when logging to ipfs");
    }
  }
  public async odapLog(
    odapHermesLog: OdapHermesLog,
    ID: string,
  ): Promise<void> {
    this.log.info(
      `<${odapHermesLog.phase}, ${odapHermesLog.step}, ${odapHermesLog.operation}, ${odapHermesLog.nodes}>`,
    );
    if (this.ipfsApi == undefined) return;
    const res = await this.ipfsApi.setObjectV1({
      key: ID,
      value: `${odapHermesLog.phase}, ${odapHermesLog.phase}, ${odapHermesLog.operation}, ${odapHermesLog.nodes}`,
    });
    const resStatusOk = res.status > 199 && res.status < 300;
    if (!resStatusOk) {
      throw new Error("${fnTag}, error when logging to ipfs");
    }
  }
  public async initiateTransfer(
    req: InitializationRequestMessage,
  ): Promise<InitialMessageAck> {
    log.info(
      `server gate way receive initiate transfer request: ${JSON.stringify(
        req,
      )}`,
    );
    const sessionID = uuidV4();
    const sessionData: SessionData = {};
    sessionData.step = 0;
    await this.odapLog(
      {
        phase: "initiateTransfer",
        operation: "init",
        step: sessionData.step.toString(),
        nodes: `${req.sourceGatewayPubkey}->${this.pubKey}`,
      },
      `${sessionID}-${sessionData.step.toString()}`,
    );
    sessionData.step++;
    this.sessions.set(sessionID, sessionData);
    const recvTimestamp: string = time.toString();
    const InitializationRequestMessageHash = SHA256(
      JSON.stringify(req),
    ).toString();
    this.checkValidInitializationRequest(req);

    const processedTimestamp: string = time.toString();

    const ack: InitialMessageAck = {
      sessionID: sessionID,
      initialRequestMessageHash: InitializationRequestMessageHash,
      timeStamp: recvTimestamp,
      processedTimeStamp: processedTimestamp,
      serverIdentityPubkey: this.pubKey,
    };
    await this.storeDataAfterInitializationRequest(req, ack, sessionID);
    return ack;
  }
  public async lockEvidenceTransferCommence(
    req: TransferCommenceMessage,
  ): Promise<TransferCommenceResponseMessage> {
    const fnTag = `${this.className}#lockEvidenceTransferCommence()`;
    log.info(
      `server gate way receive lock evidence transfer commence request: ${JSON.stringify(
        req,
      )}`,
    );
    const commenceReqHash = SHA256(JSON.stringify(req)).toString();
    this.checkValidtransferCommenceRequest(req, req.sessionID);

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
    const sessionData = this.sessions.get(req.sessionID);
    if (sessionData == undefined) {
      await this.Revert(req.sessionID);
      throw new Error(`${fnTag}, sessionID is not valid`);
    }
    sessionData.step = 0;
    await this.odapLog(
      {
        phase: "transfer-commence",
        operation: "prepare-ack",
        step: sessionData.step.toString(),
        nodes: `${this.pubKey}->${req.clientIdentityPubkey}`,
      },
      `${req.sessionID}-${sessionData.step.toString()}`,
    );
    sessionData.step++;
    this.sessions.set(req.sessionID, sessionData);
    return ack;
  }
  public async lockEvidence(
    req: LockEvidenceMessage,
  ): Promise<LockEvidenceResponseMessage> {
    const fnTag = `${this.className}#lockEvidence()`;
    log.info(
      `server gate way receive lock evidence request: ${JSON.stringify(req)}`,
    );
    const lockEvidenceReqHash = SHA256(JSON.stringify(req)).toString();
    await this.checkValidLockEvidenceRequest(req, req.sessionID);

    const ack: LockEvidenceResponseMessage = {
      messageType: "urn:ietf:odap:msgtype:lock-evidence-req-msg",
      clientIdentityPubkey: req.clientIdentityPubkey,
      serverIdentityPubkey: req.serverIdentityPubkey,
      hashLockEvidenceRequest: lockEvidenceReqHash,
      serverSignature: "",
    };
    const serverSignature = await this.odapGatewaySign(JSON.stringify(ack));
    ack.serverSignature = serverSignature;
    await this.storeDataAfterLockEvidenceRequest(req, ack, req.sessionID);
    const sessionData = this.sessions.get(req.sessionID);
    if (sessionData == undefined) {
      await this.Revert(req.sessionID);
      throw new Error(`${fnTag}, sessionID is not valid`);
    }
    sessionData.step = 0;
    await this.odapLog(
      {
        phase: "lock-evidence",
        operation: "prepare-ack",
        step: sessionData.step.toString(),
        nodes: `${this.pubKey}->${req.clientIdentityPubkey}`,
      },
      `${req.sessionID}-${sessionData.step.toString()}`,
    );
    sessionData.step++;
    this.sessions.set(req.sessionID, sessionData);
    return ack;
  }
  public async CommitPrepare(
    req: CommitPreparationMessage,
  ): Promise<CommitPreparationResponse> {
    const fnTag = `${this.className}#CommitPrepare()`;
    log.info(
      `server gate way receive commit prepare request: ${JSON.stringify(req)}`,
    );
    const hashCommitPrepare = SHA256(JSON.stringify(req)).toString();
    await this.checkValidCommitPreparationRequest(req, req.sessionID);

    const ack: CommitPreparationResponse = {
      messageType: "urn:ietf:odap:msgtype:commit-prepare-ack-msg",
      clientIdentityPubkey: req.clientIdentityPubkey,
      serverIdentityPubkey: req.serverIdentityPubkey,
      hashCommitPrep: hashCommitPrepare,
      serverSignature: "",
    };
    ack.serverSignature = await this.sign(JSON.stringify(ack), this.privKey);
    this.storeDataAfterCommitPreparationRequest(req, ack, req.sessionID);
    const sessionData = this.sessions.get(req.sessionID);
    if (sessionData == undefined) {
      await this.Revert(req.sessionID);
      throw new Error(`${fnTag}, sessionID is not valid`);
    }
    sessionData.step = 0;
    await this.odapLog(
      {
        phase: "commit-prepare",
        operation: "prepare-ack",
        step: sessionData.step.toString(),
        nodes: `${this.pubKey}->${req.clientIdentityPubkey}`,
      },
      `${req.sessionID}-${sessionData.step.toString()}`,
    );
    sessionData.step++;
    this.sessions.set(req.sessionID, sessionData);
    return ack;
  }

  public async CommitFinal(
    req: CommitFinalMessage,
  ): Promise<CommitFinalResponseMessage> {
    log.info(
      `server gate way receive commit final request: ${JSON.stringify(req)}`,
    );
    const fnTag = `${this.className}#commitFinal()`;
    const hashCommitFinal = SHA256(JSON.stringify(req)).toString();
    await this.checkValidCommitFinalRequest(req, req.sessionID);
    let besuCreateAssetProof = "";
    if (this.besuApi != undefined) {
      const besuCreateRes = await this.besuApi.invokeContractV1({
        contractName: this.besuContractName,
        invocationType: EthContractInvocationType.Send,
        methodName: "createAsset",
        gas: 1000000,
        params: [this.besuAssetID, 100], //the second is size, may need to pass this from client?
        signingCredential: this.besuWeb3SigningCredential,
        keychainId: this.besuKeychainId,
      } as BesuInvokeContractV1Request);
      if (besuCreateRes.status != 200) {
        await this.Revert(req.sessionID);
        throw new Error(`${fnTag}, besu create asset error`);
      }
      const besuCreateResDataJson = JSON.parse(
        JSON.stringify(besuCreateRes.data),
      );
      if (besuCreateResDataJson.out == undefined) {
        throw new Error(`${fnTag}, besu res data out undefined`);
      }
      if (besuCreateResDataJson.out.transactionReceipt == undefined) {
        throw new Error(`${fnTag}, undefined besu transact receipt`);
      }
      this.log.warn(besuCreateResDataJson.out.transactionReceipt);
      const besuCreateAssetReceipt =
        besuCreateResDataJson.out.transactionReceipt;
      besuCreateAssetProof = JSON.stringify(besuCreateAssetReceipt);
      const besuCreateProofID = `${req.sessionID}-proof-of-create`;
      await this.publishOdapProof(
        besuCreateProofID,
        JSON.stringify(besuCreateAssetReceipt),
      );
      const sessionData = this.sessions.get(req.sessionID);
      if (sessionData == undefined) {
        await this.Revert(req.sessionID);
        throw new Error(`${fnTag}, session data undefined`);
      }
      sessionData.isBesuAssetCreated = true;
    }
    const ack: CommitFinalResponseMessage = {
      messageType: "urn:ietf:odap:msgtype:commit-final-msg",
      serverIdentityPubkey: req.serverIdentityPubkey,
      commitAcknowledgementClaim: besuCreateAssetProof,
      hashCommitFinal: hashCommitFinal,
      serverSignature: "",
    };

    ack.serverSignature = await this.sign(JSON.stringify(ack), this.privKey);
    this.storeDataAfterCommitFinalRequest(req, ack, req.sessionID);
    const sessionData = this.sessions.get(req.sessionID);
    if (sessionData == undefined) {
      await this.Revert(req.sessionID);
      throw new Error(`${fnTag}, sessionID is not valid`);
    }
    sessionData.step = 0;
    await this.odapLog(
      {
        phase: "commit-final",
        operation: "prepare-ack",
        step: sessionData.step.toString(),
        nodes: `${this.pubKey}->${req.clientIdentityPubkey}`,
      },
      `${req.sessionID}-${sessionData.step.toString()}`,
    );
    sessionData.step++;
    this.sessions.set(req.sessionID, sessionData);
    return ack;
  }

  public async TransferComplete(
    req: TransferCompleteMessage,
  ): Promise<TransferCompletMessageResponse> {
    log.info(
      `server gate way receive transfer complete request: ${JSON.stringify(
        req,
      )}`,
    );
    await this.CheckValidTransferCompleteRequest(req, req.sessionID);
    log.info("transfer is complete");
    return { ok: "true" };
  }

  public checkValidInitializationRequest(
    req: InitializationRequestMessage,
  ): void {
    const fnTag = `${this.className}#checkValidInitializationRequest()`;
    const strSignature = req.initializationRequestMessageSignature;
    const sourceSignature = new Uint8Array(Buffer.from(strSignature, "hex"));
    const sourcePubkey = new Uint8Array(
      Buffer.from(req.sourceGatewayPubkey, "hex"),
    );

    req.initializationRequestMessageSignature = "";
    if (
      !secp256k1.ecdsaVerify(
        sourceSignature,
        Buffer.from(SHA256(JSON.stringify(req)).toString(), "hex"),
        sourcePubkey,
      )
    ) {
      throw new Error(`${fnTag}, signature verify failed`);
    }
    req.initializationRequestMessageSignature = strSignature;
    if (!this.supportedDltIDs.includes(req.sourceGateWayDltSystem)) {
      throw new Error(
        `${fnTag}, source gate way dlt system is not supported in this gateway`,
      );
    }

    if (!this.supportedDltIDs.includes(req.recipientGateWayDltSystem)) {
      throw new Error(
        `${fnTag}, recipient gate way dlt system is not supported in this gateway`,
      );
    }
    const expiryDate: string = req.payloadProfile.assetProfile.ExpirationDate;
    const isDataExpire: boolean = Date.now().toString() >= expiryDate;
    if (isDataExpire) {
      throw new Error(`${fnTag}, asset has expired`);
    }
  }
  public async storeDataAfterInitializationRequest(
    msg: InitializationRequestMessage,
    ack: InitialMessageAck,
    sessionID: string,
  ): Promise<void> {
    const sessionData = this.sessions.get(sessionID);
    const fnTag = `${this.className}#storeDataAfterInitializationRequest`;
    if (sessionData == undefined) {
      await this.Revert(sessionID);
      throw new Error(`${fnTag}, session data is undefined`);
    }
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
    const fnTag = "${this.className}#checkValidtransferCommenceRequest()";
    if (req.messageType != "urn:ietf:odap:msgtype:transfer-commence-msg") {
      throw new Error(`${fnTag}, wrong message type for transfer commence`);
    }

    const clientSignature = new Uint8Array(
      Buffer.from(req.clientSignature, "hex"),
    );
    const clientPubkey = new Uint8Array(
      Buffer.from(req.clientIdentityPubkey, "hex"),
    );
    log.info(JSON.stringify(req));
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
      throw new Error(`${fnTag}, signature verify failed`);
    }

    if (!this.supportedDltIDs.includes(req.senderDltSystem)) {
      throw new Error(
        `${fnTag}, sender dlt system is not supported in this gateway`,
      );
    }

    if (!this.supportedDltIDs.includes(req.recipientDltSystem)) {
      throw new Error(
        `${fnTag}, recipient dlt system is not supported in this gateway`,
      );
    }

    const sessionData = this.sessions.get(sessionID);
    if (sessionData === undefined) {
      throw new Error(`${fnTag}, sessionID non exist`);
    }

    const isPrevMsgHash: boolean =
      sessionData.initializationMsgHash !== undefined &&
      sessionData.initializationMsgHash == req.hashPrevMessage;
    if (!isPrevMsgHash) {
      throw new Error(`${fnTag}, previous message hash not match`);
    }

    if (sessionData.assetProfile === undefined) {
      throw new Error(`${fnTag}, assetProfile not sent from previous request`);
    }

    const assetProfileHash = SHA256(
      JSON.stringify(sessionData.assetProfile),
    ).toString();
    const isAssetProfileHashMatch = assetProfileHash === req.hashAssetProfile;
    if (!isAssetProfileHashMatch) {
      throw new Error(`${fnTag}, assetProfile hash not match`);
    }
  }
  public async storeDataAfterTransferCommence(
    msg: TransferCommenceMessage,
    ack: TransferCommenceResponseMessage,
    sessionID: string,
  ): Promise<void> {
    const fnTag = "${this.className}#()storeDataAfterTransferCommence";
    if (!this.sessions.has(sessionID)) {
      throw new Error(`${fnTag}, sessionID not exist`);
    }

    const sessionData = this.sessions.get(sessionID);
    if (sessionData === undefined) {
      throw new Error(`${fnTag}, session data undefined`);
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
    const fnTag = `${this.className}#checkValidLockEvidenceRequest()`;

    if (req.messageType != "urn:ietf:odap:msgtype:lock-evidence-req-msg") {
      await this.Revert(sessionID);
      throw new Error(`${fnTag}, wrong message type for lock evidence`);
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
      await this.Revert(req.sessionID);
      throw new Error(`${fnTag}, signature verify failed`);
    }

    const isLockEvidenceClaimValid = await this.checkValidLockEvidenceClaim(
      req.lockEvidenceClaim,
    );
    if (!isLockEvidenceClaimValid) {
      await this.Revert(req.sessionID);
      throw new Error(`${fnTag} invalid of server identity pubkey`);
    }
    const sessionData = this.sessions.get(sessionID);
    if (sessionData === undefined) {
      await this.Revert(req.sessionID);
      throw new Error(`${fnTag}, sessionID non exist`);
    }

    const isPrevAckHash: boolean =
      sessionData.commenceAckHash !== undefined &&
      sessionData.commenceAckHash == req.hashCommenceAckRequest;
    if (!isPrevAckHash) {
      await this.Revert(req.sessionID);
      throw new Error(`${fnTag}, previous ack hash not match`);
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
    const fnTag = "${this.className}#()storeDataAfterLockEvidenceRequest";
    if (!this.sessions.has(sessionID)) {
      await this.Revert(req.sessionID);
      throw new Error(`${fnTag}, sessionID not exist`);
    }

    const sessionData = this.sessions.get(sessionID);
    if (sessionData === undefined) {
      await this.Revert(req.sessionID);
      throw new Error(`${fnTag}, session data undefined`);
    }

    sessionData.lockEvidenceClaim = req.lockEvidenceClaim;
    sessionData.clientSignatureForLockEvidence = req.clientSignature;
    sessionData.lockEvidenceAckHash = SHA256(JSON.stringify(ack)).toString();
    sessionData.serverSignatureForLockEvidence = ack.serverSignature;

    this.sessions.set(sessionID, sessionData);
  }
  public async checkValidCommitPreparationRequest(
    req: CommitPreparationMessage,
    sessionID: string,
  ): Promise<void> {
    const fnTag = `${this.className}#checkValidCommitPreparationRequest()`;

    if (req.messageType != "urn:ietf:odap:msgtype:commit-prepare-msg") {
      await this.Revert(req.sessionID);
      throw new Error(`${fnTag}, wrong message type for commit prepare`);
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
      await this.Revert(req.sessionID);
      throw new Error(`${fnTag}, signature verify failed`);
    }

    const sessionData = this.sessions.get(sessionID);
    if (sessionData === undefined) {
      await this.Revert(req.sessionID);
      throw new Error(`${fnTag}, sessionID non exist`);
    }

    const isPrevAckHash: boolean =
      sessionData.lockEvidenceAckHash !== undefined &&
      sessionData.lockEvidenceAckHash == req.hashLockEvidenceAck;
    if (!isPrevAckHash) {
      await this.Revert(req.sessionID);
      throw new Error(`${fnTag}, previous ack hash not match`);
    }
  }
  public async storeDataAfterCommitPreparationRequest(
    req: CommitPreparationMessage,
    ack: CommitPreparationResponse,
    sessionID: string,
  ): Promise<void> {
    const fnTag = "${this.className}#()storeDataAfterCommitPreparationRequest";
    if (!this.sessions.has(sessionID)) {
      await this.Revert(req.sessionID);
      throw new Error(`${fnTag}, sessionID not exist`);
    }

    const sessionData = this.sessions.get(sessionID);
    if (sessionData === undefined) {
      await this.Revert(req.sessionID);
      throw new Error(`${fnTag}, session data undefined`);
    }

    sessionData.commitPrepareReqHash = ack.hashCommitPrep;
    sessionData.commitPrepareAckHash = SHA256(JSON.stringify(ack)).toString();
    sessionData.clientSignatureForCommitPreparation = req.clientSignature;
    sessionData.serverSignatureForCommitPreparation = ack.serverSignature;
    this.sessions.set(sessionID, sessionData);
  }
  public async checkValidCommitFinalRequest(
    req: CommitFinalMessage,
    sessionID: string,
  ): Promise<void> {
    const fnTag = `${this.className}#checkValidCommitFinalRequest()`;

    if (req.messageType != "urn:ietf:odap:msgtype:commit-final-msg") {
      await this.Revert(req.sessionID);
      throw new Error(`${fnTag}, wrong message type for commit final`);
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
      await this.Revert(req.sessionID);
      throw new Error(`${fnTag}, signature verify failed`);
    }

    const sessionData = this.sessions.get(sessionID);
    if (sessionData === undefined) {
      await this.Revert(req.sessionID);
      throw new Error(`${fnTag}, sessionID non exist`);
    }

    const isPrevAckHash: boolean =
      sessionData.commitPrepareAckHash !== undefined &&
      sessionData.commitPrepareAckHash == req.hashCommitPrepareAck;
    if (!isPrevAckHash) {
      await this.Revert(req.sessionID);
      throw new Error(`${fnTag}, previous ack hash not match`);
    }
  }
  public async storeDataAfterCommitFinalRequest(
    req: CommitFinalMessage,
    ack: CommitFinalResponseMessage,
    sessionID: string,
  ): Promise<void> {
    const fnTag = "${this.className}#()storeDataAfterCommitFinalRequest";
    if (!this.sessions.has(sessionID)) {
      await this.Revert(req.sessionID);
      throw new Error(`${fnTag}, sessionID not exist`);
    }

    const sessionData = this.sessions.get(sessionID);
    if (sessionData === undefined) {
      await this.Revert(req.sessionID);
      throw new Error(`${fnTag}, session data undefined`);
    }
    sessionData.commitFinalClaim = req.commitFinalClaim;
    sessionData.commitAckClaim = ack.commitAcknowledgementClaim;
    sessionData.clientSignatureForCommitFinal = req.clientSignature;
    sessionData.serverSignatureForCommitFinal = ack.serverSignature;
    sessionData.commitFinalReqHash = ack.hashCommitFinal;
    sessionData.commitFinalAckHash = SHA256(JSON.stringify(ack)).toString();
    this.sessions.set(sessionID, sessionData);
  }
  public async CheckValidTransferCompleteRequest(
    req: TransferCompleteMessage,
    sessionID: string,
  ): Promise<void> {
    const fnTag = `${this.className}#checkValidTransferCompleteRequest()`;

    if (
      req.messageType != "urn:ietf:odap:msgtype:commit-transfer-complete-msg"
    ) {
      await this.Revert(req.sessionID);
      throw new Error(`${fnTag}, wrong message type for transfer complete`);
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
      await this.Revert(req.sessionID);
      throw new Error(`${fnTag}, signature verify failed`);
    }

    const sessionData = this.sessions.get(sessionID);
    if (sessionData === undefined) {
      await this.Revert(req.sessionID);
      throw new Error(`${fnTag}, sessionID non exist`);
    }

    const isCommmitFinalAckHash: boolean =
      sessionData.commitFinalAckHash !== undefined &&
      sessionData.commitFinalAckHash == req.hashCommitFinalAck;
    if (!isCommmitFinalAckHash) {
      await this.Revert(req.sessionID);
      throw new Error(`${fnTag}, previous commit final ack hash not match`);
    }

    const isTransferCommenceHash: boolean =
      sessionData.commenceReqHash !== undefined &&
      sessionData.commenceReqHash == req.hashTransferCommence;
    if (!isTransferCommenceHash) {
      await this.Revert(req.sessionID);
      throw new Error(`${fnTag}, previous transfer commence hash not match`);
    }
  }
  public async SendClientRequest(req: SendClientRequestMessage): Promise<void> {
    const fnTag = `${this.className}#sendClientRequest()`;
    const odapServerApiConfig = new Configuration({
      basePath: req.serverGatewayConfiguration.apiHost,
    });
    const odapServerApiClient = new OdapApi(odapServerApiConfig);
    const initializationRequestMessage: InitializationRequestMessage = {
      version: req.version,
      loggingProfile: req.loggingProfile,
      accessControlProfile: req.accessControlProfile,
      applicationProfile: req.applicationProfile,
      payloadProfile: req.payLoadProfile,
      initializationRequestMessageSignature: "",
      sourceGatewayPubkey: this.pubKey,
      sourceGateWayDltSystem: req.sourceGateWayDltSystem,
      recipientGateWayPubkey: req.recipientGateWayPubkey,
      recipientGateWayDltSystem: req.recipientGateWayDltSystem,
    };
    //TODO: task for storage here: how to get sessionID?
    //const dummyPrivKeyStr = odapGateWay.bufArray2HexStr(dummyPrivKeyBytes);
    /*initializationRequestMessage.initializationRequestMessageSignature = await odapGateWay.sign(
      JSON.stringify(initializationRequestMessage),
      dummyPrivKeyStr,
    );
   */
    initializationRequestMessage.initializationRequestMessageSignature = "";
    const initializeReqSignature = await this.odapGatewaySign(
      JSON.stringify(initializationRequestMessage),
    );
    initializationRequestMessage.initializationRequestMessageSignature = initializeReqSignature;

    const transferInitiationRes = await odapServerApiClient.apiV1Phase1TransferInitiation(
      initializationRequestMessage,
    );
    const initializeReqAck: InitialMessageAck = transferInitiationRes.data;
    if (transferInitiationRes.status != 200) {
      throw new Error(`${fnTag}, send transfer initiation failed`);
    }
    const serverIdentityPubkey =
      transferInitiationRes.data.serverIdentityPubkey;
    initializationRequestMessage.initializationRequestMessageSignature = initializeReqSignature;
    const initializationMsgHash = SHA256(
      JSON.stringify(initializationRequestMessage),
    ).toString();
    if (initializeReqAck.initialRequestMessageHash != initializationMsgHash) {
      throw new Error(
        `${fnTag}, initial message hash not match from initial message ack`,
      );
    }
    //store ack
    const sessionID = initializeReqAck.sessionID;
    const sessionData: SessionData = {};
    sessionData.step = 0;
    await this.odapLog(
      {
        phase: "initiateTransfer",
        operation: "receive-ack",
        step: sessionData.step.toString(),
        nodes: `${serverIdentityPubkey}->${this.pubKey}`,
      },
      `${sessionID}-${sessionData.step.toString()}`,
    );
    sessionData.step++;
    const hashAssetProfile = SHA256(
      JSON.stringify(req.assetProfile),
    ).toString();

    const transferCommenceReq: TransferCommenceMessage = {
      sessionID: sessionID,
      messageType: "urn:ietf:odap:msgtype:transfer-commence-msg",
      originatorPubkey: req.originatorPubkey,
      beneficiaryPubkey: req.beneficiaryPubkey,
      clientIdentityPubkey: this.pubKey,
      serverIdentityPubkey: serverIdentityPubkey,
      hashPrevMessage: initializationMsgHash,
      hashAssetProfile: hashAssetProfile,
      senderDltSystem: req.clientDltSystem,
      recipientDltSystem: req.recipientGateWayDltSystem,
      clientSignature: "",
    };
    const transferCommenceReqSignature = await this.odapGatewaySign(
      JSON.stringify(transferCommenceReq),
    );
    transferCommenceReq.clientSignature = transferCommenceReqSignature;

    const transferCommenceReqHash = SHA256(
      JSON.stringify(transferCommenceReq),
    ).toString();
    //store req
    await this.odapLog(
      {
        phase: "transfer-commence",
        operation: "send-req",
        step: sessionData.step.toString(),
        nodes: `${this.pubKey}->${serverIdentityPubkey}`,
      },
      `${sessionID}-${sessionData.step.toString()}`,
    );
    sessionData.step++;
    const transferCommenceRes = await odapServerApiClient.apiV1Phase2TransferCommence(
      transferCommenceReq,
    );
    if (transferCommenceRes.status != 200) {
      await this.Revert(sessionID);
      throw new Error(`${fnTag}, send transfer commence failed`);
    }
    const transferCommenceAck: TransferCommenceResponseMessage =
      transferCommenceRes.data;
    if (transferCommenceReqHash != transferCommenceAck.hashCommenceRequest) {
      await this.Revert(sessionID);
      throw new Error(
        `${fnTag}, transfer commence req hash not match from transfer commence ack`,
      );
    }
    if (
      transferCommenceReq.serverIdentityPubkey !=
      transferCommenceAck.serverIdentityPubkey
    ) {
      await this.Revert(sessionID);
      throw new Error(
        `${fnTag}, serverIdentity pub key not match from transfer commence ack`,
      );
    }
    if (
      transferCommenceReq.clientIdentityPubkey !=
      transferCommenceAck.clientIdentityPubkey
    ) {
      await this.Revert(sessionID);
      throw new Error(
        `${fnTag}, clientIdentity pub key not match from transfer commence ack`,
      );
    }

    const transferCommenceAckSignature = transferCommenceAck.serverSignature;

    const transferCommenceAckSignatureHex = new Uint8Array(
      Buffer.from(transferCommenceAckSignature, "hex"),
    );
    const sourcePubkey = new Uint8Array(
      Buffer.from(serverIdentityPubkey, "hex"),
    );
    transferCommenceAck.serverSignature = "";
    if (
      !secp256k1.ecdsaVerify(
        transferCommenceAckSignatureHex,
        Buffer.from(
          SHA256(JSON.stringify(transferCommenceAck)).toString(),
          "hex",
        ),
        sourcePubkey,
      )
    ) {
      await this.Revert(sessionID);
      throw new Error(
        `${fnTag}, transfer commence ack signature verify failed`,
      );
    }
    transferCommenceAck.serverSignature = transferCommenceAckSignature;
    //store ack
    await this.odapLog(
      {
        phase: "transfer-commence",
        operation: "receive-ack",
        step: sessionData.step.toString(),
        nodes: `${serverIdentityPubkey}->${this.pubKey}`,
      },
      `${sessionID}-${sessionData.step.toString()}`,
    );
    sessionData.step++;
    const commenceAckHash = SHA256(
      JSON.stringify(transferCommenceAck),
    ).toString();
    //probably a weird place to set sessionID, but need it in Revert function
    //or sessions.get(sessionID) would be undefined
    //and just return
    this.sessions.set(sessionID, sessionData);
    let fabricLockAssetProof = "";
    if (this.fabricApi != undefined) {
      const lockRes = await this.fabricApi.runTransactionV1({
        signingCredential: this.fabricSigningCredential,
        channelName: this.fabricChannelName,
        contractName: this.fabricContractName,
        invocationType: FabricContractInvocationType.Send,
        methodName: "LockAsset",
        params: [this.fabricAssetID],
      } as FabricRunTransactionRequest);
      const receiptLockRes = await this.fabricApi.getTransactionReceiptByTxIDV1(
        {
          signingCredential: this.fabricSigningCredential,
          channelName: this.fabricChannelName,
          contractName: "qscc",
          invocationType: FabricContractInvocationType.Call,
          methodName: "GetBlockByTxID",
          params: [this.fabricChannelName, lockRes.data.transactionId],
        } as FabricRunTransactionRequest,
      );
      this.log.warn(receiptLockRes.data);
      fabricLockAssetProof = JSON.stringify(receiptLockRes.data);
      if (sessionData == undefined) {
        await this.Revert(sessionID);
        throw new Error(`${fnTag}, session data undefined`);
      }
      sessionData.isFabricAssetLocked = true;
    }
    const lockEvidenceReq: LockEvidenceMessage = {
      sessionID: sessionID,
      messageType: "urn:ietf:odap:msgtype:lock-evidence-req-msg",
      clientIdentityPubkey: req.clientIdentityPubkey,
      serverIdentityPubkey: req.serverIdentityPubkey,
      clientSignature: "",
      hashCommenceAckRequest: commenceAckHash,
      lockEvidenceClaim: fabricLockAssetProof,
      lockEvidenceExpiration: " ",
    };
    lockEvidenceReq.clientSignature = await this.odapGatewaySign(
      JSON.stringify(lockEvidenceReq),
    );
    const lockEvidenceReqHash = SHA256(
      JSON.stringify(lockEvidenceReq),
    ).toString();
    //store req
    await this.odapLog(
      {
        phase: "lock-evidence-req",
        operation: "send-req",
        step: sessionData.step.toString(),
        nodes: `${this.pubKey}->${serverIdentityPubkey}`,
      },
      `${sessionID}-${sessionData.step.toString()}`,
    );
    sessionData.step++;
    const lockEvidenceRes = await odapServerApiClient.apiV1Phase2LockEvidence(
      lockEvidenceReq,
    );
    if (lockEvidenceRes.status != 200) {
      await this.Revert(sessionID);
      throw new Error(`${fnTag}, send lock evidence failed`);
    }
    const lockEvidenceAck: LockEvidenceResponseMessage = lockEvidenceRes.data;
    const lockEvidenceAckHash = SHA256(
      JSON.stringify(lockEvidenceAck),
    ).toString();

    if (lockEvidenceReqHash != lockEvidenceAck.hashLockEvidenceRequest) {
      await this.Revert(sessionID);
      throw new Error(
        `${fnTag}, lock evidence req hash not match from lock evidence ack`,
      );
    }
    if (
      lockEvidenceReq.serverIdentityPubkey !=
      lockEvidenceAck.serverIdentityPubkey
    ) {
      await this.Revert(sessionID);
      throw new Error(
        `${fnTag}, lock evidence serverIdentity pub key not match from lock evidence ack`,
      );
    }

    if (
      lockEvidenceReq.clientIdentityPubkey !=
      lockEvidenceAck.clientIdentityPubkey
    ) {
      await this.Revert(sessionID);
      throw new Error(
        `${fnTag}, lock evidence clientIdentity pub key not match from lock evidence ack`,
      );
    }
    const lockEvidenceAckSignature = lockEvidenceAck.serverSignature;

    const lockEvidenceAckSignatureHex = new Uint8Array(
      Buffer.from(lockEvidenceAckSignature, "hex"),
    );
    lockEvidenceAck.serverSignature = "";
    if (
      !secp256k1.ecdsaVerify(
        lockEvidenceAckSignatureHex,
        Buffer.from(SHA256(JSON.stringify(lockEvidenceAck)).toString(), "hex"),
        sourcePubkey,
      )
    ) {
      await this.Revert(sessionID);
      throw new Error(`${fnTag}, lock evidence ack signature verify failed`);
    }
    lockEvidenceAck.serverSignature = transferCommenceAckSignature;
    //store ack
    await this.odapLog(
      {
        phase: "lock-evidence-req",
        operation: "receive-ack",
        step: sessionData.step.toString(),
        nodes: `${serverIdentityPubkey}->${this.pubKey}`,
      },
      `${sessionID}-${sessionData.step.toString()}`,
    );
    sessionData.step++;
    const commitPrepareReq: CommitPreparationMessage = {
      sessionID: sessionID,
      messageType: "urn:ietf:odap:msgtype:commit-prepare-msg",
      clientIdentityPubkey: req.clientIdentityPubkey,
      serverIdentityPubkey: req.serverIdentityPubkey,
      clientSignature: "",
      hashLockEvidenceAck: lockEvidenceAckHash,
    };
    commitPrepareReq.clientSignature = await this.odapGatewaySign(
      JSON.stringify(commitPrepareReq),
    );
    const commitPrepareHash = SHA256(
      JSON.stringify(commitPrepareReq),
    ).toString();
    //store req
    await this.odapLog(
      {
        phase: "commit-prepare",
        operation: "send-req",
        step: sessionData.step.toString(),
        nodes: `${this.pubKey}->${serverIdentityPubkey}`,
      },
      `${sessionID}-${sessionData.step.toString()}`,
    );
    sessionData.step++;
    const commitPrepareRes = await odapServerApiClient.apiV1Phase3CommitPreparation(
      commitPrepareReq,
    );
    if (commitPrepareRes.status != 200) {
      await this.Revert(sessionID);
      throw new Error(`${fnTag}, send commit prepare failed`);
    }
    const commitPrepareAck: CommitPreparationResponse = commitPrepareRes.data;
    const commitPrepareAckHash = SHA256(
      JSON.stringify(commitPrepareAck),
    ).toString();
    if (commitPrepareHash != commitPrepareAck.hashCommitPrep) {
      await this.Revert(sessionID);
      throw new Error(
        `${fnTag}, commit prepare hash not match from commit prepare ack`,
      );
    }
    if (
      commitPrepareReq.serverIdentityPubkey !=
      commitPrepareAck.serverIdentityPubkey
    ) {
      await this.Revert(sessionID);
      throw new Error(
        `${fnTag}, commit prepare serverIdentity pub key not match from commit prepare ack`,
      );
    }
    if (
      commitPrepareReq.clientIdentityPubkey !=
      commitPrepareAck.clientIdentityPubkey
    ) {
      await this.Revert(sessionID);
      throw new Error(
        `${fnTag}, commit prepare clientIdentity pub key not match from commit prepare ack`,
      );
    }

    const commitPrepareAckSignature = commitPrepareAck.serverSignature;

    const commitPrepareAckSignatureHex = new Uint8Array(
      Buffer.from(commitPrepareAckSignature, "hex"),
    );
    commitPrepareAck.serverSignature = "";
    if (
      !secp256k1.ecdsaVerify(
        commitPrepareAckSignatureHex,
        Buffer.from(SHA256(JSON.stringify(commitPrepareAck)).toString(), "hex"),
        sourcePubkey,
      )
    ) {
      await this.Revert(sessionID);
      throw new Error(`${fnTag}, commit prepare ack signature verify failed`);
    }
    commitPrepareAck.serverSignature = commitPrepareAckSignature;
    //store ack
    await this.odapLog(
      {
        phase: "commit-prepare",
        operation: "receive-ack",
        step: sessionData.step.toString(),
        nodes: `${serverIdentityPubkey}->${this.pubKey}`,
      },
      `${sessionID}-${sessionData.step.toString()}`,
    );
    sessionData.step++;
    let fabricDeleteAssetProof = "";
    if (this.fabricApi != undefined) {
      const deleteRes = await this.fabricApi.runTransactionV1({
        signingCredential: this.fabricSigningCredential,
        channelName: this.fabricChannelName,
        contractName: this.fabricContractName,
        invocationType: FabricContractInvocationType.Send,
        methodName: "DeleteAsset",
        params: [this.fabricAssetID],
      } as FabricRunTransactionRequest);
      const receiptDeleteRes = await this.fabricApi.getTransactionReceiptByTxIDV1(
        {
          signingCredential: this.fabricSigningCredential,
          channelName: this.fabricChannelName,
          contractName: "qscc",
          invocationType: FabricContractInvocationType.Call,
          methodName: "GetBlockByTxID",
          params: [this.fabricChannelName, deleteRes.data.transactionId],
        } as FabricRunTransactionRequest,
      );
      this.log.warn(receiptDeleteRes.data);
      fabricDeleteAssetProof = JSON.stringify(receiptDeleteRes.data);
      sessionData.isFabricAssetDeleted = true;
    }
    const commitFinalReq: CommitFinalMessage = {
      sessionID: sessionID,
      messageType: "urn:ietf:odap:msgtype:commit-final-msg",
      clientIdentityPubkey: req.clientIdentityPubkey,
      serverIdentityPubkey: req.serverIdentityPubkey,
      clientSignature: "",
      hashCommitPrepareAck: commitPrepareAckHash,
      commitFinalClaim: fabricDeleteAssetProof,
    };
    commitFinalReq.clientSignature = await this.odapGatewaySign(
      JSON.stringify(commitFinalReq),
    );
    const commitFinalReqHash = SHA256(
      JSON.stringify(commitFinalReq),
    ).toString();
    await this.odapLog(
      {
        phase: "commit-final",
        operation: "send-req",
        step: sessionData.step.toString(),
        nodes: `${this.pubKey}->${serverIdentityPubkey}`,
      },
      `${sessionID}-${sessionData.step.toString()}`,
    );
    sessionData.step++;
    const commitFinalRes = await odapServerApiClient.apiV1Phase3CommitFinal(
      commitFinalReq,
    );
    if (commitFinalRes.status != 200) {
      await this.Revert(sessionID);
      throw new Error(`${fnTag}, send commit final failed`);
    }
    const commitFinalAck: CommitFinalResponseMessage = commitFinalRes.data;
    const commitFinalAckHash = SHA256(
      JSON.stringify(commitFinalAck),
    ).toString();
    if (commitFinalReqHash != commitFinalAck.hashCommitFinal) {
      await this.Revert(sessionID);
      throw new Error(
        `${fnTag}, commit final req hash not match from commit final ack`,
      );
    }
    if (
      commitFinalReq.serverIdentityPubkey != commitFinalAck.serverIdentityPubkey
    ) {
      await this.Revert(sessionID);
      throw new Error(
        `${fnTag}, commit final serverIdentity pub key not match from commit final ack`,
      );
    }
    const commitFinalAckSignature = commitFinalAck.serverSignature;

    const commitFinalAckSignatureHex = new Uint8Array(
      Buffer.from(commitFinalAckSignature, "hex"),
    );
    commitFinalAck.serverSignature = "";
    if (
      !secp256k1.ecdsaVerify(
        commitFinalAckSignatureHex,
        Buffer.from(SHA256(JSON.stringify(commitFinalAck)).toString(), "hex"),
        sourcePubkey,
      )
    ) {
      await this.Revert(sessionID);
      throw new Error(`${fnTag}, commit final ack signature verify failed`);
    }
    commitFinalAck.serverSignature = commitFinalAckSignature;
    //store ack
    await this.odapLog(
      {
        phase: "commit-final",
        operation: "receive-ack",
        step: sessionData.step.toString(),
        nodes: `${serverIdentityPubkey}->${this.pubKey}`,
      },
      `${sessionID}-${sessionData.step.toString()}`,
    );
    sessionData.step++;
    const transferCompleteReq: TransferCompleteMessage = {
      sessionID: sessionID,
      messageType: "urn:ietf:odap:msgtype:commit-transfer-complete-msg",
      clientIdentityPubkey: req.clientIdentityPubkey,
      serverIdentityPubkey: req.serverIdentityPubkey,
      clientSignature: "",
      hashTransferCommence: transferCommenceReqHash,
      hashCommitFinalAck: commitFinalAckHash,
    };
    transferCompleteReq.clientSignature = await this.odapGatewaySign(
      JSON.stringify(transferCompleteReq),
    );
    await this.odapLog(
      {
        phase: "transfer-complete",
        operation: "send-req",
        step: sessionData.step.toString(),
        nodes: `${this.pubKey}`,
      },
      `${sessionID}-${sessionData.step.toString()}`,
    );
    sessionData.step++;
    this.sessions.set(sessionID, sessionData);
    await odapServerApiClient.apiV1Phase3TransferComplete(transferCompleteReq);
  }
}
