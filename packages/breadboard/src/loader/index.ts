/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Loader } from "./loader.js";
import { GraphLoader, BoardServer } from "./types.js";
import { DefaultBoardServer } from "./default.js";

export const createLoader = (
  boardServers?: BoardServer[],
  opts?: { disableDefaultProvider?: boolean }
): GraphLoader => {
  console.log("Creating loader as loader in run config is empty...");
  // servers should be empty arraay as called by createLaoder();
  const servers = [...(boardServers ?? [])];
  console.log("Printing servers before push default");
  console.dir(servers);
  if (!opts?.disableDefaultProvider) {
    servers.push(new DefaultBoardServer());
  }
  console.log("Printing servers afrer push default");
  // There will be two board server provider.. BoardServerProvider&DefaultBoardServer
  console.dir(servers);
  return new Loader(servers);
};

export { SENTINEL_BASE_URL } from "./loader.js";
