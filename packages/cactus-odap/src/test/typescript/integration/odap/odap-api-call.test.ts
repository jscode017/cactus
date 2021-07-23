import http from "http";
import { AddressInfo } from "net";
import secp256k1 from "secp256k1";
import test, { Test } from "tape-promise/tape";
import { v4 as uuidv4 } from "uuid";
import { randomBytes } from "crypto";

import bodyParser from "body-parser";
import express from "express";

import { PluginRegistry } from "@hyperledger/cactus-core";

import {
  IListenOptions,
  LogLevelDesc,
  Servers,
} from "@hyperledger/cactus-common";

import { PluginKeychainMemory } from "@hyperledger/cactus-plugin-keychain-memory";

import {
  DefaultApi as OdapApi,
  InitializationRequestMessage,
} from "../../../../main/typescript/public-api";

import {
  IOdapGateWayCactusPluginOptions,
  OdapGateWayCactusPlugin,
} from "../../../../main/typescript/business-logic-plugin/odap-gateway-cactus-plugin";
import { Configuration } from "@hyperledger/cactus-core-api";
import {
  OdapGateway,
  OdapGatewayConstructorOptions,
} from "../../../../main/typescript/gateway/odap-gateway";

/**
 * Use this to debug issues with the fabric node SDK
 * ```sh
 * export HFC_LOGGING='{"debug":"console","info":"console"}'
 * ```
 */

const testCase = "runs odap gateway tests via openApi";

test(testCase, async (t: Test) => {
  //const logLevel: LogLevelDesc = "TRACE";

  const pluginRegistry = new PluginRegistry();

  const expressApp = express();
  expressApp.use(bodyParser.json({ limit: "250mb" }));
  const server = http.createServer(expressApp);
  const listenOptions: IListenOptions = {
    hostname: "localhost",
    port: 0,
    server,
  };
  const addressInfo = (await Servers.listen(listenOptions)) as AddressInfo;
  test.onFinish(async () => await Servers.shutdown(server));
  const { address, port } = addressInfo;
  const apiHost = `http://${address}:${port}`;
  t.comment(
    `Metrics URL: ${apiHost}/api/v1/plugins/@hyperledger/cactus-plugin-ledger-connector-fabric/get-prometheus-exporter-metrics`,
  );
  const apiConfig = new Configuration({ basePath: apiHost });
  const apiClient = new OdapApi(apiConfig);
  const odapClientGateWayPluginID = uuidv4();
  const odapPluginOptions: IOdapGateWayCactusPluginOptions = {
    instanceId: odapClientGateWayPluginID,
  };

  const plugin = new OdapGateWayCactusPlugin(odapPluginOptions);
  await plugin.getOrCreateWebServices();
  await plugin.registerWebServices(expressApp);
  pluginRegistry.add(plugin);
  {
    let dummyPrivKeyBytes = randomBytes(32);
    while (!secp256k1.privateKeyVerify(dummyPrivKeyBytes)) {
      dummyPrivKeyBytes = randomBytes(32);
    }
    const dummyPubKeyBytes = secp256k1.publicKeyCreate(dummyPrivKeyBytes);
    const dummyOdapConstructor = {
      name: "cactus-plugin#odapGateway",
      dltIDs: ["dummy"],
      instanceID: uuidv4(),
    };
    const dummyOdapGateWay = new OdapGateway(dummyOdapConstructor);
    const dummyPubKey = dummyOdapGateWay.bufArray2HexStr(dummyPubKeyBytes);

    const initializationRequestMessage: InitializationRequestMessage = {
      version: "0.0.0",
      loggingProfile: "dummy",
      accessControlProfile: "dummy",
      applicationProfile: "dummy",
      payloadProfile: {
        assetProfile: "dummy",
        capabilities: "",
      },
      initializationRequestMessageSignature: "",
      sourceGatewayPubkey: dummyPubKey,
      sourceGateWayDltSystem: "dummy",
      recipientGateWayPubkey: dummyPubKey,
      recipientGateWayDltSystem: "dummy",
    };
    const dummyPrivKeyStr = dummyOdapGateWay.bufArray2HexStr(dummyPrivKeyBytes);
    initializationRequestMessage.initializationRequestMessageSignature = await dummyOdapGateWay.sign(
      JSON.stringify(initializationRequestMessage),
      dummyPrivKeyStr,
    );
    /*const odapConnector = pluginRegistry.plugins.find(
      (plugin) => plugin.getInstanceId() == odapClientGateWayPluginID,
    ) as ;*/
    const res = await apiClient.apiV1Phase1TransferInitiation(
      initializationRequestMessage,
    );
    console.log(res);
    t.ok(res);
    //t.equal(res.status, 200);
  }
  t.end();
});
