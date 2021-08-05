import {
  FinalBuilder,
  TransientParamsForTraits,
  ExtendedAttributes,
  Intersect,
} from './types';

interface FactoryBuilder<
  OuterEntity = unknown,
  OuterGlobalTransientParams = unknown,
  Traits = {} // eslint-disable-line @typescript-eslint/ban-types
> {
  extends<
    ParentFactories extends Array<EntityFactory<unknown, unknown, unknown>>
  >(
    ...parentFactories: ParentFactories
  ): Omit<
    FactoryBuilder<
      Intersect<EntityFromFactory<ParentFactories[number]>>,
      Intersect<TransientParamsFromFactory<ParentFactories[number]>>,
      Intersect<TraitsFromFactory<ParentFactories[number]>>
    >,
    'extends'
  >;

  transient<GlobalTransientParams>(
    params: GlobalTransientParams
  ): Omit<
    FactoryBuilder<
      OuterEntity,
      OuterGlobalTransientParams & GlobalTransientParams,
      Traits
    >,
    'extends' | 'transient'
  >;

  attributes<Entity extends OuterEntity>(
    attributes: EntityAttributes<
      ExtendedAttributes<OuterEntity, Entity>,
      OuterGlobalTransientParams
    >
  ): FinalBuilder<FactoryBuilder<Entity, OuterGlobalTransientParams, Traits>>;

  trait<
    TraitName extends string,
    TraitTransientParams = {} // eslint-disable-line @typescript-eslint/ban-types
  >(
    name: TraitName,
    traitBuilderArg:
      | EntityAttributes<Partial<OuterEntity>, OuterGlobalTransientParams>
      | ((
          builder: TraitBuilder<OuterEntity, OuterGlobalTransientParams>
        ) => FinalBuilder<
          TraitBuilder<
            OuterEntity,
            OuterGlobalTransientParams,
            TraitTransientParams
          >
        >)
  ): FinalBuilder<
    FactoryBuilder<
      OuterEntity,
      OuterGlobalTransientParams,
      Traits & Record<TraitName, TraitTransientParams>
    >
  >;

  afterBuild(
    afterBuildCallback: (params: {
      entity: OuterEntity;
      transientParams: OuterGlobalTransientParams;
    }) => void
  ): FinalBuilder<
    FactoryBuilder<OuterEntity, OuterGlobalTransientParams, Traits>
  >;
}

type EntityFromFactory<Factory> = Factory extends EntityFactory<
  infer Entity,
  unknown,
  unknown
>
  ? Entity
  : never;

type TransientParamsFromFactory<Factory> = Factory extends EntityFactory<
  unknown,
  infer TransientParams,
  unknown
>
  ? TransientParams
  : never;

type TraitsFromFactory<Factory> = Factory extends EntityFactory<
  unknown,
  unknown,
  infer Traits
>
  ? Traits
  : never;

interface TraitBuilder<
  Entity,
  GlobalTransientParams = unknown,
  TransientParams = {} // eslint-disable-line @typescript-eslint/ban-types
> {
  transient<TraitTransientParams extends Record<string, unknown>>(
    params: TraitTransientParams
  ): Omit<
    TraitBuilder<Entity, GlobalTransientParams, TraitTransientParams>,
    'transient'
  >;

  attributes(
    attributes: EntityAttributes<
      Partial<Entity>,
      GlobalTransientParams & TransientParams
    >
  ): FinalBuilder<TraitBuilder<Entity, GlobalTransientParams, TransientParams>>;

  afterBuild(
    afterBuildCallback: (params: {
      entity: Entity;
      transientParams: GlobalTransientParams & TransientParams;
    }) => void
  ): FinalBuilder<TraitBuilder<Entity, GlobalTransientParams, TransientParams>>;
}

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
> = (params: {
  sequence: number;
  entity: Entity;
  transientParams: TransientParams;
}) => Entity[Property];

export interface EntityFactory<Entity, GlobalTransientParams, Traits> {
  build(entity?: Partial<Entity & GlobalTransientParams>): Entity;

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
  ): Entity;

  buildList(
    count: number,
    entity?: Partial<Entity & GlobalTransientParams>
  ): Array<Entity>;

  buildList<TraitNames extends keyof Traits>(
    count: number,
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
  ): Array<Entity>;

  rewindSequence(): void;

  withSequence(sequence: { count: number }): void;

  /** @internal */
  getDefinition(): FactoryDefinition;
}

interface FactoryDefinition {
  attributeDefaults: Record<string, any>;
  transientParamDefaults: Record<string, any>;
  traits: Record<
    string,
    {
      attributeDefaults: Record<string, any>;
      transientParamDefaults: Record<string, any>;
      afterBuildHooks: Array<(...args: Array<any>) => void>;
    }
  >;
  afterBuildHooks: Array<(...args: Array<any>) => void>;
  sequence: { count: number };
}

/**
 * Creates an entity factory with the given attributes or builder callback.
 */
export function createFactory<
  Entity,
  GlobalTransientParams = unknown,
  Traits = unknown // eslint-disable-line @typescript-eslint/ban-types
>(
  attributesOrBuilder:
    | EntityAttributes<Entity, GlobalTransientParams>
    | ((
        builder: FactoryBuilder
      ) => FinalBuilder<FactoryBuilder<Entity, GlobalTransientParams, Traits>>)
): EntityFactory<Entity, GlobalTransientParams, Traits> {
  const definition: FactoryDefinition = {
    attributeDefaults: {},
    transientParamDefaults: {},
    traits: {},
    afterBuildHooks: [],
    sequence: { count: -1 },
  };

  if (typeof attributesOrBuilder === 'function') {
    const factoryBuilder = createFactoryBuilder(definition);
    attributesOrBuilder(factoryBuilder);
  } else {
    definition.attributeDefaults = attributesOrBuilder;
  }

  return createFactoryInternal<Entity, GlobalTransientParams, Traits>(
    definition
  );
}

