// import fetch from "@fetch";
// import secrets from "@secrets";

// const connectionId = "connection:google-drive-limited";

// export {
//   connect,
//   get,
//   create,
//   del,
//   query,
//   createMultipart,
//   getDoc,
//   updateDoc,
//   unwrap,
// };

// /**
//  * Retrieves a file from Google Drive.
//  *
//  * @param {string} token - The authentication token.
//  * @param {string} id - The ID of the file to retrieve.
//  * @param {object} metadata - Optional metadata for the request.
//  * @returns {Promise<object>} - A promise that resolves to the API response or an error object.
//  */
// async function get(token, id, metadata) {
//   if (!token) {
//     return error("Authentication token is required.");
//   }
//   if (!id) {
//     return error("Please supply file id.");
//   }
//   return api(
//     metadata,
//     token,
//     `https://www.googleapis.com/drive/v3/files/${id}`,
//     "GET"
//   );
// }

// /**
//  * Creates a new file in Google Drive.
//  *
//  * @param {string} token - The authentication token.
//  * @param {object} body - The body of the file to create.
//  * @param {object} metadata - Optional metadata for the request.
//  * @returns {Promise<object>} - A promise that resolves to the API response or an error object.
//  */
// async function create(token, body, metadata) {
//   if (!token) {
//     return error("Authentication token is required.");
//   }
//   if (!body) {
//     return error("Please supply the body of the file to create.");
//   }

//   return api(
//     metadata,
//     token,
//     "https://www.googleapis.com/drive/v3/files",
//     "POST",
//     body
//   );
// }

// /**
//  * Queries files in Google Drive.
//  *
//  * @param {string} token - The authentication token.
//  * @param {string} query - The query string.
//  * @param {object} metadata - Optional metadata for the request.
//  * @returns {Promise<object>} - A promise that resolves to the API response or an error object.
//  */
// async function query(token, query, metadata) {
//   if (!token) {
//     return error("Authentication token is required.");
//   }
//   if (!query) {
//     return error("Please supply the query.");
//   }

//   return api(
//     metadata,
//     token,
//     `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`,
//     "GET"
//   );
// }

// /**
//  * Deletes a file from Google Drive.
//  *
//  * @param {string} token - The authentication token.
//  * @param {string} id - The ID of the file to delete.
//  * @param {object} metadata - Optional metadata for the request.
//  * @returns {Promise<object>} - A promise that resolves to the API response or an error object.
//  */
// async function del(token, id, metadata) {
//   if (!token) {
//     return error("Authentication token is required.");
//   }
//   if (!id) {
//     return error("Please supply the id of the file to delete");
//   }

//   return api(
//     metadata,
//     token,
//     `https://www.googleapis.com/drive/v3/files/${id}`,
//     "DELETE"
//   );
// }

// /**
//  * Retrieves a Google Doc.
//  *
//  * @param {string} token - The authentication token.
//  * @param {string} id - The ID of the document to retrieve.
//  * @param {object} metadata - Optional metadata for the request.
//  * @returns {Promise<object>} - A promise that resolves to the API response.
//  */
// async function getDoc(token, id, metadata) {
//   if (!token) {
//     return error("Authentication token is required.");
//   }
//   if (!id) {
//     return error("Please supply the doc id to get.");
//   }
//   return api(
//     metadata,
//     token,
//     `https://docs.googleapis.com/v1/documents/${id}`,
//     "GET"
//   );
// }

// /**
//  * Updates a Google Doc.
//  *
//  * @param {string} token - The authentication token.
//  * @param {string} id - The ID of the document to update.
//  * @param {object} body - The update request body.
//  * @param {object} metadata - Optional metadata for the request.
//  * @returns {Promise<object>} - A promise that resolves to the API response.
//  */
// async function updateDoc(token, id, body, metadata) {
//   if (!token) {
//     return error("Authentication token is required.");
//   }
//   if (!id) {
//     return error("Please supply the id of the doc to update.");
//   }
//   if (!body) {
//     return error("Please supply the body of the doc update request.");
//   }
//   return api(
//     metadata,
//     token,
//     `https://docs.googleapis.com/v1/documents/${id}:batchUpdate`,
//     "POST",
//     body
//   );
// }

