#!/bin/bash

SERVER_URL="http://localhost:3000"

echo "--- Creating empty board ---"
CREATE_RESPONSE=$(curl -X POST -H "Authorization: Bearer $(gcloud auth print-access-token)" -d '{"name":"jimmy-test"}' "${SERVER_URL}/boards/")
echo "$CREATE_RESPONSE"

echo "\n--- Updating board ---"
UPDATE_RESPONSE=$(curl -X POST -H "Authorization: Bearer $(gcloud auth print-access-token)" -d '@gemini_board.json' "${SERVER_URL}/boards/@110099467630814779452/jimmy-test")
  echo "$UPDATE_RESPONSE"

echo "\n--- Getting the updated board to verify data ---"
GET_RESPONSE=$(curl -H "Authorization: Bearer $(gcloud auth print-access-token)" "${SERVER_URL}/boards/@110099467630814779452/jimmy-test")
  echo "$GET_RESPONSE"

echo "\n--- Running board ---"
RUN_RESPONSE=$(curl -X POST "${SERVER_URL}/boards/@110099467630814779452/jimmy-test/run" -H "Authorization: Bearer $(gcloud auth print-access-token)" -d '{"$key":"bb-2g3o2c1pr1o2f5h6512524a18y5b4ss2io3b1mr433a3194d3j"}')
  echo "$RUN_RESPONSE"

  echo "\n--- Resume execution ---"
RUN_RESPONSE=$(curl -X POST "${SERVER_URL}/boards/@111797484059990439246/jimmy-test/run" -H "Authorization: Bearer $(gcloud auth print-access-token)" -d '{"$key":"bb-2g3o2c1pr1o2f5h6512524a18y5b4ss2io3b1mr433a3194d3j", "context":[{"role":"user", "parts": [{"text": "tell me a joke"}]}]}')
  echo "$RUN_RESPONSE"

echo "\n--- Testing Completed ---"