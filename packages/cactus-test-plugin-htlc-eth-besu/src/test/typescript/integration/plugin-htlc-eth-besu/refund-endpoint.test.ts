import http from "http";
import type { AddressInfo } from "net";
import test, { Test } from "tape-promise/tape";
import { v4 as uuidv4 } from "uuid";
import express from "express";
import bodyParser from "body-parser";
import Web3 from "web3";
import {
  Configuration,
  DefaultApi as BesuApi,
  IPluginHtlcEthBesuOptions,
  PluginFactoryHtlcEthBesu,
  NewContractObj,
  InitializeRequest,
  RefundReq,
} from "@hyperledger/cactus-plugin-htlc-eth-besu";
import {
  EthContractInvocationType,
  PluginFactoryLedgerConnector,
  PluginLedgerConnectorBesu,
  Web3SigningCredential,
  Web3SigningCredentialType,
} from "@hyperledger/cactus-plugin-ledger-connector-besu";
import {
  LogLevelDesc,
  IListenOptions,
  Servers,
} from "@hyperledger/cactus-common";
import { PluginRegistry } from "@hyperledger/cactus-core";
import { PluginImportType } from "@hyperledger/cactus-core-api";
import {
  BesuTestLedger,
  pruneDockerAllIfGithubAction,
} from "@hyperledger/cactus-test-tooling";
import { PluginKeychainMemory } from "@hyperledger/cactus-plugin-keychain-memory";
import { DataTest } from "../data-test";
import DemoHelperJSON from "../../../solidity/contracts/DemoHelpers.json";
import HashTimeLockJSON from "../../../../../../cactus-plugin-htlc-eth-besu/src/main/solidity/contracts/HashTimeLock.json";

const connectorId = uuidv4();
const logLevel: LogLevelDesc = "INFO";
const firstHighNetWorthAccount = "627306090abaB3A6e1400e9345bC60c78a8BEf57";
const privateKey =
  "c87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3";
const web3SigningCredential: Web3SigningCredential = {
  ethAccount: firstHighNetWorthAccount,
  secret: privateKey,
  type: Web3SigningCredentialType.PrivateKeyHex,
} as Web3SigningCredential;

const testCase = "Test refund";

test("BEFORE " + testCase, async (t: Test) => {
  const pruning = pruneDockerAllIfGithubAction({ logLevel });
  await t.doesNotReject(pruning, "Pruning did not throw OK");
  t.end();
});

