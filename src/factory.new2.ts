type GetKeys<U> = U extends Record<infer K, any> ? K : never;
type UnionToIntersection<U> = {
  [K in GetKeys<U>]: U extends Record<K, infer T> ? T : never;
};
type TransientParamsForTraits<
  Traits,
  TraitNames extends keyof Traits
> = UnionToIntersection<Pick<Traits, TraitNames>[TraitNames]>;

interface TraitBuilder<
  Entity,
  GlobalTransientParams = unknown,
  TransientParams = {}
> {
  attributes(
    attributes: Partial<Entity>
  ): TraitBuilder<Entity, GlobalTransientParams, TransientParams>;

  transient<TraitTransientParams extends Record<string, unknown>>(
    params: TraitTransientParams
  ): TraitBuilder<
    Entity,
    GlobalTransientParams,
    TransientParams & TraitTransientParams
  >;
}

interface FactoryBuilder<
  Entity = unknown,
  GlobalTransientParams = unknown,
  Traits = unknown
> {
  attributes<Entity>(
    attributes: Entity
  ): FactoryBuilder<Entity, GlobalTransientParams, Traits>;

  transient<GlobalTransientParams>(
    params: GlobalTransientParams
  ): FactoryBuilder<Entity, GlobalTransientParams, Traits>;

  trait<Trait extends string, TraitTransientParams>(
    name: Trait,
    traitBuilderCallBack: (
      builder: TraitBuilder<Entity, GlobalTransientParams>
    ) => TraitBuilder<Entity, GlobalTransientParams, TraitTransientParams>
  ): FactoryBuilder<
    Entity,
    GlobalTransientParams,
    Traits & Record<Trait, TraitTransientParams>
  >;
}

interface EntityFactory<Entity, GlobalTransientParams, Traits> {
  build(entity?: Partial<Entity & GlobalTransientParams>): void;

  build<TraitNames extends keyof Traits>(
    ...params:
      | [
          ...traits: [TraitNames, ...Array<TraitNames>],
          params: Partial<
            Entity &
              GlobalTransientParams &
              TransientParamsForTraits<Traits, TraitNames>
          >
        ]
      | Array<keyof Traits>
  ): void;
}

export const Factory = {
  define<Entity, GlobalTransientParams, Traits>(
    factoryBuilderCallback: (
      builder: FactoryBuilder
    ) => FactoryBuilder<Entity, GlobalTransientParams, Traits>
  ): EntityFactory<Entity, GlobalTransientParams, Traits> {
    const factory: EntityFactory<Entity, GlobalTransientParams, Traits> = {
      build(...params: Array<any>) {},
    };

    const factoryBuilder: FactoryBuilder = {
      attributes(attributes) {
        return factoryBuilder;
      },
      transient(params) {
        return factoryBuilder;
      },
      trait(name, traitBuilderCallBack) {
        const traitBuilder: TraitBuilder<Entity> = {
          attributes(attributes) {
            return traitBuilder;
          },
          transient(params) {
            return traitBuilder;
          },
        };
        traitBuilderCallBack(traitBuilder);
        return factoryBuilder;
      },
    };

    factoryBuilderCallback(factoryBuilder);

    return factory;
  },
};

interface User {
  id: number;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
  isActive: boolean;
}

const userFactory = Factory.define((factory) =>
  factory
    .transient({
      baz: true,
    })
    .attributes<User>({
      id: 1,
      firstName: 'Alice',
      lastName: 'Smith',
      isAdmin: false,
      isActive: true,
    })
    .trait('admin', (trait) =>
      trait
        .transient({
          foo: true,
        })
        .attributes({
          isAdmin: true,
        })
    )
    .trait('standard', (trait) =>
      trait
        .transient({
          bar: 'bar',
        })
        .attributes({
          isAdmin: true,
        })
    )
    .trait('inactive', (trait) =>
      trait.attributes({
        isActive: false,
      })
    )
);

// no args
userFactory.build();
// attribute overrides only
userFactory.build({ id: 1 });
// attribute overrides with global transient params
userFactory.build({ id: 1, baz: true });
// single traits
userFactory.build('admin');
userFactory.build('inactive');
// single trait and attribute overrides
userFactory.build('inactive', { id: 1 });
// single trait with trait transient params and attribute overrides
userFactory.build('admin', { id: 1, foo: true });
// single trait with global transient params and attribute overrides
userFactory.build('admin', { id: 1, baz: true });
// multiple traits
userFactory.build('admin', 'inactive');
// multiple traits with one trait transient param and attribute overrides
userFactory.build('admin', 'inactive', { id: 1, foo: true });
// multiple traits with multiple trait transient params and attribute overrides
userFactory.build('admin', 'inactive', 'standard', {
  id: 1,
  foo: true,
  bar: '',
});
// @ts-expect-error - foo is not available
userFactory.build({ id: 1, lastName: 'last', foo: true });
// @ts-expect-error - foo is not available
userFactory.build('inactive', { foo: true });
// @ts-expect-error - bar is not available
userFactory.build('admin', 'inactive', { isAdmin: true, foo: true, bar: '' });
// @ts-expect-error - bar is not available
userFactory.build('admin', { isAdmin: true, foo: true, bar: '' });
