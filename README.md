# SkillDuel Arena

# ULTIMATE PROMPT - SKILL2CASH SYSTEM CREATION

You are an expert full-stack developer with deep knowledge of modern web development, database design, and payment systems. Your task is to build SKILL2CASH, a complete eFootball 1v1 money duel platform from scratch.

## PROJECT OVERVIEW

SKILL2CASH is a V1 full-stack platform for eFootball 1v1 money duels. Players can challenge each other with real money stakes, play matches, and have results validated through a consensus-based voting system.

**Tagline:** NO SKILL. NO CASH.

## TECHNICAL STACK

### Backend
- Node.js with Express.js
- MongoDB with Mongoose ODM
- MongoDB Atlas for production (replica set for transactions)
- JWT authentication with bcrypt
- Socket.io for real-time notifications
- Redis for session management (optional in V1)
- Dev-X API (OpenAI-compatible) for AI assistant

### Frontend
- React with Vite
- Lucide React for icons
- Socket.io client for real-time
- TailwindCSS for styling (or custom CSS)
- Cyberpunk dark UI theme

### Database
- MongoDB with Mongoose models
- Transactions for wallet operations
- Replica set required for transaction support

## CORE FEATURES

### 1. User System
- Registration with email, username, password
- Username is locked to exact eFootball username after registration
- Username changes require admin approval
- User profiles with: efootballUsername, country, rank, badge, wins, losses, currentStreak, totalEarnings, reputation
- User roles: player, admin
- Ban system for abusive users
- JWT-based authentication

### 2. Wallet System
- Internal wallet with multiple balance types:
  - balanceAvailable: funds available for challenges
  - balanceLocked: funds locked in active duels
  - totalDeposited: lifetime deposits
  - totalWithdrawn: lifetime withdrawals
  - totalWon: lifetime winnings
  - totalLost: lifetime losses
- Every wallet action writes a transaction record
- MongoDB transactions for all wallet operations
- Balance adjustment by admin

### 3. Deposit System (MANUAL VALIDATION)
- Manual deposits with mandatory transaction reference
- Optional screenshot proof
- Fields: amount, senderName, senderPhone, reference (mandatory), screenshot (optional)
- Status: pending, approved, rejected
- Admin approval required before wallet credit
- Admin rejection never changes wallet balance
- Admin notifications for pending deposits
- Transaction reference is mandatory for validation

### 4. Withdrawal System
- Manual withdrawal requests in V1
- Fields: amount, method (Wave, MTN), phoneNumber
- Status: pending, approved, rejected
- Admin approval required
- Fraud detection system
- Admin notifications for pending withdrawals

### 5. Challenge System
- Players can challenge each other with money stakes
- Challenge fields: challenger, challenged, amount, expiresAt
- Challenge actions: accept, decline, counter offer, cancel
- Automatic expiration handling
- Stake locking when challenge is accepted
- Both players must have sufficient balance before duel starts

### 6. Duel System (CONSENSUS-BASED VALIDATION)
- Duel rooms with Socket.io notifications and private chat
- Duel status flow: active → waiting votes → finished/dispute
- **NEW CONSENSUS SYSTEM:**
  - Players vote (Win/Draw/Lose) instead of submitting screenshots
  - Vote fields: player1Vote, player2Vote, player1VotedAt, player2VotedAt
  - Consensus rules:
    - Player1 Win + Player2 Lose = Player1 wins
    - Player1 Lose + Player2 Win = Player2 wins
    - Both Draw = Draw (commission deducted, partial refund)
    - Any other combination = Dispute (admin intervention)
  - Automatic resolution when votes match
  - Dispute when votes are inconsistent
  - Admin can resolve disputes with: winner, draw, cancel, cancel_no_refund

### 7. Commission System
- Dynamic commission settings based on duel amount
- Commission types: small (9%), medium (8%), high (5%), tournament (12%)
- Commission is deducted even on draws
- Draw refund formula: refundAmountPerPlayer = duel.amount - (duel.commissionAmount / 2)
- Admin can configure commission ranges

### 8. Admin Dashboard
- Admin-only endpoints for:
  - User management (view, ban, adjust balance)
  - Deposit validation (approve/reject with reference verification)
  - Withdrawal approval/rejection
  - Dispute resolution (view player votes, resolve as winner/draw/cancel)
  - Username change requests
  - Commission settings management
