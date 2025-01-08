interface ErrorDetails {
  [ket: string]: any;
}

class CustomError extends Error {
  statusCode: number;
  details?: ErrorDetails;

  constructor(
    message: string,
    statusCode: number = 500,
    details?: ErrorDetails
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    if (details) {
      this.details = details;
    }
    Error.captureStackTrace(this, this.constructor);
  }
}

export { CustomError };
