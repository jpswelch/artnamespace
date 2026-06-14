export function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function truncateMiddle(value: string, size = 10) {
  if (value.length <= size * 2 + 3) return value;
  return `${value.slice(0, size)}...${value.slice(-size)}`;
}

export function cx(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(" ");
}
