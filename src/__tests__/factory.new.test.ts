import { Factory } from '../factory.new';

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

describe('Factory', () => {
  describe('build', () => {
    it('builds entity with no attribute overrides', () => {
      userFactory.build();
    });

    it('builds entity with attribute overrides', () => {
      userFactory.build({ id: 1 });
    });

    it('builds entity with attribute overrides and global transient params', () => {
      userFactory.build({ id: 1, baz: true });
    });

    it('builds entity with single trait', () => {
      userFactory.build('admin');
      userFactory.build('inactive');
    });

    it('builds entity with single trait and attribute overrides', () => {
      userFactory.build('inactive', { id: 1 });
    });

    it('builds entity with single trait, trait transient params, and attribute overrides', () => {
      userFactory.build('admin', { id: 1, foo: true });
    });

    it('builds entity with single trait, global transient params, and attribute overrides ', () => {
      userFactory.build('admin', { id: 1, baz: true });
    });

    it('builds entity with multiple traits', () => {
      userFactory.build('admin', 'inactive');
    });

    it('builds entity with multiple traits, one trait transient param, and attribute overrides', () => {
      userFactory.build('admin', 'inactive', { id: 1, foo: true });
    });

    it('builds entity with multiple traits, multiple trait transient params, and attribute overrides', () => {
      userFactory.build('admin', 'inactive', 'standard', {
        id: 1,
        foo: true,
        bar: '',
      });
    });

    it('increments sequence for each invocation', () => {});

    // type tests

    it('rejects trait transient params when no traits are provided', () => {
      // @ts-expect-error - foo is not available
      userFactory.build({ foo: true });
    });

    it('rejects trait transient params when corresponding trait is absent', () => {
      // @ts-expect-error - foo is not available
      userFactory.build('inactive', { foo: true });
      // @ts-expect-error - bar is not available
      userFactory.build('admin', 'inactive', { foo: true, bar: '' });
      // @ts-expect-error - bar is not available
      userFactory.build('admin', { foo: true, bar: '' });
    });
  });
});

describe('factory DSL', () => {
  describe('transient', () => {});
  describe('attributes', () => {});
  describe('trait', () => {});
  describe('afterCreate', () => {});
});
