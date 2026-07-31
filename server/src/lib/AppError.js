// Structured error used across routes/services so errorHandler.js can map
// a stable `code` to the right HTTP status + Vietnamese-facing message,
// instead of every route inventing its own ad-hoc error shape.
export class AppError extends Error {
  constructor(code, message, status = 400, details = undefined) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
