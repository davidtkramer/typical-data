import { Database } from '../database.new';
import { Factory } from '../factory.new';

interface User {
  id: number;
  name: string;
  isAdmin: boolean;
}

const userFactory = Factory.define((factory) =>
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

const db = Database.create({
  models: {
    users: userFactory,
  },
});

describe('entity store', () => {
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