- Admin logs for all critical actions
- Admin notifications for: pending deposits, pending withdrawals, disputes

### 9. Notification System
- In-app notifications for users
- Admin notifications for critical events
- Telegram notifications (optional)
- Notification types: deposit_pending, withdrawal_pending, dispute_pending, etc.

### 10. AI Assistant
- AI-powered assistant for users and admins
- Context-aware responses based on user role and current view
- Uses Dev-X API (OpenAI-compatible)
- Provides guidance on platform features

## DATABASE MODELS

### User Model
```javascript
{
  username: String (unique, required),
  email: String (unique, required),
  passwordHash: String (required),
  efootballUsername: String (unique, locked after registration),
  firstName: String,
  lastName: String,
  country: String,
  level: String (Elite, Pro, Amateur),
  status: String (active, suspended, banned),
  role: String (player, admin),
  rank: Number,
  badge: String,
  wins: Number (default 0),
  losses: Number (default 0),
  currentStreak: Number (default 0),
  totalEarnings: Number (default 0),
  reputation: Number (default 100),
  reportsCount: Number (default 0),
  isBanned: Boolean (default false),
  deletedAt: Date (soft delete)
}
```

### Wallet Model
```javascript
{
  user: ObjectId (ref: User, unique, required),
  balanceAvailable: Number (default 0),
  balanceLocked: Number (default 0),
  totalDeposited: Number (default 0),
  totalWithdrawn: Number (default 0),
  totalWon: Number (default 0),
  totalLost: Number (default 0),
  deletedAt: Date (soft delete)
}
```

### Transaction Model
```javascript
{
  user: ObjectId (ref: User, required),
  wallet: ObjectId (ref: Wallet, required),
  type: String (deposit, withdrawal, stake_locked, stake_refunded, win, loss, commission, adjustment),
  amount: Number (required),
  balanceBefore: Number,
  balanceAfter: Number,
  status: String (pending, completed, failed),
  description: String,
  relatedDuel: ObjectId (ref: Duel),
  relatedDeposit: ObjectId (ref: Deposit),
  relatedWithdrawal: ObjectId (ref: Withdrawal),
  createdAt: Date (default now)
}
```

### Deposit Model
```javascript
{
  user: ObjectId (ref: User, required),
  amount: Number (required),
  method: String (Wave, MTN, required),
  senderName: String (required),
  senderPhone: String (required),
  reference: String (required, mandatory for validation),
  screenshot: String (optional, URL),
  status: String (pending, approved, rejected, default pending),
  fraudScore: Number (default 0),
  fraudFlags: [String],
  autoVerificationStatus: String (pending, matched, needs_review, failed),
  adminNote: String,
  reviewedBy: ObjectId (ref: User),
  reviewedAt: Date,
  createdAt: Date (default now)
}
```

### Withdrawal Model
```javascript
{
  user: ObjectId (ref: User, required),
  amount: Number (required),
  method: String (Wave, MTN, required),
  phoneNumber: String (required),
  netAmount: Number (amount - fees),
  status: String (pending, approved, rejected, default pending),
  fraudScore: Number (default 0),
  fraudFlags: [String],
  adminNote: String,
  reviewedBy: ObjectId (ref: User),
  reviewedAt: Date,
  createdAt: Date (default now)
}
```

### Challenge Model
```javascript
{
  challenger: ObjectId (ref: User, required),
  challenged: ObjectId (ref: User, required),
  amount: Number (required),
  status: String (pending, counter_offer, accepted, declined, cancelled, expired),
  expiresAt: Date (required),
  acceptedAmount: Number,
  roomId: ObjectId (ref: Room),
  createdAt: Date (default now)
}
```

### Duel Model
```javascript
{
  player1: ObjectId (ref: User, required),
  player2: ObjectId (ref: User, required),
  amount: Number (required),
  commissionAmount: Number (calculated),
  status: String (active, finished, dispute, cancelled),
  roomId: ObjectId (ref: Room),
  challengeId: ObjectId (ref: Challenge),
  
  // NEW CONSENSUS FIELDS
  player1Vote: String (win, draw, lose),
  player2Vote: String (win, draw, lose),
  player1VotedAt: Date,
  player2VotedAt: Date,
  
  winner: ObjectId (ref: User),
  loser: ObjectId (ref: User),
  isDraw: Boolean (default false),
  
  disputeReason: String,
  manualReviewRequestedAt: Date,
  manualReviewDueAt: Date,
  
  finishedAt: Date,
  createdAt: Date (default now)
}
```

