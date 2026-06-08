export class CallBusyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CallBusyError";
  }
}

export class CallNotFoundError extends Error {
  constructor(message = "Appel introuvable ou expiré") {
    super(message);
    this.name = "CallNotFoundError";
  }
}

export class CallForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CallForbiddenError";
  }
}

export function mapCallErrorStatus(error: unknown) {
  if (error instanceof CallBusyError) return 409;
  if (error instanceof CallNotFoundError) return 404;
  if (error instanceof CallForbiddenError) return 403;
  return 400;
}
