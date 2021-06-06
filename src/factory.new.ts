type AttributeBuilderParams<Entity, TransientParams> = {
  sequence: number;
  params: Partial<Entity>;
  transientParams?: TransientParams;
};

type AttributeBuilder<
  Entity,
  TransientParams,
  Property extends keyof Entity
> = (
  params: AttributeBuilderParams<Entity, TransientParams>
) => Entity[Property];

type EntityAttribute<Entity, TransientParams, Property extends keyof Entity> =
  | AttributeBuilder<Entity, TransientParams, Property>
  | Entity[Property];

type EntityAttributes<Entity, TransientParams> = {
  [Property in keyof Entity]: EntityAttribute<
    Entity,
    TransientParams,
    Property
  >;
};

export interface EntityFactory<Entity, TransientParams, Traits> {
  build(
    ...args:
      | [...Array<Traits>, Partial<Entity> & Partial<TransientParams>]
      | Array<Traits>
  ): void;
}

export interface FactoryBuilder<Entity, TransientParams> {
  attributes(
    attributes: EntityAttributes<Entity, TransientParams>
  ): FactoryBuilder<Entity, TransientParams>;
  trait(
    name: string,
    builderCallback: (builder: TraitBuilder<Entity, TransientParams>) => void
  ): FactoryBuilder<Entity, TransientParams>;
  afterCreate(
    afterCreateCallback: (
      entity: Entity,
      params: { transientParams: TransientParams }
    ) => void
  ): FactoryBuilder<Entity, TransientParams>;
}

export interface TraitBuilder<Entity, TransientParams> {
  attributes(
    attributes: EntityAttributes<Partial<Entity>, TransientParams>
  ): TraitBuilder<Entity, TransientParams>;
  afterCreate(
    afterCreateCallback: (
      entity: Entity,
      params: { transientParams: TransientParams }
    ) => void
  ): TraitBuilder<Entity, TransientParams>;
}

export const Factory = {
  define<Entity, TransientParams = Record<string, any>, Traits = string>(
    factoryBuilderCallback: (
      builder: FactoryBuilder<Entity, TransientParams>
    ) => void
  ) {
    const factory: EntityFactory<Entity, TransientParams, Traits> = {
      build(...args) {},
    };

    const builder: FactoryBuilder<Entity, TransientParams> = {
      attributes(attributes) {
        return builder;
      },
      trait(name, traitBuilderCallback) {
        const traitBuilder: TraitBuilder<Entity, TransientParams> = {
          attributes(attributes) {
            return traitBuilder;
          },
          afterCreate(afterCreateCallback) {
            return traitBuilder;
          },
        };
        traitBuilderCallback(traitBuilder);
        return builder;
      },
      afterCreate(afterCreateCallback) {
        return builder;
      },
    };

    factoryBuilderCallback(builder);

    return factory;
  },
};

interface User {
  id: number;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
}

type UserTransientParams = { foo: boolean; bar: string };
type UserTraits = 'admin' | 'inactive';
const userFactory = Factory.define<User, UserTransientParams, UserTraits>(
  (factory) =>
    factory
      .attributes({
        id: 1,
        firstName: 'foo',
        lastName({ sequence, transientParams }) {
          return transientParams?.foo ? `last${sequence}` : 'last';
        },
        isAdmin: false,
      })
      .trait('admin', (trait) =>
        trait
          .attributes({
            isAdmin: true,
          })
          .afterCreate((entity, { transientParams }) => {
            console.log('trait after create', entity, transientParams);
          })
      )
      .afterCreate((entity, { transientParams }) => {
        console.log('factory after create', entity, transientParams);
      })
);

userFactory.build({ firstName: 'foo' });
userFactory.build('admin', { firstName: 'foo' });
userFactory.build('admin', 'inactive', { firstName: 'bar' });


