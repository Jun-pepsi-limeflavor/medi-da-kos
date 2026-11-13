// 조건부 className 결합 헬퍼.
// - false·null·undefined를 빼고 공백으로 이어 붙인다

/** Joins truthy class names. */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
