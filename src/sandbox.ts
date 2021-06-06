const map = {
  contact: { contact: 'contact' },
  direct: { user: 'user' },
};

type TraitMap = typeof map;

function foo<T extends keyof TraitMap>(trait: T, props: Pick<TraitMap, T>[T]) {}

foo('contact', { contact: 'foo' });
foo('direct', { user: 'user' });

function foo2<T extends keyof TraitMap>(
  ...args: [...Array<T>, Pick<TraitMap, T>[T]]
) {}

foo2('contact', { contact: '' });
foo2('direct', { user: '' });
foo2('contact', 'direct', { contact: 'contact', user: 'user' });

type Test = Record<'foo', { foo: 'foo' }> &
  Record<'bar', { bar: 'bar' }> &
  Record<'baz', { baz: 'baz' }> &
  unknown;

let temp: Test = {
  foo: { foo: 'foo' },
  bar: { bar: 'bar' },
  baz: { baz: 'baz' },
};

type GetKeys<U> = U extends Record<infer K, any> ? K : never
type UnionToIntersection<U extends object> = {
   [K in GetKeys<U>]: U extends Record<K, infer T> ? T : never
}
type Wrong = Pick<Test, 'foo' | 'bar'>['foo' | 'bar']
type Right = UnionToIntersection<Wrong>