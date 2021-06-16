import {
  InitializationRequestMessage,
  InitialMessageAck,
  TransferCommenceMessage,
  TransferCommenceResponseMessage,
} from "../generated/openapi/typescript-axios";
export class OdapGateway {
  static LockEvidenceTransferCommence(transferCommenceMessage: { MessageType: string; OriginatorPubkey: string; BefeficiaryPubkey: string; SenderDltSystem: {}; RecipientDltSystem: {}; ClientIdentityPubkey: string; ServerIdentityPubkey: string; HashAssetProfile: string; AssetUnit: number; HashPrevMessage: string; ClientTransferNumber: number; ClientSignature: string; }): void {
    throw new Error("Method not implemented.");
  }
  name: string;
  public constructor(name: string) {
    this.name = name;
  }
  public async InitiateTransfer(
    req: InitializationRequestMessage,
  ): Promise<InitialMessageAck> {
    const validInitializationRequest = await this.CheckValidInitializationRequest(
      req,
    );
    if (!validInitializationRequest) {
      throw new Error(`InitiateTransfer error, InitializationRequest Invalid`);
    }
    return { SessionID: "would filled out this later" };
  }
  public async LockEvidenceTransferCommence(
    req: TransferCommenceMessage,
  ): Promise<TransferCommenceResponseMessage> {
    const validTransferCommenceMessage = await this.CheckValidtransferCommenceRequest(
      req,
    );
    if (!validTransferCommenceMessage) {
      throw new Error(`transfer commence message type not match`);
    }
    return { MessageType: "urn:ietf:odap:msgtype:transfer-commence-msg" };
  }
  public async CheckValidtransferCommenceRequest(
    req: TransferCommenceMessage,
  ): Promise<boolean> {
    return req.MessageType == "urn:ietf:odap:msgtype:transfer-commence-msg";
  }
  public async CheckValidInitializationRequest(
    req: InitializationRequestMessage,
  ): Promise<boolean> {
    return req.Version == "0.0.0";
  }
}
