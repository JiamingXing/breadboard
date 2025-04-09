import type { NextFunction, Request, RequestHandler, Response } from "express";

import type { BoardServerStore } from "../store.js";
import type { BoardId } from "../types.js";

export function parseBoardId(opts?: { addJsonSuffix?: boolean }) {
  return (req: Request, res: Response, next: NextFunction) => {
    console.log("Checking logic when we call run board to parse board id from request url...");
    // console.dir(req);
    // Printing from req,  params: { user: '110099467630814779452', name: 'jimmy-test' },
    let { user = "", name = "" } = req.params;
    console.log("User is %s and name is %s", user, name);
    if (opts?.addJsonSuffix) {
      name += ".json";
    }
    let boardId: BoardId = {
      user,
      name,
    };
    res.locals.boardId = boardId;
    next();
  };
}

export function loadBoard(opts?: { addJsonSuffix?: boolean }): RequestHandler {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      let name = req.params.name;
      if (!name) {
        res.sendStatus(400);
        return;
      }
      if (opts?.addJsonSuffix) {
        name += ".json";
      }

      const store: BoardServerStore = res.app.locals.store;
      console.log("Prepare to load board from loader.ts... owner from req.params.user is %s and requesting user id from res.locals.userId(parse from token) is %s", req.params.user, res.locals.userId);
      const board = await store.loadBoard({
        name,
        owner: req.params.user,
        requestingUserId: res.locals.userId,
      });
      if (board) {
        res.locals.loadedBoard = board;
      }
      next();
    } catch (e) {
      if (e instanceof Error) {
        const errorMessage = e.message;
        console.log("Catch error while loading boards with error message: %s", errorMessage);
        if (errorMessage.includes("No credential present in the request")) {
          res.statusCode = 403;
        } else if (errorMessage.includes("No owner specified in the request")) {
          res.statusCode = 400;
        } else if (errorMessage.includes("Requestor does not match with the board owner")) {
          res.statusCode = 401;
        }
        // res.sendStatus(401);
        // res.statusCode = 401;
      }
      next(e);
    }
  };
}
