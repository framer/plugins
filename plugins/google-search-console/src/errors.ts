export class GoogleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleError';
  }
}
