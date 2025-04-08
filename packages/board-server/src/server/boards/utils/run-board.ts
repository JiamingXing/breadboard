/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDataStore } from "@breadboard-ai/data-store";
import {
  createGraphStore,
  createLoader,
  StubFileSystem,
  type ReanimationState,
} from "@google-labs/breadboard";
import { handleRunGraphRequest } from "@google-labs/breadboard/remote";
import type { RunBoardArguments } from "../../types.js";
import { BoardServerProvider } from "./board-server-provider.js";
import { createKits, registerLegacyKits } from "./create-kits.js";
import { NodeSandbox } from "@breadboard-ai/jsandbox/node";

export const timestamp = () => globalThis.performance.now();

export const runBoard = async ({
  serverUrl,
  url,
  path,
  user,
  inputs,
  loader,
  kitOverrides,
  next,
  writer,
  runStateStore,
  diagnostics = false,
}: RunBoardArguments): Promise<void> => {
  console.log("Start running board...");
  // What is this data store? data source? firestore/im-memory
  const store = getDataStore();
  if (!store) {
    await writer.write([
      "error",
      { error: "Data store not available.", timestamp: timestamp() },
    ]);
    return;
  }
  // TODO: Figure out if this is the right thing to do here.
  store.createGroup("run-board");

  console.log("Bring up the real board server here...");
  const boardServerProvider = new BoardServerProvider(serverUrl, path, loader);
  console.dir(boardServerProvider);
  await boardServerProvider.ready();

  console.log("Creating loader...");
  const runLoader = createLoader([boardServerProvider]);
  console.log("Creating kits...");
  const runKits = createKits(kitOverrides);

  // What is this graph store
  console.log("Creating graph store...");
  const graphStore = createGraphStore({
    loader: runLoader,
    kits: runKits,
    sandbox: new NodeSandbox(),
    fileSystem: new StubFileSystem(),
  });
  console.log("registering legacy kits...");
  registerLegacyKits(graphStore);

  return handleRunGraphRequest(
    {
      inputs,
      next,
      diagnostics,
    },
    {
      url,
      kits: runKits,
      writer,
      loader: runLoader,
      dataStore: store,
      graphStore,
      stateStore: {
        async load(next?: string) {
          console.log("Trying to load previous state... the next `ticket` is %s", next);
          if (!next) {
            return undefined;
          }
          return runStateStore.loadReanimationState(user, next);
        },
        async save(state: ReanimationState) {
          return runStateStore.saveReanimationState(user, state);
        },
      },
      inputs: { model: "gemini-1.5-flash-latest" },
      diagnostics,
    }
  );
};
