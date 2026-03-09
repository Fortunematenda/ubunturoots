export function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    return Number(value);
  }

  if (typeof value === 'object' && value && 'toNumber' in value) {
    const maybeDecimal = value as { toNumber: () => number };
    return maybeDecimal.toNumber();
  }

  return Number(value);
}

export function serializePrisma<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}
