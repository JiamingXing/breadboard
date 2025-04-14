import { connect, create, getDoc, query, unwrap, updateDoc } from "./api";
import { markdownToRequests } from "./markdown-to-requests";

export { invoke as default, describe };

/**
 * Invokes the main functionality: appends context to a Google Doc.
 *
 * @param {object} options - Options object.
 * @param {object} options.context - The context to append to the document.
 * @param {string} options.title - The title of the document.
 * @returns {Promise<object>} - A promise that resolves to an object containing the document ID.
 */
async function invoke({ context, title }) {
  const token = await connect({ title: "Get API token" }); // Get the authentication token.
  const { id, end } = await getCollectorId(token, title);    // Get the document ID and end position.
  const markdown = contextToMarkdown(context);             // Convert context to Markdown.

  if (markdown) {
    const requests = markdownToRequests(markdown, end); // Convert Markdown to Google Docs API requests.
    // console.log("REQUESTS", requests);
    unwrap(                                             // Update the document with the new content.
      await updateDoc(token, id, { requests }, { title: "Append to doc" }),
      "Failed to update the doc."
    );
  }
  return { id }; // Return the ID of the updated document.
}

/**
 * Gets or creates the Google Doc ID that serves as the collector: the
 * doc to which context is appended.
 *
 * @param {string} token - The authentication token.
 * @param {string} title - The title of the document.
 * @returns {Promise<object>} - A promise that resolves to an object containing the document ID and the end position.
 */
async function getCollectorId(token, title) {
  const findFile = await query( // Find an existing document with the given title.
    token,
    `appProperties has { key = 'appendToDoc' and value = '${title.replace(
      "'",
      "\\'"
    )}' } and trashed = false`, // Query to find the document by appProperties.
    { title: "Find the doc to which to append" }
  );
  const file = unwrap(           // Unwrap the result of the query.
    findFile,
    "Failed to call Drive API to find the file to append"
  ).files.at(0); // Get the first file from the results.

  if (!file) {
    const createdFile = await create(  // If the file doesn't exist, create a new one.
      token,
      {
        name: title,
        mimeType: "application/vnd.google-apps.document", // Set the MIME type to Google Docs.
        appProperties: {
          appendToDoc: title, // Set a custom property to identify the document.
        },
      },
      { title: "Create new doc to which to append" }
    );

    return {
      id: unwrap(createdFile, "Failed to call Drive API to create a new file")
        .id, // Return the ID of the newly created document.
      end: 1, // Initial end position is 1.
    };
  }

  const id = file.id; // Get the ID of the existing document.
  const end =           // Calculate the end position in the document.
    unwrap(
      await getDoc(token, id, { title: "Get current doc contents" }), // Get the document content.
      "Failed to get the Doc to append to"
    ).body.content.reduce(
      (acc, element) => Math.max(acc, element.endIndex || 0), // Find the maximum endIndex.
      1
    ) - 1; // Subtract 1 to get the correct insertion point.

  return { id, end }; // Return the document ID and the end position.
}

/**
 * Converts the given context to Markdown format.
 *
 * @param {any} context - The context to convert.  Can be a string, an array, undefined, or null.
 * @returns {string} - The Markdown representation of the context.
 */
function contextToMarkdown(context) {
  if (!Array.isArray(context)) {
    // If context is not an array:
    if (typeof context === "string") {
      return context; // Return the string directly.
    }
    if (context === undefined || context === null) {
      return ""; // Return an empty string for undefined or null.
    }
    return JSON.stringify(context); // Stringify other types (e.g., objects).
  }

  // For now, take the last item in context, and process it.
  context = [context.at(-1)];
  return context
    .flatMap((item) => {
      if ("parts" in item) return item.parts.map((part) => part.text); // Extract text from "parts".
      return null; // Return null for items without "parts".
    })
    .filter((item) => !!item) // Filter out null or empty items.
    .join("\n\n"); // Join the text parts with double newlines (Markdown paragraph separator).
}

/**
 * Describes the input and output schema for the invoke function.
 *
 * @returns {object} - An object describing the input and output schema.
 */
async function describe() {
  return {
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", title: "Title" }, // Title of the document.
        context: {
          type: "array",
          items: { type: "object", behavior: ["llm-content"] }, // Array of context objects (LLM content).
          title: "Context in",
        },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string", title: "Document ID" }, // ID of the created/updated document.
      },
    },
  };
}
