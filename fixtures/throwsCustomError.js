class CustomError extends Error {
  constructor(message) {
    super(message);
    Object.defineProperty(this, "name", {
      value: new.target.name,
      enumerable: false, // to make it as same as Error.prototype.name
    });
    this.extraProperty = "extraProperty";
  }
}

throw new CustomError("This exception was thrown by fixture");
