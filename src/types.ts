/**
 * Given a union of trait names, returns the intersection of transient param types.
 */
export type TransientParamsForTraits<
  Traits,
  TraitNames extends keyof Traits
> = Intersect<Pick<Traits, TraitNames>[TraitNames]>;

/**
 * Converts a union of values to an intersection of values.
 */
export type Intersect<T> = (T extends any ? (x: T) => any : never) extends (
  x: infer R
) => any
  ? R
  : never;

/**
 * Makes optional the keys on Child that also exist on Parent.
 */
export type ExtendedAttributes<Parent, Child> = CommonAttributes<
  Parent,
  Child
> &
  NewAttributes<Parent, Child>;
type CommonAttributes<Parent, Child> = Partial<
  Pick<Child, keyof (Parent | Child)>
>;
type NewAttributes<Parent, Child> = Omit<Child, keyof Parent>;

export type FinalBuilder<Builder> = Omit<
  Builder,
  'extends' | 'attributes' | 'transient'
>;