### CommissionSetting Model
```javascript
{
  name: String (required),
  type: String (small, medium, high, tournament, required),
  minAmount: Number (required),
  maxAmount: Number (optional),
  rate: Number (required, decimal 0-1),
  active: Boolean (default true),
  createdAt: Date (default now)
}
```

### AdminLog Model
```javascript
{
  admin: ObjectId (ref: User, required),
  action: String (required),
  targetType: String (User, Duel, Deposit, Withdrawal, etc.),
  targetId: ObjectId,
  note: String,
  metadata: Object,
  beforeState: Object,
  afterState: Object,
  createdAt: Date (default now)
}
```

### UsernameChangeRequest Model
```javascript
{
  user: ObjectId (ref: User, required),
  newUsername: String (required),
  reason: String,
  status: String (pending, approved, rejected, default pending),
  reviewedBy: ObjectId (ref: User),
  reviewedAt: Date,
  createdAt: Date (default now)
}
```

### Notification Model
```javascript
{
  user: ObjectId (ref: User, required),
  type: String (required),
  title: String (required),
  body: String (required),
  link: String,
  isRead: Boolean (default false),
  metadata: Object,
  createdAt: Date (default now)
}
```

## API ENDPOINTS

### Authentication
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me

### Users
- GET /api/users
- GET /api/users/search
- GET /api/users/:id
- PATCH /api/users/profile
- POST /api/users/username-change-requests
- GET /api/users/username-change-requests/me

### Wallet
- GET /api/wallet
- GET /api/wallet/deposit-methods
- POST /api/wallet/deposit
- GET /api/wallet/deposits
- POST /api/wallet/withdraw
- GET /api/wallet/transactions

### Challenges
- POST /api/challenges
- GET /api/challenges/incoming
- GET /api/challenges/outgoing
- POST /api/challenges/:id/accept
- POST /api/challenges/:id/decline
- POST /api/challenges/:id/counter
- POST /api/challenges/:id/cancel

### Duels
- GET /api/duels
- GET /api/duels/:id
- POST /api/duels/:id/vote (NEW - consensus voting)
- POST /api/duels/:id/dispute

### Leaderboard
- GET /api/leaderboard

### Admin
- GET /api/admin/overview
- GET /api/admin/users
- GET /api/admin/deposits
- POST /api/admin/deposits/:id/approve
- POST /api/admin/deposits/:id/reject
- GET /api/admin/username-change-requests
- POST /api/admin/username-change-requests/:id/approve
- POST /api/admin/username-change-requests/:id/reject
- GET /api/admin/duels
- GET /api/admin/disputes
- GET /api/admin/disputes/:id/details (show player votes)
- POST /api/admin/disputes/:id/resolve (winner, draw, cancel, cancel_no_refund)
- POST /api/admin/withdrawals/:id/approve
- POST /api/admin/withdrawals/:id/reject
- POST /api/admin/users/:id/ban
- POST /api/admin/users/:id/adjust-balance
- GET /api/admin/commissions
- POST /api/admin/commissions

### AI Assistant
- POST /api/assistant/chat

## BUSINESS RULES

1. **Funds Management**
   - Funds are locked only when a challenge is accepted
   - Both players must have sufficient balance before duel starts
   - Every wallet action writes a transaction record
   - MongoDB transactions required for wallet operations

2. **Duel Settlement**
   - Settlement calculated on backend based on player consensus
   - Players vote (Win/Draw/Lose) on match results
   - Consensus auto-resolves the duel
   - Disputes occur when votes are inconsistent
   - Commission is deducted from pot even on draws
   - Draw refund: each player gets stake - (commission / 2)

3. **Deposits**
   - Transaction reference is mandatory
   - Admin approval required before wallet credit
   - Rejections never change wallet balance
   - Screenshot is optional

4. **Withdrawals**
   - Manual in V1
   - Admin approval required
   - Fraud detection system

