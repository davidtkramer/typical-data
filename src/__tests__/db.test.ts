import { Factory } from '../factory';
import { DB } from '../db';

interface Room {
  id: string;
  firmId: string;
  type: 'channel' | 'direct';
  name: string;
  createdBy: string;
}

const db = DB.setup({
  factories: {
    rooms: new Factory<Room, { userId: string }>({
      id({ sequence }) {
        return sequence.toString();
      },
      firmId: 'firmId',
      type: 'channel',
      name({ params, sequence }) {
        return params.type === 'channel' ? `room-${sequence}` : '';
      },
      createdBy({ transientParams }) {
        return transientParams?.userId ?? '';
      },
    }),
  },
  fixtures(self) {
    return {
      rooms: {
        general: self.create('rooms', { name: 'general' }),
      },
    };
  },
});

describe('DB', () => {
  beforeEach(() => {
    db.reset();
  });

  it('creates entity', () => {
    const room = db.create('rooms');

    expect(room.id).toBe('2');
    expect(room.firmId).toBe('firmId');
    expect(room.type).toBe('channel');
    expect(room.name).toBe('room-2');
    expect(room.createdBy).toBe('');
    expect(db.rooms).toHaveLength(2);
    expect(db.rooms[1].id).toBe('2');
    expect(db.rooms[1].firmId).toBe('firmId');
    expect(db.rooms[1].type).toBe('channel');
    expect(db.rooms[1].name).toBe('room-2');
    expect(db.rooms[1].createdBy).toBe('');
  });

  it('creates entity with overridden params', () => {
    const room = db.create('rooms', { name: 'general' }, { userId: 'userId' });

    expect(room.name).toBe('general');
    expect(room.createdBy).toBe('userId');
    expect(db.rooms).toHaveLength(2);
    expect(db.rooms[1].name).toBe('general');
    expect(db.rooms[1].createdBy).toBe('userId');
  });

  it('creates list of entities', () => {
    const rooms = db.createList('rooms', 2);

    expect(rooms).toHaveLength(2);
    expect(db.rooms).toHaveLength(3);
  });

  it('creates list of entities with overridden params', () => {
    const rooms = db.createList(
      'rooms',
      2,
      { name: 'name' },
      { userId: 'userId' }
    );

    expect(rooms).toHaveLength(2);
    expect(rooms[1].name).toBe('name');
    expect(rooms[1].createdBy).toBe('userId');
    expect(db.rooms).toHaveLength(3);
    expect(db.rooms[1].name).toBe('name');
    expect(db.rooms[1].createdBy).toBe('userId');
  });

  it('loads named fixtures', () => {
    const generalRoom = db.fixtures.rooms.general;
    expect(generalRoom).toBeTruthy();
  });
});
