/**
 * A utility function that does nothing but makes TypeScript check for the never type.
 *
 * For example, sometimes something that should never happen is expected to
 * happen, like during a rollback. To prevent unwanted crashers use
 * `shouldBeNever` instead of `assertNever`.
 */
export function shouldBeNever(_: never) {}