5. **Disputes**
   - Keep funds locked until admin resolution
   - Admin can resolve as winner, draw, cancel, or cancel_no_refund
   - Admin sees player votes for decision making

6. **User Management**
   - Username locked to eFootball username after registration
   - Username changes require admin approval
   - Ban system for abusive users

7. **Notifications**
   - Admins notified ONLY for: pending deposits, pending withdrawals, disputes, username changes, suspicious activities
   - Admins NOT notified for: normal duel settlements, room creation, vote submissions

## ENVIRONMENT VARIABLES

```env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/?appName=Cluster0
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
PLATFORM_WALLET_ID=platform
AI_BASE_URL=https://aimodelapi.onrender.com/v1
AI_API_KEY=your-api-key
AI_MODEL=devx
AI_MAX_TOKENS=700
AI_ASSISTANT_ROLE=admin
TELEGRAM_BOT_TOKEN=optional
TELEGRAM_WEBHOOK_URL=optional
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin
ADMIN_PASSWORD=admin123
ADMIN_COUNTRY=Cote d'Ivoire
ADMIN_LEVEL=Elite
ADMIN_EFOOTBALL_USERNAME=admin_efootball
```

## PROJECT STRUCTURE

```
SKILL2CASH-main/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js (MongoDB connection with replica set support)
│   │   │   ├── env.js (Environment variables)
│   │   │   └── payments.js
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── Wallet.js
│   │   │   ├── Transaction.js
│   │   │   ├── Deposit.js
│   │   │   ├── Withdrawal.js
│   │   │   ├── Challenge.js
│   │   │   ├── Duel.js
│   │   │   ├── CommissionSetting.js
│   │   │   ├── AdminLog.js
│   │   │   ├── UsernameChangeRequest.js
│   │   │   ├── Notification.js
│   │   │   └── Session.js
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   ├── userRoutes.js
│   │   │   ├── walletRoutes.js
│   │   │   ├── challengeRoutes.js
│   │   │   ├── duelRoutes.js
│   │   │   ├── adminRoutes.js
│   │   │   └── assistantRoutes.js
│   │   ├── services/
│   │   │   ├── authService.js
│   │   │   ├── walletService.js (with MongoDB transactions)
│   │   │   ├── depositService.js
│   │   │   ├── withdrawalService.js
│   │   │   ├── challengeService.js
│   │   │   ├── duelService.js (consensus-based)
│   │   │   ├── commissionService.js
│   │   │   ├── notificationService.js
│   │   │   ├── assistantService.js (Dev-X API)
│   │   │   └── auditLogService.js
│   │   ├── middleware/
│   │   │   ├── auth.js (JWT verification)
│   │   │   ├── validate.js (Request validation)
│   │   │   └── admin.js (Admin role check)
│   │   ├── utils/
│   │   │   ├── AppError.js
│   │   │   ├── asyncHandler.js
│   │   │   └── telegramNotify.js
│   │   ├── constants/
│   │   │   └── notificationPublicTypes.js
│   │   └── app.js (Express app setup)
│   ├── .env
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx (Main React app with all views)
│   │   ├── components/
│   │   └── styles/
│   ├── .env
│   ├── .env.example
│   └── package.json
├── DOCUMENTATION_FRANÇAIS/
│   └── (French documentation files)
└── README.md
```

## IMPLEMENTATION PRIORITY

1. **Phase 1: Core Infrastructure**
   - Setup Express server with MongoDB connection
   - Implement User model and authentication (JWT)
   - Implement Wallet model with transaction support
   - Implement Transaction model

2. **Phase 2: Wallet Operations**
   - Deposit service with manual validation
   - Withdrawal service with admin approval
   - Transaction logging for all operations
   - Balance adjustment by admin

3. **Phase 3: Challenge System**
   - Challenge model and routes
   - Challenge acceptance/decline/counter/cancel
   - Stake locking on acceptance
   - Expiration handling

4. **Phase 4: Duel System (Consensus-Based)**
   - Duel model with vote fields
   - Vote submission endpoint
   - Consensus processing logic
   - Dispute handling
   - Commission calculation and deduction
   - Draw handling with partial refund

5. **Phase 5: Admin Dashboard**
   - Admin authentication
   - Deposit validation endpoints
   - Withdrawal approval endpoints
   - Dispute resolution with vote display
   - User management (ban, adjust balance)
   - Commission settings management
   - Admin logging

