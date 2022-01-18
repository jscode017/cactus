#!/bin/sh
for i in {1..3}
do
filename="fabric_lock${i}out"
echo $filename
npx tap --ts --timeout=600 packages/cactus-plugin-odap-hermes/src/test/typescript/integration/evaluation/odap-api-call-with-ledger-connector-lock.test.ts >1 2>${filename}
sleep 10
done
