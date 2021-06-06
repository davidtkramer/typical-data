import { Factory } from '../factory';

interface Room {
  id: string;
  firmId: string;
  type: 'channel' | 'direct';
  name: string;
  createdBy: string;
}

const roomFactory = new Factory<Room, { userId: string }>(
  {
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
  },
  {
    afterCreate(room, { transientParams }) {
      if (!transientParams?.userId) {
        room.createdBy = 'userId';
      }
    },
  }
);

describe('Factory', () => {
  beforeEach(() => {
    roomFactory.rewindSequence();
  });

  it('builds entity', () => {
    const params: Partial<Room> = {
      firmId: 'firmId',
      type: 'channel',
    };

    const room = roomFactory.build(params, { userId: 'newUserId' });

    expect(room.id).toBe('1');
    expect(room.firmId).toBe(params.firmId);
    expect(room.type).toBe(params.type);
    expect(room.name).toBe('room-1');
    expect(room.createdBy).toBe('newUserId');
  });

  it('builds list of entities', () => {
    const params: Partial<Room> = {
      firmId: 'firmId',
      type: 'channel',
    };

    const rooms = roomFactory.buildList(2, params);

    expect(rooms).toHaveLength(2);
  });

  it('increments sequence after every build', () => {
    const params: Partial<Room> = {
      firmId: 'firmId',
      type: 'channel',
    };

    const room1 = roomFactory.build(params);
    const room2 = roomFactory.build(params);
    const room3 = roomFactory.build(params);

    expect(room1.id).toBe('1');
    expect(room1.name).toBe('room-1');
    expect(room2.id).toBe('2');
    expect(room2.name).toBe('room-2');
    expect(room3.id).toBe('3');
    expect(room3.name).toBe('room-3');
  });

  it('modifies result entity in afterCreate hook', () => {
    const room = roomFactory.build();

    expect(room.createdBy).toBe('userId');
  });
});


// Factory.define<Room, { userId: string }>()
//   .attributes({
//     id({ sequence }) {
//       return sequence.toString();
//     },
//     firmId: 'firmId',
//     type: 'channel',
//     name({ params, sequence }) {
//       return params.type === 'channel' ? `room-${sequence}` : '';
//     },
//     createdBy({ transientParams }) {
//       return transientParams?.userId ?? '';
//     },
//   })
//   .trait('contact', (trait) =>
//     trait
//       .attributes({ type: 'contact' })
//       .afterBuild((entity, { transientParams }) => {
//         entity.roomId;
//       })
//   )
//   .trait('direct', {})
//   .afterBuild(() => {});