6. **Phase 6: Notifications**
   - In-app notification system
   - Admin notifications (only for critical events)
   - Telegram notifications (optional)

7. **Phase 7: Frontend**
   - React app with Vite
   - Authentication views (login, register)
   - Wallet views (deposit, withdraw, transactions)
   - Challenge views (create, accept, list)
   - Duel room with voting buttons (Win/Draw/Lose)
   - Admin dashboard views
   - Cyberpunk dark UI theme

8. **Phase 8: AI Assistant**
   - Dev-X API integration
   - Context-aware responses
   - Admin and user-specific guidance

## CRITICAL IMPLEMENTATION NOTES

1. **MongoDB Transactions**
   - All wallet operations must use MongoDB transactions
   - Replica set is required for transaction support
   - Fallback to in-memory replica set for development

2. **Security**
   - Never trust client-side validation
   - All sensitive operations on server
   - JWT secret must be strong in production
   - Password hashing with bcrypt

3. **Consensus System**
   - Replace old OCR-based system with vote-based consensus
   - Player votes: win, draw, lose
   - Auto-resolve when votes match
   - Dispute when votes inconsistent
   - Commission deducted even on draws

4. **Admin Notifications**
   - Only notify for: pending deposits, pending withdrawals, disputes, username changes, suspicious activities
   - Do NOT notify for: normal duel settlements, room creation, vote submissions

5. **Deposit Validation**
   - Transaction reference is mandatory
   - Admin must verify reference before approval
   - Screenshot is optional

6. **Error Handling**
   - Use custom AppError class
   - Proper HTTP status codes
   - User-friendly error messages
   - Comprehensive logging

## TESTING REQUIREMENTS

1. Test wallet transactions with MongoDB transactions
2. Test consensus-based duel resolution (win/lose, draw, dispute)
3. Test commission deduction on draws
4. Test admin dispute resolution (winner, draw, cancel)
5. Test deposit validation with reference verification
6. Test withdrawal approval/rejection
7. Test admin notifications (only for critical events)
8. Test user authentication and authorization
9. Test challenge flow (create, accept, cancel)
10. Test ban system and balance adjustment

## DEPLOYMENT NOTES

1. Use MongoDB Atlas for production
2. Configure IP whitelist for MongoDB Atlas
3. Set strong JWT_SECRET in production
4. Use HTTPS in production
5. Configure CORS properly
6. Set NODE_ENV=production
7. Use Redis for session management in production (optional in V1)
8. Monitor MongoDB replica set health
9. Implement proper logging and monitoring
10. Backup database regularly

---

## YOUR TASK

Build the complete SKILL2CASH platform following this specification exactly. Implement all features, models, routes, services, and business rules as described. Ensure the consensus-based duel system works correctly with proper commission deduction even on draws. Implement admin notifications only for critical events. Use MongoDB transactions for all wallet operations.

Start with the backend infrastructure and models, then implement services, routes, and finally the frontend. Test all features thoroughly before deployment.

Create a production-ready, secure, and scalable platform that follows modern best practices and the specific business rules outlined above.




N'oublie pas, n'oublie pas, c'est en français. En français, en français, en français
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb+srv://onexdelux_db_user:GcDqm9F47tsV5P5A@cluster0.utouxia.mongodb.net/?appName=Cluster0
JWT_SECRET=mpop5765
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
PLATFORM_WALLET_ID=platform
AI_BASE_URL=https://aimodelapi.onrender.com/v1
AI_API_KEY=devx-s3lkpld19bvhbsv2ex5omi1b2vjet5a5
AI_MODEL=devx
AI_MAX_TOKENS=700
AI_ASSISTANT_ROLE=admin
ADMIN_USERNAME=onexdelux1
ADMIN_EMAIL=onexdelux@gmail.com
ADMIN_PASSWORD=66240702Mkings
ADMIN_COUNTRY=Cote d'Ivoire
ADMIN_LEVEL=Elite
ADMIN_EFOOTBALL_USERNAME=onexdelux1
TELEGRAM_BOT_TOKEN=@secret:TELEGRAM_BOT_TOKEN

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://duel-diva-dash.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3eadd1cd-ca42-43ea-ac1d-f02c716ee947).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
