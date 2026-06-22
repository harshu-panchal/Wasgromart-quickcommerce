import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Order from '../models/Order';
import { notifyDeliveryBoysOfNewOrder, notificationStates } from '../services/orderNotificationService';

dotenv.config();

const orderId = '6a0ee8c777d8686c566337b8';

// Create a rich mock of the Socket.io server to track calls and simulate socket rooms
const createMockIo = (connectedRooms: Set<string>) => {
  const emits: any[] = [];
  
  const mockAdapter = {
    rooms: {
      get: (roomName: string) => {
        console.log(`[Mock IO] adapter.rooms.get("${roomName}") called`);
        if (connectedRooms.has(roomName)) {
          return { size: 1, values: () => ['mock-socket-id'] };
        }
        return undefined;
      }
    }
  };

  const mockTo = (roomName: string) => {
    console.log(`[Mock IO] to("${roomName}") called`);
    return {
      emit: (event: string, data: any) => {
        console.log(`[Mock IO] emit("${event}") to room "${roomName}" called with data:`, data);
        emits.push({ room: roomName, event, data });
      }
    };
  };

  return {
    sockets: {
      adapter: mockAdapter
    },
    to: mockTo,
    emits
  };
};

async function run() {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI missing');
      return;
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');

    const OrderModel = (Order as any).default || Order;

    const fullOrder = await OrderModel.findById(orderId)
      .populate({
        path: 'items',
        populate: { path: 'seller' }
      })
      .lean();

    if (!fullOrder) {
      console.error('❌ Order not found in database');
      return;
    }

    console.log('\n--- SIMULATING WITH "TEST DELIVERY" (694642017853dc37b93292b4) CONNECTED ---');
    // Simulate that room "delivery-694642017853dc37b93292b4" has connected sockets
    const mockIo = createMockIo(new Set(['delivery-694642017853dc37b93292b4']));

    // Clear notification states map
    notificationStates.clear();

    console.log('🚀 Triggering notifyDeliveryBoysOfNewOrder...');
    await notifyDeliveryBoysOfNewOrder(mockIo as any, fullOrder);

    console.log('\n📊 Trace Results:');
    console.log('Emitted Events count:', mockIo.emits.length);
    console.log('Emitted Events:', JSON.stringify(mockIo.emits, null, 2));

    const finalState = notificationStates.get(orderId);
    console.log('\n📊 Final notification state in memory:', {
      orderId: finalState?.orderId,
      allNearbyDeliveryBoyIds: finalState?.allNearbyDeliveryBoyIds,
      currentIndex: finalState?.currentIndex,
      notifiedDeliveryBoys: Array.from(finalState?.notifiedDeliveryBoys || []),
      rejectedDeliveryBoys: Array.from(finalState?.rejectedDeliveryBoys || []),
      acceptedBy: finalState?.acceptedBy,
      hasTimeout: !!finalState?.timeoutId
    });

    // Clear timeout if active
    if (finalState && finalState.timeoutId) {
      clearTimeout(finalState.timeoutId);
      console.log('🧹 Cleared mock timeout.');
    }

  } catch (error: any) {
    console.error('❌ Error in tracer:', error);
  } finally {
    await mongoose.disconnect();
  }
}

run();
