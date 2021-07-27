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

type SchemaAttribute<Entity, TransientParams, Property extends keyof Entity> =
  | AttributeBuilder<Entity, TransientParams, Property>
  | Entity[Property];

type Schema<Entity, TransientParams> = {
  [Property in keyof Entity]: SchemaAttribute<
    Entity,
    TransientParams,
    Property
  >;
};

interface FactoryOptions<Entity, TransientParams> {
  afterCreate?(
    entity: Entity,
    params: { transientParams?: TransientParams }
  ): void;
}

export class Factory<Entity, TransientParams = Record<string, any>> {
  private schema: Schema<Entity, Partial<TransientParams>>;
  private sequence = 0;
  private options: FactoryOptions<Entity, Partial<TransientParams>>;

  constructor(
    schema: Schema<Entity, Partial<TransientParams>>,
    options: FactoryOptions<Entity, Partial<TransientParams>> = {}
  ) {
    this.schema = schema;
    this.options = options;
  }

  build(params?: Partial<Entity>, transientParams?: Partial<TransientParams>) {
    const sequence = ++this.sequence;
    const result: Partial<Entity> = {};
    for (let key in this.schema) {
      let attribute = this.schema[key];
      if (typeof attribute === 'function') {
        result[key] = attribute({
          sequence,
          params: { ...result, ...params },
          transientParams,
        });
      } else {
        result[key] = attribute as any;
      }
    }
    const entity = { ...result, ...params } as Entity;
    this.options?.afterCreate?.(entity, { transientParams });
    return entity;
  }

  buildList(
    count: number,
    params?: Partial<Entity>,
    transientParams?: Partial<TransientParams>
  ) {
    let result = [];
    for (let i = 0; i < count; i++) {
      result.push(this.build(params, transientParams));
    }
    return result;
  }

  rewindSequence() {
    this.sequence = 0;
  }
}
