/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ServerRunConfig, ServerRunRequest } from "./types.js";
import { run } from "../harness/run.js";
import { OutputValues } from "../types.js";
import { timestamp } from "../timestamp.js";
import { createRunStateManager } from "../run/index.js";
import { inflateData } from "../data/inflate-deflate.js";
import { DiagnosticsFilter } from "./diagnostics-filter.js";

export const handleRunGraphRequest = async (
  request: ServerRunRequest,
  config: ServerRunConfig
): Promise<void> => {
  // Default input fron ServerRunConfig right now only contains { model: "gemini-1.5-flash-latest" }
  const {
    url,
    kits,
    writer,
    loader,
    dataStore,
    stateStore,
    inputs: defaultInputs,
    graph,
    graphStore,
  } = config;
  console.log("Printing default inputs....");
  console.dir(defaultInputs);
  // Real inputs from the ServerRunRequest that comes from the request body
  // const {
  //   $next: next,
  //   $diagnostics: diagnostics,
  //   ...inputs
  // } = req.body as Record<string, any>;
  const { next, inputs, diagnostics = false } = request;

  let inputsToConsume = next ? undefined : inputs;
  // Fetch the previous state? The next is the ticket of previous stored state key
  if (next) {
    console.log("Resume from previous state with next as %s", next);
  }
  const resumeFrom = await stateStore?.load(next);

  const state = createRunStateManager(resumeFrom, inputs);

  console.log("Printing url... %s", url);
  // console.log("Printing kits...");
  // console.dir(kits);
  console.log("Printing loader...");
  console.dir(loader);
  // console.log("Printing data store...");
  // console.dir(dataStore);
  console.log("Printing inputs fron request...");
  console.dir(inputs);

  // runner returns asynchronous generator that will yield type as HarnessResult...
  console.log("Run in the graph runner...");
  const runner = run({
    runner: graph,
    url,
    kits,
    loader, 
    store: dataStore,
    inputs: defaultInputs,
    interactiveSecrets: false,
    diagnostics,
    state,
    graphStore,
  });
  
  // What is the filter here?
  const filter = new DiagnosticsFilter(writer, diagnostics);

  for await (const result of runner) {
    console.log("Printing each result from runner... %s", result);
    const { type, data, reply } = result;
    switch (type) {
      case "graphstart": {
        await filter.writeGraphStart(data);
        break;
      }
      case "graphend": {
        await filter.writeGraphEnd(data);
        break;
      }
      case "nodestart": {
        await filter.writeNodeStart(data);
        break;
      }
      case "nodeend": {
        await filter.writeNodeEnd(data);
        break;
      }
      case "skip": {
        await filter.writeSkip(data);
        break;
      }
      case "edge": {
        await filter.writeEdge(data);
        break;
      }
      case "input": {
        if (inputsToConsume && Object.keys(inputsToConsume).length > 0) {
          await reply({ inputs: inputsToConsume });
          inputsToConsume = undefined;
          break;
        } else {
          const reanimationState = state.lifecycle().reanimationState();
          const next = await stateStore.save(reanimationState);
          console.log("Need input from user, store the reanimation state and stop here... the stored ticket is %s", next);
          // Where can we see the next ticket when we stops here with filter??
          await filter.writeInput(data, next);
          await writer.close();
          return;
        }
      }
      case "output": {
        const outputs = (await inflateData(
          dataStore,
          data.outputs
        )) as OutputValues;
        await filter.writeOutput({ ...data, outputs });
        break;
      }
      case "error": {
        await filter.writeError(data);
        await writer.close();
        return;
      }
      case "end": {
        await filter.writeEnd(data);
        await writer.close();
        return;
      }
      default: {
        console.log("Unknown type", type, data);
      }
    }
  }
  await writer.write([
    "error",
    {
      error: "Run completed without signaling end or error.",
      timestamp: timestamp(),
    },
  ]);
};