// /**
//  * Connects to Google Drive and retrieves an authentication token.
//  *
//  * @param {object} metadata - Metadata for the secrets retrieval.
//  * @returns {Promise<string>} - A promise that resolves to the authentication token.
//  */
// async function connect(metadata) {
//   const { [connectionId]: token } = await secrets({
//     ...meta(metadata),
//     keys: [connectionId],
//   });
//   return token;
// }

// /**
//  * Creates a file in Google Drive using multipart upload.
//  *
//  * @param {string} token - The authentication token.
//  * @param {object} metadata - Metadata for the file.
//  * @param {string} body - The content of the file.
//  * @param {string} mimeType - The MIME type of the file.
//  * @param {object} $metadata - Additional metadata.
//  * @returns {Promise<object>} - A promise that resolves to the API response or an error.
//  */
// async function createMultipart(token, metadata, body, mimeType, $metadata) {
//   const boundary = "BB-BB-BB-BB-BB-BB";
//   const url = `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
//   const request = {
//     ...meta($metadata),
//     url,
//     method: "POST",
//     headers: {
//       Authorization: `Bearer ${token}`,
//       ["Content-Type"]: `multipart/related; boundary=${boundary}`,
//     },
//     body: `--${boundary}\nContent-Type: application/json; charset=UTF-8\n
// ${JSON.stringify(metadata, null, 2)}\n--${boundary}\nContent-Type: ${mimeType}; charset=UTF-8\n
// ${body}\n--${boundary}--`,
//   };
//   const { response, $error } = await fetch(request);
//   if ($error) {
//     return { success: false, error: $error };
//   }
//   return { success: true, info: response };
// }

// /**
//  * Makes an API request to Google Drive or Docs.
//  *
//  * @param {object} metadata - Optional metadata for the request.
//  * @param {string} token - The authentication token.
//  * @param {string} url - The URL to make the request to.
//  * @param {string} method - The HTTP method to use (e.g., "GET", "POST", "DELETE").
//  * @param {object} [body] - The request body (for POST and PUT requests).
//  * @returns {Promise<object>} - A promise that resolves to the API response or an error object.
//  */
// async function api(metadata, token, url, method, body = null) {
//   const request = {
//     ...meta(metadata),
//     url,
//     method,
//     headers: {
//       Authorization: `Bearer ${token}`,
//     },
//   };
//   if (body) {
//     request.body = body;
//   }
//   const { response, $error } = await fetch(request);
//   if ($error) {
//     return { success: false, error: $error };
//   }
//   return { success: true, info: response };
// }

// /**
//  * Unwraps a successful result from an API call, throwing an error if the result indicates failure.
//  *
//  * @param {object} result - The result object from an API call.
//  * @param {string} [message="Error"] - The base error message to use if the result is an error.
//  * @returns {object} - The unwrapped data (the "info" property of the result).
//  * @throws {Error} - Throws an error if the result has an error property.
//  */
// function unwrap(result, message = "Error") {
//   if (result.error) {
//     throw new Error(`${message}:
// ${JSON.stringify(result.error)}`);
//   }
//   return result.info;
// }

// /**
//  * Creates an error object.
//  *
//  * @param {string} message - The error message.
//  * @returns {object} - An error object with success: false and an error property.
//  */
// function error(message) {
//   return {
//     success: false,
//     error: message,
//   };
// }

// /**
//  * Creates a metadata object for API requests.
//  *
//  * @param {object} [options={}] - An object containing title and/or description.
//  * @param {string} [options.title] - The title.
//  * @param {string} [options.description] - The description.
//  * @returns {object} - An object containing the $metadata property, or an empty object if neither title nor description is provided.
//  */
// function meta({ title, description } = {}) {
//   if (!(title || description)) return {};
//   const $metadata = {};
//   if (title) {
//     $metadata.title = title;
//   }
//   if (description) {
//     $metadata.description = description;
//   }
//   return { $metadata };
// }
