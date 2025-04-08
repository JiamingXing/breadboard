/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Kit, asyncGen } from "../index.js";
import { HTTPClientTransport } from "../remote/http.js";
import { ProxyClient } from "../remote/proxy.js";
import { runLocally } from "./local.js";
import { configureSecretAsking } from "./secrets.js";
import { HarnessRunResult, RunConfig } from "./types.js";
import { runInWorker } from "./worker.js";

const configureKits = async (config: RunConfig): Promise<Kit[]> => {
  // If a proxy is configured, add the proxy kit to the list of kits.
  if (!config.proxy) return config.kits;
  const kits: Kit[] = [];
  for (const proxyConfig of config.proxy) {
    if (typeof proxyConfig === "function") {
      const config = await proxyConfig();
      if (!config) continue;
      kits.push(await proxyConfig());
    } else {
      switch (proxyConfig.location) {
        case "http": {
          if (!proxyConfig.url) {
            throw new Error("No node proxy server URL provided.");
          }
          const proxyClient = new ProxyClient(
            new HTTPClientTransport(proxyConfig.url)
          );
          kits.push(proxyClient.createProxyKit(proxyConfig.nodes));
          break;
        }
        default: {
          throw new Error(
            "Only HTTP node proxy server is supported at this time."
          );
        }
      }
    }
  }
  return [...kits, ...config.kits];
};

// async function* is an asynchronous generator function, which can pause/resume execution with yield keyword...
// the result of async generator function is a async interable
export async function* run(config: RunConfig) {
  if (!config.remote) {
    yield* asyncGen<HarnessRunResult>(
      // whole function is a callback passed in
      // But What is this next? Where is the exact next passed in?
      // IIUC, next is type AsyncGenNext<T>, what is th real function definition here...
      async (next) => {
      const kits = configureSecretAsking(
        config.interactiveSecrets,
        await configureKits(config),
        next
      );

      for await (const data of runLocally(config, kits)) {
        // Write data to iterator queue defined in AsyncGenIterator
        await next(data);
      }
    }
    // callback passed in ends here..
  );

  } else if (config.remote.type === "worker") {
    const workerURL = config.remote && config.remote.url;
    if (!workerURL) {
      throw new Error("Worker harness requires a worker URL");
    }
    yield* runInWorker(workerURL, config);
  } else {
    throw new Error(
      `Unsupported harness configuration: ${JSON.stringify(config, null, 2)}`
    );
  }
}
