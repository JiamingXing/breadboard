import {
  DocumentReference,
  DocumentSnapshot,
  Firestore,
} from "@google-cloud/firestore";
import {
  type ReanimationState,
  type GraphDescriptor,
  blank,
  isStoredData,
  isLLMContentArray,
} from "@google-labs/breadboard";
import {
  EXPIRATION_TIME_MS,
  type BoardServerStore,
  type ServerInfo,
  type StorageBoard,
} from "../store.js";
import type { RunBoardStateStore } from "../types.js";

const REANIMATION_COLLECTION_ID = "resume";

export class FirestoreStorageProvider
  implements BoardServerStore, RunBoardStateStore
{
  #database: Firestore;

  constructor(opts?: { database?: Firestore }) {
    console.log("Initialize fire store consturctor");
    console.log("Firestore id is: %s", process.env["FIRESTORE_DB_NAME"] || "board-server");
    this.#database =
      opts?.database ||
      new Firestore({
        databaseId: process.env["FIRESTORE_DB_NAME"] || "board-server",
      });
  }

  async createUser(username: string, apiKey: string): Promise<void> {
    console.log("firestore create user called...local server might not hit this");
    const path = `users/${username}`;
    if ((await this.#database.doc(path).get()).exists) {
      throw Error(`Account ${username} already exists`);
    }
    await this.#database.doc(path).set({ apiKey: apiKey });
  }

  #getReanimationStateDoc(user: string, ticket?: string) {
    const collection = this.#database
      .collection("runs")
      .doc(user)
      .collection(REANIMATION_COLLECTION_ID);
    if (ticket) {
      return collection.doc(ticket);
    }
    return collection.doc();
  }

  async saveReanimationState(
    user: string,
    state: ReanimationState
  ): Promise<string> {
    console.log("Save reanimation state to firestore...");
    const timestamp = new Date();
    const expireAt = new Date(timestamp.getTime() + EXPIRATION_TIME_MS);
    const docRef = this.#getReanimationStateDoc(user);
    await docRef.set({ state: JSON.stringify(state), timestamp, expireAt });
    return docRef.id;
  }

  async loadReanimationState(
    user: string,
    ticket: string
  ): Promise<ReanimationState | undefined> {
    console.log("Load previous reanimation state from firestore...");
    const data = await this.#getReanimationStateDoc(user, ticket).get();
    if (!data.exists) {
      return undefined;
    }
    const state = JSON.parse(data.get("state"));
    if (!state.states) {
      return undefined;
    }
    return state;
  }

  async getServerInfo(): Promise<ServerInfo | null> {
    const metadata = await this.#database.doc("configuration/metadata").get();
    return metadata.data() ?? null;
  }

  async findUserIdByApiKey(apiKey: string): Promise<string> {
    console.log("Checking whether apiKey %s belongs to the user", apiKey);
    const users = await this.#database
      .collection("users")
      .where("apiKey", "==", apiKey)
      .get();
    console.log("users is: %s", users.docs[0]?.id ?? "");
    return users.docs[0]?.id ?? "";
  }

  async listBoards(userId: string): Promise<StorageBoard[]> {
    const boards: StorageBoard[] = [];

    const docs = await this.#database.collectionGroup("boards").get();
    docs.forEach((doc: DocumentSnapshot): void => {
      const board = asStorageBoard(doc, userId, { requirePublished: true });
      if (board) {
        boards.push(board);
      }
    });

    return boards;
  }

  async loadBoard(opts: {
    name: string;
    owner?: string;
    requestingUserId?: string;
  }): Promise<StorageBoard | null> {
    console.log("firestore loadBoard being called... name is %s, owner is %s, and requestingUserId is %s", opts.name, opts.owner, opts.requestingUserId);
    const { name, owner, requestingUserId = "" } = opts;

    // If an owner is given, an exact path can be used
    if (owner) {
      const doc = await this.#getBoardDoc(owner, name).get();
      if (!doc.exists) {
        return null;
      }
      return asStorageBoard(doc, requestingUserId, { requirePublished: false });
    }

    // If only a name is given, do a collection group query
    const boards = await this.#database
      .collectionGroup("boards")
      .where("name", "==", name)
      .limit(1)
      .get();

    if (boards.empty) {
      // If no board was found by name, search all boards for a given document
      // ID. This allows backward compatiblity with legacy databases created
      // before the name was written to the document. However, this is an
      // expensive and slow operation. We may want to consider turning this off
      // once we don't care about backward compatibility.
      const allBoards = await this.listBoards(requestingUserId);
      return allBoards.find((board) => board.name === name) ?? null;
    }

    return asStorageBoard(boards.docs[0]!, requestingUserId, {
      requirePublished: false,
    });
  }

  async updateBoard(board: StorageBoard): Promise<void> {
    await this.#getBoardDoc(board.owner, board.name).set({
      name: board.name,
      title: board.displayName,
      description: board.description,
      tags: board.tags,
      graph: JSON.stringify(board.graph),
    });
  }

  async createBoard(userId: string, name: string): Promise<void> {
    console.log("firestore create empty board hit");
    await this.#getBoardDoc(userId, name).set({
      name,
      graph: JSON.stringify(blank()),
    });
  }

  async deleteBoard(userId: string, boardName: string): Promise<void> {
    await this.#getBoardDoc(userId, boardName).delete();
  }

  #getBoardDoc(owner: string, name: string): DocumentReference {
    const path = `workspaces/${owner}/boards/${name}`;
    console.log("firestore document path: %s", path);
    return this.#database.doc(path);
  }
}

export function asStorageBoard(
  doc: DocumentSnapshot,
  currentUserId: string,
  opts: { requirePublished: boolean }
): StorageBoard | null {
  const owner = doc.ref.parent.parent!.id;
  const tags = (doc.get("tags") as string[]) || [];

  // TODO Save on query and serving costs by filtering on the server instead of
  // post-filtering
  const mine = currentUserId === owner;
  if (!mine && tags.includes("private")) {
    return null;
  }
  if (!mine && opts.requirePublished && !tags.includes("published")) {
    return null;
  }

  const graphJson = doc.get("graph");
  const graph = graphJson
    ? (JSON.parse(graphJson) as GraphDescriptor)
    : undefined;

  return {
    name: doc.id,
    owner,
    displayName: doc.get("title") ?? "",
    description: doc.get("description") ?? "",
    thumbnail: getThumbnail(graph),
    tags,
    graph,
  };
}

function getThumbnail(graph?: GraphDescriptor): string {
  if (!graph) {
    return "";
  }
  try {
    const splashData = graph.assets?.["@@splash"]?.data;
    if (splashData && isLLMContentArray(splashData) && splashData.length > 0) {
      const splashEntry = splashData[0];
      if (splashEntry && isStoredData(splashEntry.parts[0])) {
        return splashEntry.parts[0].storedData.handle;
      }
      return "";
    }

    const presentation = graph.metadata?.visual?.presentation;
    const theme = presentation?.theme;
    const themes = presentation?.themes;
    if (!theme || !themes) {
      return "";
    }

    const handle = themes?.[theme]?.splashScreen?.storedData?.handle;
    if (handle) {
      return handle;
    }
  } catch (e) {
    // If an error is encountered, skip the thumbnail
  }

  return "";
}
