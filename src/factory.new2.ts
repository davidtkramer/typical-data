type EntityAttributes<Entity, TransientParams> = {
  [Property in keyof Entity]: EntityAttribute<
    Entity,
    TransientParams,
    Property
  >;
};
type EntityAttribute<Entity, TransientParams, Property extends keyof Entity> =
  | AttributeBuilder<Entity, TransientParams, Property>
  | Entity[Property];
type AttributeBuilder<
  Entity,
  TransientParams,
  Property extends keyof Entity
> = (
  params: AttributeBuilderParams<Entity, TransientParams>
) => Entity[Property];
type AttributeBuilderParams<Entity, TransientParams> = {
  sequence: number;
  params: Partial<Entity>;
  transientParams?: TransientParams;
};

type TransientParamsForTraits<
  Traits,
  TraitNames extends keyof Traits
> = UnionToIntersection<Pick<Traits, TraitNames>[TraitNames]>;
type UnionToIntersection<U> = {
  [K in GetKeys<U>]: U extends Record<K, infer T> ? T : never;
};
type GetKeys<U> = U extends Record<infer K, any> ? K : never;

type FinalBuilder<Builder> = Omit<Builder, 'attributes' | 'transient'>;

interface TraitBuilder<
  Entity,
  GlobalTransientParams = unknown,
  TransientParams = {}
> {
  transient<TraitTransientParams extends Record<string, unknown>>(
    params: TraitTransientParams
  ): Omit<
    TraitBuilder<
      Entity,
      GlobalTransientParams,
      TransientParams & TraitTransientParams
    >,
    'transient'
  >;

  attributes(
    attributes: EntityAttributes<
      Partial<Entity>,
      GlobalTransientParams & TransientParams
    >
  ): FinalBuilder<TraitBuilder<Entity, GlobalTransientParams, TransientParams>>;

  afterCreate(
    afterCreateCallback: (
      entity: Entity,
      params: { transientParams: GlobalTransientParams & TransientParams }
    ) => void
  ): FinalBuilder<TraitBuilder<Entity, GlobalTransientParams, TransientParams>>;
}

interface FactoryBuilder<
  Entity = unknown,
  GlobalTransientParams = unknown,
  Traits = unknown
> {
  transient<GlobalTransientParams>(
    params: GlobalTransientParams
  ): Omit<FactoryBuilder<Entity, GlobalTransientParams, Traits>, 'transient'>;

  attributes<Entity>(
    attributes: EntityAttributes<Entity, GlobalTransientParams>
  ): FinalBuilder<FactoryBuilder<Entity, GlobalTransientParams, Traits>>;

  trait<Trait extends string, TraitTransientParams>(
    name: Trait,
    traitBuilderCallBack: (
      builder: TraitBuilder<Entity, GlobalTransientParams>
    ) => FinalBuilder<
      TraitBuilder<Entity, GlobalTransientParams, TraitTransientParams>
    >
  ): FinalBuilder<
    FactoryBuilder<
      Entity,
      GlobalTransientParams,
      Traits & Record<Trait, TraitTransientParams>
    >
  >;

  afterCreate(
    afterCreateCallback: (
      entity: Entity,
      params: { transientParams: GlobalTransientParams }
    ) => void
  ): FinalBuilder<FactoryBuilder<Entity, GlobalTransientParams, Traits>>;
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
    ) => FinalBuilder<FactoryBuilder<Entity, GlobalTransientParams, Traits>>
  ): EntityFactory<Entity, GlobalTransientParams, Traits> {
    const factory: EntityFactory<Entity, GlobalTransientParams, Traits> = {
      build(...params: Array<any>) {},
    };

    const factoryBuilder: FactoryBuilder<any, any, any> = {
      attributes(attributes) {
        return factoryBuilder;
      },
      transient(params) {
        return factoryBuilder;
      },
      trait(name, traitBuilderCallBack) {
        const traitBuilder: TraitBuilder<any, any, any> = {
          attributes(attributes) {
            return traitBuilder;
          },
          transient(params) {
            return traitBuilder;
          },
          afterCreate(afterCreateCallback) {
            return traitBuilder;
          },
        };
        traitBuilderCallBack(traitBuilder);
        return factoryBuilder;
      },
      afterCreate(afterCreateCallback) {
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
      isActive({ sequence, params, transientParams }) {
        return true;
      },
    })
    .trait('admin', (trait) =>
      trait
        .transient({
          foo: true,
        })
        .attributes({
          isAdmin({ sequence, params, transientParams }) {
            return true;
          },
        })
        .afterCreate((entity, { transientParams }) => {})
    )
    .trait('standard', (trait) =>
      trait
        .transient({
          bar: 'bar',
        })
        .attributes({
          isAdmin: true,
        })
        .afterCreate((entity, { transientParams }) => {})
    )
    .trait('inactive', (trait) =>
      trait.attributes({
        isActive: false,
      })
    )
    .afterCreate((entity, { transientParams }) => {})
);

// TODO:
// fix Partial<Partial<User>> in trait params

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
