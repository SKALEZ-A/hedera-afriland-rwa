# GlobalLand Frontend

React.js web application for the GlobalLand real estate tokenization platform.

## Features

- **Modern React Architecture**: Built with React 18, TypeScript, and modern hooks
- **Responsive Design**: Mobile-first design with Tailwind CSS
- **Real-time Updates**: WebSocket integration for live notifications
- **State Management**: React Query for server state, Context API for client state
- **Authentication**: JWT-based authentication with automatic token refresh
- **Routing**: React Router v6 with protected routes
- **Form Handling**: React Hook Form with validation
- **UI Components**: Headless UI components with custom styling
- **Charts & Analytics**: Recharts for data visualization
- **Error Handling**: Error boundaries and comprehensive error handling
- **Performance**: Code splitting, lazy loading, and optimization

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS framework
- **React Router v6** - Client-side routing
- **React Query** - Server state management
- **React Hook Form** - Form handling
- **Axios** - HTTP client
- **Socket.io Client** - Real-time communication
- **Headless UI** - Accessible UI components
- **Heroicons** - Icon library
- **React Hot Toast** - Notifications
- **Recharts** - Data visualization
- **Framer Motion** - Animations
- **Date-fns** - Date utilities

## Getting Started

### Prerequisites

- Node.js 16+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.example .env.local
```

3. Configure environment variables:
```env
REACT_APP_API_URL=http://localhost:3001/api
REACT_APP_WS_URL=ws://localhost:3001
```

4. Start development server:
```bash
npm start
```

The application will be available at `http://localhost:3000`.

## Available Scripts

- `npm start` - Start development server
- `npm build` - Build for production
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run type-check` - Run TypeScript type checking

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Layout/         # Layout components (Header, Footer, Sidebar)
│   ├── UI/             # Basic UI components
│   └── Error/          # Error handling components
├── contexts/           # React contexts
├── hooks/              # Custom hooks
├── pages/              # Page components
├── services/           # API services
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
└── styles/             # Global styles
```

## Key Features Implementation

### Authentication
- JWT token-based authentication
- Automatic token refresh
- Protected routes
- Role-based access control

### Real-time Updates
- WebSocket connection management
- Real-time notifications
- Live portfolio updates
- Trading updates

### Responsive Design
- Mobile-first approach
- Responsive navigation
- Touch-friendly interfaces
- Progressive enhancement

### Performance
- Code splitting by routes
- Lazy loading of components
- Image optimization
- Bundle size optimization

## API Integration

The frontend integrates with the GlobalLand API:

- **Authentication**: Login, register, password reset
- **Properties**: Browse, search, view details
- **Investments**: Purchase, portfolio management
- **Trading**: Order management, market data
- **Payments**: Payment processing, currency conversion
- **Notifications**: Real-time updates

## State Management

- **Server State**: React Query for API data
- **Client State**: React Context for authentication, UI state
- **Form State**: React Hook Form for form management
- **WebSocket State**: Custom context for real-time data

## Testing

- Unit tests with Jest and React Testing Library
- Integration tests for key user flows
- E2E tests with Cypress (planned)

## Deployment

### Production Build

```bash
npm run build
```

### Environment Variables

Required environment variables for production:

- `REACT_APP_API_URL` - Backend API URL
- `REACT_APP_WS_URL` - WebSocket server URL

### Docker Deployment

```dockerfile
FROM node:16-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## Contributing

1. Follow the existing code style
2. Write tests for new features
3. Update documentation
4. Submit pull requests

## License

MIT License - see LICENSE file for details.