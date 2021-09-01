# @hyperledger/cactus-odap-hermes
The package provides Cactus to standardize cross chain transaction

##### Using this we could perform:
- Negotiate between 2 parties intend to transfer asset on different ledger
- "Delete and lock asset on a ledger" then "create asset on another ledger" atomicly

##### Prerequisites
In the root of the project to install the dependencies execute the command:
`npm run configure`
**Compiling**:
In the project root folder, run this command to compile the plugin and create the dist directory:
`npm run tsc`

##### Basic sequence diagram:
The ODAP gateway intend to lock and delete its asset denoted as client ODAP gateway
The ODAP gateway intend to create new asset denoted as server ODAP gateway
![odap-sequence-diagram](https://mermaid.ink/img/eyJjb2RlIjoic2VxdWVuY2VEaWFncmFtXG4gICAgcGFydGljaXBhbnQgRW5kVXNlclxuICAgIHBhcnRpY2lwYW50IENsaWVudE9EQVBHYXRld2F5XG4gICAgcGFydGljaXBhbnQgSHlwZXJsZWRnZXJGYWJyaWNcbiAgICBwYXJ0aWNpcGFudCBTZXJ2ZXJPREFQR2F0ZXdheVxuICAgIHBhcnRpY2lwYW50IEh5cGVybGVkZ2VyQmVzdVxuICAgIEVuZFVzZXItPj5DbGllbnRPREFQR2F0ZXdheTogc2VuZCBjbGllbnQgcmVxdWVzdFxuICAgIENsaWVudE9EQVBHYXRld2F5LT4-U2VydmVyT0RBUEdhdGV3YXk6ICB0cmFuc2ZlciBpbml0aWF0aW9uIHJlcXVlc3RcbiAgICBTZXJ2ZXJPREFQR2F0ZXdheS0tPj5DbGllbnRPREFQR2F0ZXdheTogdHJhbnNmZXIgaW5pdGlhdGlvbiBhY2tcbiAgICBDbGllbnRPREFQR2F0ZXdheS0-PlNlcnZlck9EQVBHYXRld2F5OiAgdHJhbnNmZXIgY29tbWVuY2UgcmVxdWVzdFxuICAgIFNlcnZlck9EQVBHYXRld2F5LS0-PkNsaWVudE9EQVBHYXRld2F5OiB0cmFuc2ZlciBjb21tZW5jZSBhY2tcbiAgICBDbGllbnRPREFQR2F0ZXdheS0-Pkh5cGVybGVkZ2VyRmFicmljOiBsb2NrIGFzc2V0XG4gICAgSHlwZXJsZWRnZXJGYWJyaWMtLT4-Q2xpZW50T0RBUEdhdGV3YXk6IHRyYW5zYWN0aW9uIHJlY2VpcHQgZm9yIGxvY2tpbmcgYXNzZXRcbiAgICBDbGllbnRPREFQR2F0ZXdheS0-PlNlcnZlck9EQVBHYXRld2F5OiAgbG9jayBldmlkZW5jZSByZXF1ZXN0XG4gICAgU2VydmVyT0RBUEdhdGV3YXktPj5DbGllbnRPREFQR2F0ZXdheTogbG9jayBldmlkZW5jZSBhY2tcbiAgICBDbGllbnRPREFQR2F0ZXdheS0-PlNlcnZlck9EQVBHYXRld2F5OiAgY29tbWl0IHByZXBhcmUgcmVxdWVzdFxuICAgIFNlcnZlck9EQVBHYXRld2F5LS0-PkNsaWVudE9EQVBHYXRld2F5OiBjb21taXQgcHJlcGFyZSBhY2tcbiAgICBDbGllbnRPREFQR2F0ZXdheS0-Pkh5cGVybGVkZ2VyRmFicmljOiBkZWxldGUgYXNzZXRcbiAgICBIeXBlcmxlZGdlckZhYnJpYy0tPj5DbGllbnRPREFQR2F0ZXdheTogdHJhbnNhY3Rpb24gcmVjZWlwdCBmb3IgZGVsZXRpbmcgYXNzZXRcbiAgICBDbGllbnRPREFQR2F0ZXdheS0-PlNlcnZlck9EQVBHYXRld2F5OiAgY29tbWl0IGZpbmFsIHJlcXVlc3RcbiAgICBTZXJ2ZXJPREFQR2F0ZXdheS0-Pkh5cGVybGVkZ2VyQmVzdTogY3JlYXRlIGFzc2V0XG4gICAgSHlwZXJsZWRnZXJCZXN1LS0-PlNlcnZlck9EQVBHYXRld2F5OiB0cmFuc2FjdGlvbiByZWNlaXB0IGZvciBjcmVhdGluZyBhc3NldFxuICAgIFNlcnZlck9EQVBHYXRld2F5LS0-PkNsaWVudE9EQVBHYXRld2F5OiBjb21taXQgZmluYWwgYWNrXG4gICAgQ2xpZW50T0RBUEdhdGV3YXktPj5TZXJ2ZXJPREFQR2F0ZXdheTogIHRyYW5zZmVyIGNvbXBsZXRlXG4gICAgQ2xpZW50T0RBUEdhdGV3YXktLT4-RW5kVXNlcjogIHNlbmQgY2xpZW50IGFja1xuXG4iLCJtZXJtYWlkIjp7InRoZW1lIjoiZGVmYXVsdCJ9LCJ1cGRhdGVFZGl0b3IiOnRydWUsImF1dG9TeW5jIjp0cnVlLCJ1cGRhdGVEaWFncmFtIjp0cnVlfQ "odap-sequence-diagram")
#####API Endpoints
Similar as Cactus, odap uses openapi to generate api paths.
By the file:
https://github.com/jscode017/cactus/blob/odap-pr/packages/cactus-odap-hermes/src/main/json/openapi.json
The endpoints are:
- apiV1Phase1TransferInitiation
- apiV1Phase2TransferCommence
- apiV1Phase2LockEvidence
- apiV1Phase3CommitPreparation
- apiV1Phase3CommitFinal
- apiV1Phase3TransferComplete
- apiV1SendClientRequest

##### How to test the files:
To have a full test
With ledger connectors:
https://github.com/jscode017/cactus/blob/odap-pr/packages/cactus-odap-hermes/src/test/typescript/integration/odap/odap-api-call-with-ledger-connector.test.ts
Without ledger connectors:
https://github.com/jscode017/cactus/blob/odap-pr/packages/cactus-odap-hermes/src/test/typescript/integration/odap/odap-api-call.test.ts
For developers who would want to test separate step of odap
please ref to other test files in:
https://github.com/jscode017/cactus/tree/odap-pr/packages/cactus-odap-hermes/src/test/typescript/integration/odap

###### Some developer rules:
As an end user you should only be able to call SendClientRequest api endpoints
https://github.com/jscode017/cactus/blob/odap-pr/packages/cactus-odap-hermes/src/main/typescript/web-services/send-client-request.ts
Other endpoints:
excluding sendClientRequest in this directory:
https://github.com/jscode017/cactus/tree/odap-pr/packages/cactus-odap-hermes/src/main/typescript/web-services
should be called by ODAP Gateway
How to use the packages:

The full test file:  https://github.com/jscode017/cactus/blob/odap-pr/packages/cactus-odap-hermes/src/test/typescript/integration/odap/odap-api-call-with-ledger-connector.test.ts
provide a good example
You should first setup the Hyperledger Besu, Hyperledger Fabric, IPFS container
and make sure your smart contract is deployed on Besu and Fabric
(Please refer to the Besu, Fabric, IPFS packacges in cactus for details)
Then pass in the require parameter to construct server and client
`const odapPluginOptions: OdapGatewayConstructorOptions= {`
     `name: "cactus-plugin#odapGateway",`
     ` dltIDs: ["supported dlts here"],`
      `instanceId: odapServerGatewayInstanceID,`
     `ipfsPath: ipfsApiHost,`
      `besuAssetID: "whatever",`
      `besuPath: besuPath,`
      `besuWeb3SigningCredential:`
      `besuWeb3SigningCredential,`
      `besuContractName: besuContractName,`
      `besuKeychainId: besuKeychainId,`
	  `fabricPath: fabricPath,`
       `fabricSigningCredential: fabricSigningCredential,`
       `fabricChannelName: fabricChannelName,`
        `fabricContractName: fabricContractName,`
        `fabricAssetID: fabricAssetID,`
    `};`
    `const plugin = new OdapGateway(odapPluginOptions);`
Then call apiV1SendClientRequest to initiate the transfer from client ODAP gateway

