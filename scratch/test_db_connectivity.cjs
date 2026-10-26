const path = require('path');
const dotenv = require(path.join(__dirname, '../backend/node_modules/dotenv'));
dotenv.config({ path: path.resolve(__dirname, '..', 'backend', '.env') });
const mongoose = require(path.join(__dirname, '../backend/node_modules/mongoose'));

async function testConnection() {
  console.log('--- Database Diagnostic Check ---');
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('ERROR: MONGO_URI is missing from backend/.env');
    process.exit(1);
  }
  
  // Mask URI for safe output
  const maskedUri = uri.replace(/:\/\/([^:]+):([^@]+)@/, '://***:***@');
  console.log('Sanitized URI target:', maskedUri.split('?')[0]);

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
    });

    console.log('Connection Status: SUCCESS (Connected)');
    console.log('Database Name:', conn.connection.name);
    console.log('Host:', conn.connection.host);
    console.log('ReadyState:', conn.connection.readyState);

    // List collections
    const collections = await conn.connection.db.listCollections().toArray();
    console.log('Collections count:', collections.length);
    console.log('Collection names:', collections.map(c => c.name).sort().join(', '));

    // Query counts
    const Hotel = require('../backend/models/Hotel');
    const RoomType = require('../backend/models/RoomType');
    const Cab = require('../backend/models/Cab');
    const Tour = require('../backend/models/Tour');
    const User = require('../backend/models/User');
    const Booking = require('../backend/models/Booking');

    const [
      totalHotels,
      activeApprovedHotels,
      dharamshalaCount,
      hotelCount,
      totalRoomTypes,
      activeApprovedRooms,
      totalCabs,
      activeCabs,
      totalTours,
      activeTours,
      totalUsers,
      totalBookings
    ] = await Promise.all([
      Hotel.countDocuments(),
      Hotel.countDocuments({ status: 'active', approvalStatus: 'approved' }),
      Hotel.countDocuments({ propertyType: 'dharamshala' }),
      Hotel.countDocuments({ propertyType: 'hotel' }),
      RoomType.countDocuments(),
      RoomType.countDocuments({ status: 'active', approvalStatus: 'approved' }),
      Cab.countDocuments(),
      Cab.countDocuments({ status: 'active' }),
      Tour.countDocuments(),
      Tour.countDocuments({ status: 'active' }),
      User.countDocuments(),
      Booking.countDocuments(),
    ]);

    console.log('\n--- Collection Record Counts ---');
    console.log('Hotels: Total =', totalHotels, '| Active & Approved =', activeApprovedHotels, `(Dharamshalas: ${dharamshalaCount}, Commercial Hotels: ${hotelCount})`);
    console.log('RoomTypes: Total =', totalRoomTypes, '| Active & Approved =', activeApprovedRooms);
    console.log('Cabs: Total =', totalCabs, '| Active =', activeCabs);
    console.log('Tours: Total =', totalTours, '| Active =', activeTours);
    console.log('Users: Total =', totalUsers);
    console.log('Bookings: Total =', totalBookings);

    // Sample first active hotel and room type to inspect schema fields
    const sampleHotel = await Hotel.findOne({ status: 'active', approvalStatus: 'approved' }).lean();
    if (sampleHotel) {
      console.log('\nSample Active Approved Hotel:');
      console.log('- ID:', String(sampleHotel._id));
      console.log('- Name:', sampleHotel.name);
      console.log('- PropertyType:', sampleHotel.propertyType);
      console.log('- Location:', sampleHotel.location);
      console.log('- Status:', sampleHotel.status);
      console.log('- ApprovalStatus:', sampleHotel.approvalStatus);
      console.log('- Lat/Lng:', sampleHotel.lat, sampleHotel.lng);
    } else {
      console.log('\nWARNING: Zero active and approved hotels found in database!');
    }

    const sampleRoom = await RoomType.findOne({ status: 'active', approvalStatus: 'approved' }).lean();
    if (sampleRoom) {
      console.log('\nSample Active Approved RoomType:');
      console.log('- ID:', String(sampleRoom._id));
      console.log('- Name:', sampleRoom.name);
      console.log('- HotelId:', String(sampleRoom.hotelId));
      console.log('- BasePrice:', sampleRoom.basePrice);
      console.log('- Status:', sampleRoom.status);
      console.log('- ApprovalStatus:', sampleRoom.approvalStatus);
    } else {
      console.log('\nWARNING: Zero active and approved room types found in database!');
    }

    await mongoose.disconnect();
    console.log('\nDisconnected cleanly.');
  } catch (err) {
    console.error('DATABASE CONNECTION ERROR:', err.name, err.message);
  }
}

testConnection();
