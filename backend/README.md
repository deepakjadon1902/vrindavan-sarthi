# VrindavanSarthi Backend

## Setup

1. Copy `.env.example` to `.env` and update `MONGO_URI` with your MongoDB connection string
2. Run `npm install`
3. Run `npm run dev` for development or `npm start` for production

## API Endpoints

### Auth
- `POST /api/auth/register` - Register user/partner
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get profile (protected)
- `PUT /api/auth/me` - Update profile (protected)

### Hotels
- `GET /api/hotels` - Get all active hotels
- `GET /api/hotels/:id` - Get single hotel
- `POST /api/hotels` - Create hotel (admin)
- `PUT /api/hotels/:id` - Update hotel (admin)
- `DELETE /api/hotels/:id` - Delete hotel (admin)

### Rooms
- `GET /api/rooms` - Get all available rooms
- `GET /api/rooms/:id` - Get single room
- `POST /api/rooms` - Create room (admin)
- `PUT /api/rooms/:id` - Update room (admin)
- `DELETE /api/rooms/:id` - Delete room (admin)

### Cabs
- `GET /api/cabs` - Get all available cabs
- `POST /api/cabs` - Create cab (admin)
- `PUT /api/cabs/:id` - Update cab (admin)
- `DELETE /api/cabs/:id` - Delete cab (admin)

### Tours
- `GET /api/tours` - Get all active tours
- `POST /api/tours` - Create tour (admin)
- `PUT /api/tours/:id` - Update tour (admin)
- `DELETE /api/tours/:id` - Delete tour (admin)

### Bookings
- `POST /api/bookings` - Create booking (user)
- `GET /api/bookings/my` - Get user bookings
- `GET /api/bookings/partner` - Get partner bookings
- `GET /api/bookings/all` - Get all bookings (admin)
- `PUT /api/bookings/:id/cancel` - Cancel booking

### Partner
- `POST /api/partner/hotels` - Submit hotel (partner)
- `POST /api/partner/rooms` - Submit room (partner)
- `GET /api/partner/my-listings` - Get partner listings
- `GET /api/partner/requests` - Get all partner requests (admin)
- `PUT /api/partner/hotels/:id/status` - Approve/reject hotel (admin)
- `PUT /api/partner/rooms/:id/status` - Approve/reject room (admin)

### Users
- `GET /api/users` - Get all users (admin)
- `DELETE /api/users/:id` - Delete user (admin)
