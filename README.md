# Smart Cooperative Society Management System

A production-ready full-stack application for managing agricultural cooperative societies with role-based access control, inventory management, government scheme eligibility, AI-powered chatbot, and warehouse monitoring.

## Tech Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Prisma ORM** - Database ORM
- **PostgreSQL** - Database
- **JWT** - Authentication
- **Gemini API** - AI Chatbot

### Frontend
- **React** - UI library
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **React Router** - Navigation
- **Axios** - HTTP client
- **Lucide React** - Icons

## Features

### Role-Based Access Control
- **Admin**: Full access to all modules
- **Cooperative Staff**: Manage farmers, inventory, schemes
- **Farmer**: View eligible schemes, inventory status, announcements

### Modules

1. **Authentication**
   - JWT-based authentication
   - Role-based authorization
   - Secure password hashing with bcrypt

2. **Farmer Management**
   - Add, edit, delete farmers
   - Store name, mobile number, village, land size, crop, membership ID
   - Search and filter farmers

3. **Inventory Management**
   - Manage seeds, fertilizers, and pesticides
   - Track available quantity
   - Low-stock alerts
   - Transaction history

4. **Government Scheme Management**
   - Admin can create schemes with eligibility rules
   - Rule-based eligibility engine
   - Farmers view only eligible schemes

5. **AI Chatbot**
   - Integrated with Gemini API
   - Context-aware responses based on user role
   - Answers questions about schemes, inventory, profile

6. **Announcements**
   - Admin creates announcements
   - All users can view announcements

7. **Warehouse Monitoring**
   - ESP32 temperature and humidity data endpoint
   - Real-time monitoring dashboard
   - High humidity alerts (>70%)

8. **Dashboard**
   - Total farmers count
   - Available inventory items
   - Active government schemes
   - Warehouse status
   - Recent announcements

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v14 or higher)
- npm or yarn
- Gemini API key (for chatbot)

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd cooperative_management
```

### 2. Backend Setup

```bash
cd backend
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the `backend` directory:

```env
PORT=5000
DATABASE_URL="postgresql://username:password@localhost:5432/cooperative_db?schema=public"
JWT_SECRET=your_jwt_secret_key_here
GEMINI_API_KEY=your_gemini_api_key_here
```

### 4. Set Up PostgreSQL Database

Create a PostgreSQL database named `cooperative_db`:

```sql
CREATE DATABASE cooperative_db;
```

### 5. Run Prisma Migrations

```bash
npx prisma generate
npx prisma migrate dev --name init
```

### 6. Frontend Setup

```bash
cd ../frontend
npm install
```

## Running the Application

### Start Backend Server

```bash
cd backend
npm run dev
```

The backend will run on `http://localhost:5000`

### Start Frontend Development Server

```bash
cd frontend
npm run dev
```

The frontend will run on `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Farmers
- `GET /api/farmers` - Get all farmers (with search/filter)
- `GET /api/farmers/:id` - Get farmer by ID
- `POST /api/farmers` - Create farmer (Admin/Staff)
- `PUT /api/farmers/:id` - Update farmer (Admin/Staff)
- `DELETE /api/farmers/:id` - Delete farmer (Admin)

### Inventory
- `GET /api/inventory` - Get all inventory items
- `GET /api/inventory/:id` - Get inventory item by ID
- `POST /api/inventory` - Create inventory item (Admin/Staff)
- `PUT /api/inventory/:id` - Update inventory item (Admin/Staff)
- `DELETE /api/inventory/:id` - Delete inventory item (Admin)
- `POST /api/inventory/:id/transaction` - Record transaction (Admin/Staff)

### Schemes
- `GET /api/schemes` - Get all schemes
- `GET /api/schemes/eligible/:farmerId` - Get eligible schemes for farmer
- `GET /api/schemes/:id` - Get scheme by ID
- `POST /api/schemes` - Create scheme (Admin)
- `PUT /api/schemes/:id` - Update scheme (Admin)
- `DELETE /api/schemes/:id` - Delete scheme (Admin)

### Announcements
- `GET /api/announcements` - Get all announcements
- `GET /api/announcements/:id` - Get announcement by ID
- `POST /api/announcements` - Create announcement (Admin)
- `PUT /api/announcements/:id` - Update announcement (Admin)
- `DELETE /api/announcements/:id` - Delete announcement (Admin)

### Warehouse
- `GET /api/warehouse/latest` - Get latest warehouse data
- `GET /api/warehouse/history` - Get warehouse history
- `POST /api/warehouse` - Submit warehouse data (ESP32)

### Chatbot
- `POST /api/chatbot` - Send message to AI chatbot

### Dashboard
- `GET /api/dashboard` - Get dashboard metrics

## ESP32 Integration

To connect ESP32 for warehouse monitoring:

1. Configure WiFi credentials in ESP32 code
2. Set server URL to your backend endpoint
3. Send POST requests to `/api/warehouse` with temperature and humidity data

Example request body:
```json
{
  "temperature": 25.5,
  "humidity": 65.0
}
```

See the Warehouse page in the application for complete ESP32 code example.

## Database Schema

### User
- id, email, password, name, role (ADMIN/STAFF/FARMER)

### Farmer
- id, userId, membershipId, name, mobileNumber, village, landSize, crop

### Inventory
- id, name, type (SEED/FERTILIZER/PESTICIDE), quantity, unit, minStock

### InventoryTransaction
- id, inventoryId, farmerId, quantity, type (IN/OUT), date

### Scheme
- id, title, description, eligibilityRules (JSON), requiredDocuments, deadline, benefits

### Announcement
- id, title, content, createdAt

### WarehouseData
- id, temperature, humidity, timestamp

## Default Users

After registration, create users with different roles:
- **Admin**: Full system access
- **Staff**: Manage farmers and inventory
- **Farmer**: View schemes and announcements

## Development

### Prisma Studio
To view and edit database data:
```bash
cd backend
npx prisma studio
```

### Build for Production

#### Backend
```bash
cd backend
npm start
```

#### Frontend
```bash
cd frontend
npm run build
npm run preview
```

## Project Structure

```
cooperative_management/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── routes/
│   │   └── server.js
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js
└── README.md
```

## Security Features

- Password hashing with bcrypt
- JWT token authentication
- Role-based access control
- Input validation with express-validator
- CORS enabled
- Environment variable configuration

## License

ISC

## Support

For issues and questions, please open an issue on the repository.
