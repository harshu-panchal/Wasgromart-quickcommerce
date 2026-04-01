import { EventEmitter } from 'events';
import * as service from '../backend/src/services/orderNotificationService';

// Mock Socket.io Server
class MockIO extends EventEmitter {
    sockets = {
        adapter: {
            rooms: new Map()
        }
    };
    to(room: string) {
        return {
            emit: (event: string, data: any) => {
                console.log(`[EVENT] Emitted '${event}' to ${room}`, data);
                this.emit(event, { room, data });
            }
        };
    }
}

async function testCascading() {
    console.log('--- STARTING CASCADING VERIFICATION ---');
    
    const io = new MockIO() as any;
    const orderId = 'order_123';
    
    // Mock Order Data
    const mockOrder = {
        _id: orderId,
        orderNumber: 'ORD-TEST-001',
        customerName: 'John Doe',
        customerPhone: '1234567890',
        deliveryAddress: {
            address: '123 Main St',
            city: 'Test City',
            pincode: '123456'
        },
        total: 500,
        subtotal: 450,
        shipping: 50,
        createdAt: new Date()
    };

    // 1. Mock 'findDeliveryBoysNearSellerLocations' to return 3 IDs in order
    const deliveryBoys = ['DB_001_NEAREST', 'DB_002_MID', 'DB_003_FURTHER'];
    
    // We need to bypass the DB calls in the real service
    // For this test, manually populate the state as if it was initialized
    const state: service.OrderNotificationState = {
        orderId,
        allNearbyDeliveryBoyIds: deliveryBoys,
        currentIndex: -1,
        notifiedDeliveryBoys: new Set(),
        rejectedDeliveryBoys: new Set(),
        acceptedBy: null,
        orderData: { ...mockOrder, orderId }
    };
    
    service.notificationStates.set(orderId, state);
    
    // Mock the rooms to show delivery boys are connected
    deliveryBoys.forEach(id => {
        io.sockets.adapter.rooms.set(`delivery-${id}`, { size: 1 });
    });

    console.log('\n--- Step 1: Initial Notification ---');
    await service.notifyNextDeliveryBoy(io, orderId);
    // Should notify DB_001_NEAREST

    console.log('\n--- Step 2: First Rejection ---');
    await service.handleOrderRejection(io, orderId, 'DB_001_NEAREST');
    // Should notify DB_002_MID

    console.log('\n--- Step 3: Second Rejection ---');
    await service.handleOrderRejection(io, orderId, 'DB_002_MID');
    // Should notify DB_003_FURTHER

    console.log('\n--- Step 4: Final Rejection ---');
    const result = await service.handleOrderRejection(io, orderId, 'DB_003_FURTHER');
    // Should exhaust the list
    console.log('Final Result All Rejected:', result.allRejected);

    console.log('\n--- VERIFICATION COMPLETE ---');
}

testCascading().catch(console.error);