function createFactoryInternal<Entity, GlobalTransientParams, Traits>(
  definition: FactoryDefinition
) {
  const factory: EntityFactory<Entity, GlobalTransientParams, Traits> = {
    build(...args: Array<any>) {
      let [params, ...traitNames] = args.reverse();
      if (typeof params === 'string') {
        traitNames.unshift(params);
        params = {};
      }

      // split params into attributes and transient params
      const attributes: Record<string, any> = {};
      const transientParams: Record<string, any> = {
        ...definition.transientParamDefaults,
      };
      for (const key in params) {
        if (key in definition.attributeDefaults) {
          attributes[key] = params[key];
        } else {
          transientParams[key] = params[key];
        }
      }

      // build entity
      const entity: Record<string, any> = attributes;
      definition.sequence.count++;

      const globalAttributeProxy = new Proxy(definition.attributeDefaults, {
        get(target, key) {
          if (typeof key !== 'string') return;
          if (key in entity) return entity[key];

          const attribute = target[key];
          if (typeof attribute === 'function') {
            entity[key] = attribute({
              sequence: definition.sequence.count,
              entity: globalAttributeProxy,
              transientParams,
            });
          } else {
            entity[key] = attribute;
          }

          return entity[key];
        },
      });

      // apply trait defaults
      const allTraitAttributeDefaults: Record<string, any> = {};
      for (const traitName of traitNames.slice().reverse()) {
        Object.assign(
          allTraitAttributeDefaults,
          definition.traits[traitName].attributeDefaults
        );
      }

      for (const traitName of traitNames) {
        const trait = definition.traits[traitName];
        // using proxy for all trait attributes in case a derived attribute
        // references an attribute supplied by another trait
        const traitAttributeProxy = new Proxy(allTraitAttributeDefaults, {
          get(target, key) {
            if (typeof key !== 'string') return;
            if (key in entity) return entity[key];

            const attribute =
              key in target ? target[key] : globalAttributeProxy[key];
            if (typeof attribute === 'function') {
              entity[key] = attribute({
                sequence: definition.sequence.count,
                entity: traitAttributeProxy,
                transientParams: {
                  ...trait.transientParamDefaults,
                  ...transientParams,
                },
              });
            } else {
              entity[key] = attribute;
            }

            return entity[key];
          },
        });

        for (const key in trait.attributeDefaults) {
          traitAttributeProxy[key];
        }
      }

      // apply global defaults
      for (const key in globalAttributeProxy) {
        globalAttributeProxy[key];
      }

      // after build hooks
      for (const traitName of traitNames.slice().reverse()) {
        const trait = definition.traits[traitName];
        for (const afterBuild of trait.afterBuildHooks) {
          afterBuild({
            entity,
            transientParams: {
              ...trait.transientParamDefaults,
              ...transientParams,
            },
          });
        }
      }

      for (const afterBuild of definition.afterBuildHooks) {
        afterBuild({ entity, transientParams });
      }

      return entity as Entity;
    },

    buildList(count: number, ...args: any[]) {
      const result = [];
      for (let i = 0; i < count; i++) {
        result.push(factory.build(...args));
      }
      return result;
    },

    rewindSequence() {
      definition.sequence.count = -1;
    },

    withSequence(sequence) {
      definition.sequence = sequence;
    },

    getDefinition() {
      return definition;
    },
  };
  return factory;
}

function createFactoryBuilder(definition: FactoryDefinition) {
  const factoryBuilder: FactoryBuilder<any, any, any> = {
    extends(...parents: Array<EntityFactory<any, any, any>>) {
      for (const parent of parents) {
        const parentDefinition = parent.getDefinition();
        definition.attributeDefaults = {
          ...definition.attributeDefaults,
          ...parentDefinition.attributeDefaults,
        };
        definition.transientParamDefaults = {
          ...definition.transientParamDefaults,
          ...parentDefinition.transientParamDefaults,
        };
        for (const traitName in parentDefinition.traits) {
          const trait = parentDefinition.traits[traitName];
          definition.traits[traitName] = { ...trait };
        }
        definition.afterBuildHooks.push(...parentDefinition.afterBuildHooks);
      }
      return factoryBuilder;
    },
    transient(params) {
      Object.assign(definition.transientParamDefaults, params);
      return factoryBuilder;
    },
    attributes(params) {
      Object.assign(definition.attributeDefaults, params);
      return factoryBuilder;
    },
    trait(name, traitBuilderArg) {
      definition.traits[name] = {
        attributeDefaults: {},
        transientParamDefaults: {},
        afterBuildHooks: [],
      };
      if (typeof traitBuilderArg === 'function') {
        const traitBuilder: TraitBuilder<any, any, any> = {
          attributes(attributes) {
            definition.traits[name].attributeDefaults = attributes;
            return traitBuilder;
          },
          transient(params) {
            definition.traits[name].transientParamDefaults = params;
            return traitBuilder;
          },
          afterBuild(afterBuildCallback) {
            definition.traits[name].afterBuildHooks.push(afterBuildCallback);
            return traitBuilder;
          },
        };
        traitBuilderArg(traitBuilder);
      } else {
        definition.traits[name].attributeDefaults = traitBuilderArg;
      }
      return factoryBuilder;
    },
    afterBuild(afterBuildCallback) {
      definition.afterBuildHooks.push(afterBuildCallback);
      return factoryBuilder;
    },
  };
  return factoryBuilder;
}
