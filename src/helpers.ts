import camelCaseFn from "camelcase";
import deepFreeze from "ice-barrage";
import lessThan from "semver/functions/lt.js";

export function camelCase(input: string): string {
  return camelCaseFn(input);
}
export function freeze<T extends object>(input: T): Readonly<T> {
  return deepFreeze(input);
}
export function lt(a: string, b: string, options?: { loose?: boolean }): boolean {
  return lessThan(a, b, options);
}
