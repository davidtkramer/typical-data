import { createDatabase } from '../database';
import { createFactory } from '../factory';

interface User {
  id: number;
  name: string;
  isAdmin: boolean;
}

const userFactory = createFactory((factory) =>
  factory
    .transient({
      foo: 'foo',
    })
    .attributes<User>({
      id: ({ sequence }) => sequence + 1,
      name: 'Alice',
      isAdmin: false,
    })
    .trait('admin', (trait) =>
      trait.attributes({
        isAdmin: true,
      })
    )
);

describe('Database factory', () => {
  describe('create', () => {
    it('loads unnamed fixtures on creation', () => {
      const db = createDatabase({
        factories: { users: userFactory },
        fixtures({ users }) {
          users.create();
        },
      });

      expect(db.users).toHaveLength(1);
      expect(db.fixtures).toBeUndefined();
    });

    it('loads named fixtures on creation', () => {
      const db = createDatabase({
        factories: { users: userFactory },
        fixtures({ users }) {
          return {
            users: { current: users.create() },
          };
        },
      });

      expect(db.users).toHaveLength(1);
      expect(db.fixtures.users.current).toBeDefined();
    });

    it('does not require named fixtures for every entity type', () => {
      const db = createDatabase({
        factories: {
          users: createFactory<{ id: string }>({ id: '1' }),
          contacts: createFactory<{ id: string }>({ id: '1' }),
        },
        fixtures({ users }) {
          return {
            // okay to not provide fixtures for contacts
            users: { current: users.create() },
          };
        },
      });

      expect(db.fixtures.users.current).toBeDefined();
    });

    it('handles nested factories', () => {
      type BaseContact = { id: number; type: 'business' | 'individual' };
      interface IndividualContact extends BaseContact {
        type: 'individual';
        fullName: string;
      }
      interface BusinessContact extends BaseContact {
        type: 'business';
        businessName: string;
      }

      const db = createDatabase({
        factories: {
          contacts: {
            individual: createFactory((factory) =>
              factory.attributes<IndividualContact>({
                id: ({ sequence }) => sequence,
                type: 'individual',
                fullName: 'Alice',
              })
            ),
            business: createFactory((factory) =>
              factory.attributes<BusinessContact>({
                id: ({ sequence }) => sequence,
                type: 'business',
                businessName: 'Mega Lo Mart',
              })
            ),
          },
        },
        fixtures(self) {
          return {
            contacts: {
              contact1: self.contacts.business.create(),
              contact2: self.contacts.individual.create(),
            },
          };
        },
      });

      db.contacts.individual.create();
      db.contacts.individual.createList(1);
      db.contacts.business.create();
      db.contacts.business.createList(1);

      expect(db.contacts).toHaveLength(6);

      // can store mix of entity types
      expect(db.contacts[0].type).toBe('business');
      expect(db.contacts[1].type).toBe('individual');
      expect(db.contacts[2].type).toBe('individual');
      expect(db.contacts[3].type).toBe('individual');
      expect(db.contacts[4].type).toBe('business');
      expect(db.contacts[5].type).toBe('business');

      // shares sequence between entity types
      expect(db.contacts[0].id).toBe(0);
      expect(db.contacts[1].id).toBe(1);
      expect(db.contacts[2].id).toBe(2);
      expect(db.contacts[3].id).toBe(3);
      expect(db.contacts[4].id).toBe(4);
      expect(db.contacts[5].id).toBe(5);

      db.contacts.reset();

      // contact store is reset
      expect(db.contacts).toHaveLength(0);
      // shared sequence is reset
      expect(db.contacts.individual.create().id).toBe(0);
    });
  });
});

describe('database instance', () => {
  describe('reset', () => {
    it('resets entities and fixtures', () => {
      const db = createDatabase({
        factories: { users: userFactory },
        fixtures({ users }) {
          return {
            users: { current: users.create() },
          };
        },
      });

      expect(db.users).toHaveLength(1);
      expect(db.fixtures.users.current).toBeDefined();
      const user = db.fixtures.users.current;
      db.reset();
      expect(db.users).toHaveLength(1);
      expect(db.fixtures.users.current).toBeDefined();
      expect(db.fixtures.users.current).not.toBe(user);
    });
  });
});

describe('entity store', () => {
  const db = createDatabase({
    factories: {
      users: userFactory,
    },
  });

  beforeEach(() => {
    db.reset();
  });

  describe('create', () => {
    it('creates default entity', () => {
      const user = db.users.create();
      expect(user).toEqual({
        id: 1,
        isAdmin: false,
        name: 'Alice',
      });
    });

    it('creates entity with trait and attribute overrides', () => {
      const user = db.users.create('admin', { name: 'Bob', foo: 'bar' });
      expect(user).toEqual({
        id: 1,
        name: 'Bob',
        isAdmin: true,
      });
    });
  });

  describe('createList', () => {
    it('creates list of default entities', () => {
      const users = db.users.createList(2);
      expect(users).toHaveLength(2);
      expect(users[0]).toEqual({ id: 1, name: 'Alice', isAdmin: false });
      expect(users[1]).toEqual({ id: 2, name: 'Alice', isAdmin: false });
    });

    it('create list of entities with trait and attribute overrides', () => {
      const users = db.users.createList(2, 'admin', {
        name: 'Bob',
        foo: 'bar',
      });
      expect(users).toHaveLength(2);
      expect(users[0].name).toBe('Bob');
      expect(users[0].isAdmin).toBe(true);
      expect(users[1].name).toBe('Bob');
      expect(users[1].isAdmin).toBe(true);
    });
  });

  describe('reset', () => {
    it('resets entity store', () => {
      db.users.createList(2);
      expect(db.users).toHaveLength(2);
      const deletedUsers = db.users.reset();
      expect(deletedUsers).toHaveLength(2);
      expect(db.users).toHaveLength(0);
    });
  });
});