test(testCase, async (t: Test) => {
  const timeout = (ms: number) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
  };
  t.comment("Starting Besu Test Ledger");
  const besuTestLedger = new BesuTestLedger({ logLevel });

  test.onFailure(async () => {
    await besuTestLedger.stop();
    await besuTestLedger.destroy();
  });

  await besuTestLedger.start();

  const rpcApiHttpHost = await besuTestLedger.getRpcApiHttpHost();
  const rpcApiWsHost = await besuTestLedger.getRpcApiWsHost();
  const keychainId = uuidv4();
  const keychainPlugin = new PluginKeychainMemory({
    instanceId: uuidv4(),
    keychainId,
    // pre-provision keychain with mock backend holding the private key of the
    // test account that we'll reference while sending requests with the
    // signing credential pointing to this keychain entry.
    backend: new Map([[DemoHelperJSON.contractName, DemoHelperJSON]]),
    logLevel,
  });
  keychainPlugin.set(HashTimeLockJSON.contractName, HashTimeLockJSON);

  const factory = new PluginFactoryLedgerConnector({
    pluginImportType: PluginImportType.Local,
  });

  const pluginRegistry = new PluginRegistry({});
  const connector: PluginLedgerConnectorBesu = await factory.create({
    rpcApiHttpHost,
    rpcApiWsHost,
    logLevel,
    instanceId: connectorId,
    pluginRegistry: new PluginRegistry({ plugins: [keychainPlugin] }),
  });

  pluginRegistry.add(connector);
  const pluginOptions: IPluginHtlcEthBesuOptions = {
    logLevel,
    instanceId: uuidv4(),
    pluginRegistry,
  };

  const factoryHTLC = new PluginFactoryHtlcEthBesu({
    pluginImportType: PluginImportType.Local,
  });

  const pluginHtlc = await factoryHTLC.create(pluginOptions);
  pluginRegistry.add(pluginHtlc);

  const expressApp = express();
  expressApp.use(bodyParser.json({ limit: "250mb" }));
  const server = http.createServer(expressApp);
  const listenOptions: IListenOptions = {
    hostname: "0.0.0.0",
    port: 0,
    server,
  };
  const addressInfo = (await Servers.listen(listenOptions)) as AddressInfo;
  test.onFinish(async () => await Servers.shutdown(server));
  const { address, port } = addressInfo;
  const apiHost = `http://${address}:${port}`;

  const configuration = new Configuration({ basePath: apiHost });
  const api = new BesuApi(configuration);

  await pluginHtlc.getOrCreateWebServices();
  await pluginHtlc.registerWebServices(expressApp);

  const web3 = new Web3(rpcApiHttpHost);

  t.comment("Deploys HashTimeLock via .json file on initialize function");
  const initRequest: InitializeRequest = {
    connectorId,
    keychainId,
    constructorArgs: [],
    web3SigningCredential,
    gas: DataTest.estimated_gas,
  };
  const deployOut = await pluginHtlc.initialize(initRequest);
  t.ok(
    deployOut.transactionReceipt,
    "pluginHtlc.initialize() output.transactionReceipt is truthy OK",
  );
  t.ok(
    deployOut.transactionReceipt.contractAddress,
    "pluginHtlc.initialize() output.transactionReceipt.contractAddress is truthy OK",
  );
  const hashTimeLockAddress = deployOut.transactionReceipt
    .contractAddress as string;

  //Deploy DemoHelpers
  t.comment("Deploys DemoHelpers via .json file on deployContract function");
  const deployOutDemo = await connector.deployContract({
    contractName: DemoHelperJSON.contractName,
    contractAbi: DemoHelperJSON.abi,
    bytecode: DemoHelperJSON.bytecode,
    web3SigningCredential,
    keychainId,
    constructorArgs: [],
    gas: DataTest.estimated_gas,
  });
  t.ok(deployOutDemo, "deployContract() output is truthy OK");
  t.ok(
    deployOutDemo.transactionReceipt,
    "deployContract() output.transactionReceipt is truthy OK",
  );
  t.ok(
    deployOutDemo.transactionReceipt.contractAddress,
    "deployContract() output.transactionReceipt.contractAddress is truthy OK",
  );

  t.comment("Get account balance");
  const balance1 = await web3.eth.getBalance(firstHighNetWorthAccount);

  t.comment("Get current timestamp");
  const { callOutput } = await connector.invokeContract({
    contractName: DemoHelperJSON.contractName,
    keychainId,
    signingCredential: web3SigningCredential,
    invocationType: EthContractInvocationType.Call,
    methodName: "getTimestamp",
    params: [],
  });
  t.ok(callOutput, "callOutput() output.callOutput is truthy OK");
  let timestamp = 0;
  timestamp = callOutput as number;
  timestamp = +timestamp + +10;

  t.comment("Create new contract for HTLC");
  const bodyObj: NewContractObj = {
    contractAddress: hashTimeLockAddress,
    inputAmount: 10,
    outputAmount: 0x04,
    expiration: timestamp,
    hashLock: DataTest.hashLock,
    receiver: DataTest.receiver,
    outputNetwork: "BTC",
    outputAddress: "1AcVYm7M3kkJQH28FXAvyBFQzFRL6xPKu8",
    connectorId: connectorId,
    web3SigningCredential,
    keychainId,
    gas: DataTest.estimated_gas,
  };
  const resp = await api.newContract(bodyObj);
  t.ok(resp, "response newContract is OK");
  t.equal(resp.status, 200, "response status newContract is OK");

  const responseTxId = await connector.invokeContract({
    contractName: DemoHelperJSON.contractName,
    keychainId,
    signingCredential: web3SigningCredential,
    invocationType: EthContractInvocationType.Call,
    methodName: "getTxId",
    params: [
      firstHighNetWorthAccount,
      DataTest.receiver,
      10,
      DataTest.hashLock,
      timestamp,
    ],
  });
  t.ok(responseTxId.callOutput, "result is truthy OK");
  const id = responseTxId.callOutput as string;
  t.comment("Refund HTLC");

  await timeout(6000);
  const refundRequest: RefundReq = {
    id,
    web3SigningCredential,
    connectorId,
    keychainId,
  };
  const refundResponse = await api.refund(refundRequest);
  t.equal(refundResponse.status, 200);

  t.comment("Get single status of HTLC");
  const balance = await web3.eth.getBalance(firstHighNetWorthAccount);
  t.equal(
    parseInt(balance),
    parseInt(balance1) - 10,
    "Balance of account is OK",
  );
  const balance2 = await web3.eth.getBalance(firstHighNetWorthAccount);
  t.equal(balance1, balance2, "Retrieved balance of test account OK");
  const res = await api.getSingleStatus(
    id,
    web3SigningCredential,
    connectorId,
    keychainId,
  );
  t.equal(res.status, 200);
  t.equal(res.data, 2, "the contract status is Refunded");
  await besuTestLedger.stop();
  await besuTestLedger.destroy();
  t.end();
});

test("AFTER " + testCase, async (t: Test) => {
  const pruning = pruneDockerAllIfGithubAction({ logLevel });
  await t.doesNotReject(pruning, "Pruning did not throw OK");
  t.end();
});
