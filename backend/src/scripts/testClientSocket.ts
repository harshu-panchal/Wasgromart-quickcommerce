import { ensureEnvLoaded } from '../config/env';
// Ensure env loaded FIRST before importing services that use env variables!
ensureEnvLoaded();

import { io } from 'socket.io-client';
import { generateToken } from '../services/jwtService';

const run = async () => {
  console.log('JWT_SECRET loaded in test script:', process.env.JWT_SECRET ? '✅ Yes (Length: ' + process.env.JWT_SECRET.length + ')' : '❌ No');
  
  const userId = '694642017853dc37b93292b4'; // Test Delivery ID
  const token = generateToken(userId, 'Delivery');
  console.log('🔑 Generated Token:', token);

  const socket = io('http://localhost:5000', {
    auth: {
      token,
    },
    transports: ['websocket'],
  });

  socket.on('connect', () => {
    console.log('🔌 Connected to Socket.io server successfully!');
    console.log('Socket ID:', socket.id);

    console.log('🔔 Emitting join-delivery-notifications...');
    socket.emit('join-delivery-notifications', userId);
  });

  socket.on('joined-notifications-room', (data) => {
    console.log('✅ Received joined-notifications-room response:', data);
    
    // Keep it open for 5 seconds then exit
    setTimeout(() => {
      console.log('👋 Disconnecting...');
      socket.disconnect();
      process.exit(0);
    }, 5000);
  });

  socket.on('connect_error', (error) => {
    console.error('❌ Connection error:', error.message);
    process.exit(1);
  });

  socket.on('disconnect', (reason) => {
    console.log('⚠️ Disconnected:', reason);
  });
};

run().catch(console.error);
