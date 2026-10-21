// Errors that the error handler turns into the JSON error format from contracts/api.md.
// `message` is shown to the customer and is therefore Dutch; `code` is English.
export class AppError extends Error {
  constructor(status, code, message, fields) {
    super(message)
    this.status = status
    this.code = code
    this.fields = fields
  }
}

export const validationError = (fields) =>
  new AppError(400, 'validation_failed', 'Controleer de ingevulde gegevens.', fields)

export const notFound = () => new AppError(404, 'not_found', 'Niet gevonden.')

export const conflict = (fields) =>
  new AppError(409, 'conflict', 'Deze gegevens zijn al in gebruik.', fields)

export const notAuthenticated = () =>
  new AppError(401, 'not_authenticated', 'Je bent niet ingelogd.')

export const sessionExpired = () =>
  new AppError(401, 'session_expired', 'Je sessie is verlopen. Log opnieuw in.')

export const forbidden = () =>
  new AppError(403, 'forbidden', 'Je hebt geen toegang tot deze pagina.')

export const invalidCredentials = (message) => new AppError(401, 'invalid_credentials', message)
