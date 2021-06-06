// type EntityFromFactory<F> = F extends Factory<infer Entity, infer T>
//   ? Entity
//   : F;

type GetKeys<U> = U extends Record<infer K, any> ? K : never;
type UnionToIntersection<U> = {
  [K in GetKeys<U>]: U extends Record<K, infer T> ? T : never;
};
type TransientParamsForTraits<
  Traits,
  TraitNames extends keyof Traits
> = UnionToIntersection<Pick<Traits, TraitNames>[TraitNames]>;

interface TraitBuilder<Entity, TransientParams = unknown> {
  attributes(
    attributes: Partial<Entity>
  ): TraitBuilder<Entity, TransientParams>;
  transient<TraitTransientParams extends Record<string, unknown>>(
    params: TraitTransientParams
  ): TraitBuilder<Entity, TransientParams & TraitTransientParams>;
}

interface FactoryBuilder<Entity = unknown, Traits = unknown> {
  attributes<Entity>(attributes: Entity): FactoryBuilder<Entity, Traits>;
  transient(params: Record<string, unknown>): FactoryBuilder<Entity, Traits>;
  trait<Trait extends string, TraitTransientParams>(
    name: Trait,
    traitBuilderCallBack: (
      builder: TraitBuilder<Entity>
    ) => TraitBuilder<Entity, TraitTransientParams>
  ): FactoryBuilder<Entity, Traits & Record<Trait, TraitTransientParams>>;
}

interface EntityFactory<Entity, Traits> {
  build(entity: Partial<Entity>): void;
  build<TraitNames extends keyof Traits>(traits: TraitNames): void;
  build<TraitNames extends keyof Traits>(
    ...params: [
      ...Array<TraitNames>,
      Partial<Entity> & TransientParamsForTraits<Traits, TraitNames>
    ]
  ): void;
}

export const Factory = {
  define<Entity, Traits>(
    factoryBuilderCallback: (
      builder: FactoryBuilder
    ) => FactoryBuilder<Entity, Traits>
  ): EntityFactory<Entity, Traits> {
    const factory: EntityFactory<Entity, Traits> = {
      build(...params: Array<any>) {

      }
    }

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
    .trait('inactive', (trait) =>
      trait
        .transient({
          bar: 'bar',
        })
        .attributes({
          isActive: false,
        })
    )
);

userFactory.build({ id: 1 });
userFactory.build('admin');
userFactory.build('inactive');
userFactory.build('admin', { id: 1, foo: false });
userFactory.build('inactive', { id: 1, bar: '' });
userFactory.build('admin', 'inactive', { id: 1, bar: '', foo: true });
