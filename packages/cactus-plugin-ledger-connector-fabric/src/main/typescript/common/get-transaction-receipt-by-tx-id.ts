import { LoggerProvider, LogLevelDesc } from "@hyperledger/cactus-common";
import { Gateway } from "fabric-network";
import { GetTransactionReceiptResponse } from "../generated/openapi/typescript-axios";
import { common } from "fabric-protos";
const { BlockDecoder } = require("fabric-common");
export interface IGetTransactionReceiptByTxIDOptions {
  readonly logLevel?: LogLevelDesc;
  readonly gateway: Gateway;
  readonly channelName: string;
  readonly params: string[];
}
export async function getTransactionReceiptForLockContractByTxID(
  req: IGetTransactionReceiptByTxIDOptions,
): Promise<GetTransactionReceiptResponse> {
  const fnTag = `getTransactionReceiptForLockContractByTxID`;
  const log = LoggerProvider.getOrCreate({
    label: fnTag,
    level: req.logLevel || "INFO",
  });
  const { gateway } = req;

  const contractName = "qscc";
  const methodName = "GetBlockByTxID";
  if (req.params.length != 2) {
    throw new Error(`${fnTag}, should have 2 params`);
  }
  const network = await gateway.getNetwork(req.channelName);

  const contract = network.getContract(contractName);
  const out: Buffer = await contract.evaluateTransaction(
    methodName,
    ...req.params,
  );
  const reqTxID = req.params[1];
  const block: common.Block = BlockDecoder.decode(out);
  const blockJson = JSON.parse(JSON.stringify(block));
  log.warn(blockJson);
  log.warn("block number");
  log.warn(blockJson.header.number);
  //TODO: return block number
  const transactReceipt: GetTransactionReceiptResponse = {};
  transactReceipt.blockNumber = blockJson.header.number;
  const txIDs = [];
  if (block.data != undefined && block.data.data != undefined) {
    const blockDatas = block.data.data;
    log.warn("tranversing block datas");
    for (let i = 0; i < blockDatas.length; i++) {
      const blockData = JSON.parse(JSON.stringify(blockDatas[i]));
      log.warn("blockdata tranverse");
      if (
        blockData.payload == undefined ||
        blockData.payload.header == undefined ||
        blockData.payload.header.channel_header == undefined
      )
        continue;

      const payloadChannelHeader = blockData.payload.header.channel_header;
      if (payloadChannelHeader.tx_id != undefined) {
        txIDs.push(payloadChannelHeader.tx_id);
        if (payloadChannelHeader.tx_id != reqTxID) continue;
        log.warn("printing txid---");
        log.warn(payloadChannelHeader.tx_id);
        log.warn(blockData);
        log.warn("payloadchannelheader");
        log.warn(payloadChannelHeader);
        //TODO: get payloadChannelHeader channel_id
        transactReceipt.channelID = payloadChannelHeader.channel_id;
        log.warn("payloadchannel data");
        log.warn(blockData.payload.data);
        if (
          blockData.payload.data == undefined ||
          blockData.payload.data.actions == undefined
        ) {
          continue;
        }
        const payloadDataActions = blockData.payload.data.actions;
        log.warn("actions");
        log.warn(payloadDataActions);
        if (
          payloadDataActions[0].header == undefined ||
          payloadDataActions[0].payload == undefined
        )
          continue;
        const actionsHeader = payloadDataActions[0].header;
        const actionsPayload = payloadDataActions[0].payload;
        log.warn("actionsHeader");
        transactReceipt.transactionCreator = actionsHeader.creator;
        //TODO: get actionsHeader.creator for transaction creator
        log.warn(actionsHeader);
        log.warn("actionsPayload");
        log.warn(actionsPayload);
        if (actionsPayload.chaincode_proposal_payload == undefined) continue;
        const chainCodeProposal = actionsPayload.chaincode_proposal_payload;
        log.warn("chain code proposal");
        log.warn(chainCodeProposal);
        if (
          chainCodeProposal.input == undefined ||
          chainCodeProposal.input.chaincode_spec == undefined ||
          chainCodeProposal.input.chaincode_spec.chaincode_id == undefined
        )
          continue;
        /*const chainCodeID =
            chainCodeProposal.input.chaincode_spec.chaincode_id;
          log.warn("chainCodeID");
          log.warn(chainCodeID);
          //TODO: RETURN BACK CHAIN CODE ID
          transactReceipt.chainCodeID = chainCodeID;*/
        if (
          actionsPayload.action == undefined ||
          actionsPayload.action.proposal_response_payload == undefined ||
          actionsPayload.action.endorsements == undefined
        )
          continue;
        const proposalResponsePayload =
          actionsPayload.action.proposal_response_payload;
        const actionEndorsement = actionsPayload.action.endorsements;

        log.warn("actionEndorsement");
        log.warn(actionEndorsement);
        //TODO return this Endorsement array
        transactReceipt.transactionEndorsement = actionEndorsement;
        log.warn("proposal response payload");
        log.warn(proposalResponsePayload);
        if (proposalResponsePayload.extension == undefined) continue;

        const responseExtension = proposalResponsePayload.extension;
        if (responseExtension.chaincode_id == undefined) continue;
        const extensionChainCodeID = responseExtension.chaincode_id;
        log.warn("chaincode name and version");
        //TODO: return chaincode name and version
        transactReceipt.chainCodeName = extensionChainCodeID;
        log.warn(extensionChainCodeID.name);
        transactReceipt.chainCodeName = extensionChainCodeID.name;
        log.warn(extensionChainCodeID.version);
        transactReceipt.chainCodeVersion = extensionChainCodeID.version;
        if (
          responseExtension.response == undefined ||
          responseExtension.response.payload == undefined ||
          responseExtension.response.status == undefined
        )
          continue;
        const responseStatus = responseExtension.response.status;
        log.warn("responseStatus");
        log.warn(responseStatus);
        //TODO: return responseStatus
        transactReceipt.responseStatus = responseStatus;
        const extensionResponsePayload = responseExtension.response.payload;
        log.warn("extensionResponsePayload");
        log.warn(extensionResponsePayload);
        //log.warn(JSON.stringify(responseExtension, null, 4));
        if (
          responseExtension.results == undefined ||
          responseExtension.results.ns_rwset == undefined ||
          responseExtension.results.ns_rwset.length < 2
        ) {
          continue;
        }
        const extensionNsRwset = responseExtension.results.ns_rwset[1];
        if (extensionNsRwset.rwset == undefined) continue;

        const rwset = extensionNsRwset.rwset;
        if (rwset.writes == undefined) continue;
        const rwsetWrite = rwset.writes;
        log.warn("rwsetWrite");
        log.warn(rwsetWrite);
        if (rwsetWrite[0].key == undefined) continue;
        const rwsetKey = rwsetWrite[0].key;
        log.warn("rwsetKey");
        log.warn(rwsetKey);
        //TODO: return rwsetKey
        transactReceipt.rwsetKey = rwsetKey;
        if (
          rwsetWrite[0].value == undefined ||
          rwsetWrite[0].value.data == undefined
        )
          continue;
        const rwSetWriteData = rwsetWrite[0].value.data;
        log.warn("rwSetWriteData");
        log.warn(rwSetWriteData);
        log.warn(typeof rwSetWriteData[0]);
        // eslint-disable-next-line prefer-spread
        const rwSetWriteDataStr = String.fromCharCode.apply(
          String,
          rwSetWriteData,
        );
        log.warn("rwSetWriteDataStr");
        log.warn(rwSetWriteDataStr);
        //TODO: return rwSetWriteDataStr
        transactReceipt.rwsetWriteData = rwSetWriteDataStr;
        break;
      }
    }
    //TODO: return txIDs
  }
  if (block.metadata != undefined && block.metadata.metadata != undefined) {
    const metadata = block.metadata.metadata;
    log.warn("metadata");
    log.warn(JSON.stringify(metadata));
    //TODO: return metadata
    transactReceipt.blockMeteData = metadata;
  }
  return transactReceipt;
}
